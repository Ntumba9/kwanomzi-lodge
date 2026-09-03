/**
 * ONE-TIME: applies prisma/migrations/20260903120000_add_room_pricing_models_and_meals
 * directly against production through the mTLS relay, then records it in
 * `_prisma_migrations` so `prisma migrate status`/`deploy` stay in sync.
 *
 * Bypasses Prisma's own migration engine (which can't route through the
 * relay — see scripts/list-room-types.ts's header for why) by running the
 * migration's own generated SQL through the same small-pool PrismaMariaDb
 * adapter pattern that was verified to work against production. Reuses the
 * migration file's exact statements — never a hand-typed duplicate of them.
 *
 * Run: npx tsx scripts/apply-migration-via-relay.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const MIGRATION_NAME = "20260903120000_add_room_pricing_models_and_meals";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    // Strip full-line `-- comment` lines from within each chunk (not just
    // a whole-chunk startsWith check, which wrongly discarded entire
    // statements here — every statement in this file is preceded by its
    // own "-- AlterTable" comment line, so a startsWith("--") check on the
    // untouched chunk matched every statement and silently ran none of
    // them. Verified directly: the first apply-migration run reported "0
    // statement(s) to run" and nothing landed in production.).
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function main() {
  const migrationDir = join(process.cwd(), "prisma/migrations", MIGRATION_NAME);
  const sql = readFileSync(join(migrationDir, "migration.sql"), "utf8");
  const statements = splitStatements(sql);
  console.log(`[apply-migration] ${statements.length} statement(s) to run from ${MIGRATION_NAME}`);
  if (statements.length === 0) {
    throw new Error("splitStatements() found 0 statements — refusing to record this migration as applied.");
  }
  for (const [i, stmt] of statements.entries()) {
    console.log(`[apply-migration] statement ${i + 1} preview: ${stmt.slice(0, 60).replace(/\s+/g, " ")}...`);
  }

  const relay = await ensureRelayListening({
    proxyHost: requireEnv("DIAG_DB_PROXY_HOST"),
    proxyPort: Number(requireEnv("DIAG_DB_PROXY_PORT")),
    clientCert: requireEnv("DIAG_DB_CLIENT_CERT").replace(/\\n/g, "\n"),
    clientKey: requireEnv("DIAG_DB_CLIENT_KEY").replace(/\\n/g, "\n"),
    caCert: requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n"),
  });
  console.log(`[apply-migration] relay listening on ${relay.host}:${relay.port}`);

  const adapter = new PrismaMariaDb({
    host: relay.host,
    port: relay.port,
    user: requireEnv("DIAG_DB_USER"),
    password: requireEnv("DIAG_DB_PASSWORD"),
    database: requireEnv("DIAG_DB_NAME"),
    allowPublicKeyRetrieval: true,
    connectionLimit: 2,
    connectTimeout: 8_000,
  });
  const prisma = new PrismaClient({ adapter });

  // A prior run of this script (before the splitStatements fix above) ran
  // zero statements but still recorded the migration as applied — remove
  // that false record first, so it can't cause this run to skip the DDL
  // that was never actually executed.
  const removed = await prisma.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = ? AND applied_steps_count = 1",
    MIGRATION_NAME,
  );
  if (removed > 0) {
    console.log(`[apply-migration] removed ${removed} false "applied" record(s) from a prior buggy run.`);
  }

  const existing = await prisma.$queryRawUnsafe<{ finished_at: Date | null }[]>(
    "SELECT finished_at FROM _prisma_migrations WHERE migration_name = ?",
    MIGRATION_NAME,
  );
  if (existing.length > 0 && existing[0]!.finished_at) {
    console.log(`[apply-migration] "${MIGRATION_NAME}" already recorded as applied — nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  for (const [i, stmt] of statements.entries()) {
    console.log(`[apply-migration] running statement ${i + 1}/${statements.length}...`);
    await prisma.$executeRawUnsafe(stmt);
  }

  // Record it exactly the way `prisma migrate resolve --applied` would,
  // so future `prisma migrate status` sees this as already applied.
  const checksum = createHash("sha256").update(sql).digest("hex");
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES (?, ?, ?, NOW(6), NOW(6), 1)`,
    randomUUID(),
    checksum,
    MIGRATION_NAME,
  );

  console.log("[apply-migration] Done. Migration applied and recorded.");
  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("[apply-migration] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
