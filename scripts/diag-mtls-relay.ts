/**
 * DIAGNOSTIC ONLY — proves lib/db/mtlsRelay.ts (the module Phase 3's real
 * Prisma integration uses) end-to-end, using DIAG_-prefixed env vars kept
 * entirely separate from production's DB_RELAY_ vars and DATABASE_URL. Run
 * with:
 *   npx tsx scripts/diag-mtls-relay.ts
 *
 * Proves the full chain end-to-end using the SAME driver and the SAME
 * relay module the real app uses:
 *   this process --(loopback)--> lib/db/mtlsRelay.ts
 *              --(real mTLS)--> EC2 stunnel :8443
 *              --(real TLS, verified against RDS's own CA)--> RDS :3306
 *
 * Never logs certificate/key contents or the DB password. Reads config
 * from DIAG_* env vars (see .env — not committed).
 *
 * Delete this file (and app/api/diag/) once Phase 3 is either fully
 * adopted for production or abandoned — lib/db/mtlsRelay.ts itself stays
 * either way, since production code depends on it once cut over.
 */
import "dotenv/config";
import { connect as tlsConnect } from "node:tls";
import { Pool, createPool } from "mariadb";
import { ensureRelayListening, closeRelay, type MtlsRelayConfig } from "@/lib/db/mtlsRelay";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function diagRelayConfig(): MtlsRelayConfig {
  return {
    proxyHost: requireEnv("DIAG_DB_PROXY_HOST"),
    proxyPort: Number(requireEnv("DIAG_DB_PROXY_PORT")),
    clientCert: requireEnv("DIAG_DB_CLIENT_CERT").replace(/\\n/g, "\n"),
    clientKey: requireEnv("DIAG_DB_CLIENT_KEY").replace(/\\n/g, "\n"),
    caCert: requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n"),
  };
}

async function makePool(): Promise<Pool> {
  const relay = await ensureRelayListening(diagRelayConfig());
  console.log(`[diag] local relay listening on ${relay.host}:${relay.port}, forwarding via mTLS to EC2`);

  return createPool({
    host: relay.host,
    port: relay.port,
    user: requireEnv("DIAG_DB_USER"),
    password: requireEnv("DIAG_DB_PASSWORD"),
    database: requireEnv("DIAG_DB_NAME"),
    // The relay's outgoing leg to EC2 is already real mTLS; the loopback
    // hop from this process to the relay is unencrypted but never leaves
    // the machine. No TLS needed at the MySQL-protocol level here. Past
    // the EC2 proxy, stunnel forwards to RDS in plaintext over the private
    // VPC (the approved Phase 3 architecture — see the Option 1 decision:
    // a MySQL-protocol-aware TLS bridge would be needed to encrypt that
    // hop too, since stunnel can't do MySQL's protocol-embedded TLS
    // upgrade, and that's deliberately out of scope).
    allowPublicKeyRetrieval: true,
    connectionLimit: 5,
    connectTimeout: 8_000,
  });
}

async function testConnection(pool: Pool, label: string): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // mariadb returns numeric literals as BigInt by default (MySQL reports
    // untyped literals like `1` as BIGINT) — normalize before comparing.
    const [selectOne] = (await conn.query("SELECT 1 AS ok")) as Array<{ ok: number | bigint }>;
    if (Number(selectOne!.ok) !== 1) throw new Error(`SELECT 1 returned unexpected value: ${String(selectOne!.ok)}`);

    // Read-only schema metadata check — no booking/payment row data touched.
    const tables = (await conn.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name LIMIT 5",
    )) as Array<{ table_name: string }>;

    console.log(`[diag] ${label}: OK — SELECT 1 succeeded, found ${tables.length} table(s) in schema metadata`);
  } finally {
    await conn.release();
  }
}

/** Connects to the EC2 relay directly (bypassing our own loopback relay)
 *  with NO client certificate — this must be rejected at the mTLS layer,
 *  proving stunnel's `verify = 2` is still enforced.
 *
 * IMPORTANT: in TLS 1.3, a server requiring a client cert can report the
 * handshake as "connected" from the client's own point of view, then
 * reject asynchronously right after (we saw this exact behavior from
 * `openssl s_client` in Phase 2 testing: it printed "Verify return code: 0"
 * while stunnel's own log showed "peer did not return a certificate" and
 * zero bytes forwarded). So the `connect` callback firing is NOT proof of
 * success — we wait briefly afterward for the server-side rejection to
 * actually land as a close/error/reset before concluding anything. */
async function testNoClientCert(): Promise<void> {
  const host = requireEnv("DIAG_DB_PROXY_HOST");
  const port = Number(requireEnv("DIAG_DB_PROXY_PORT"));
  const caCert = requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n");

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = (ok: boolean, reason: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (ok) {
        console.log(`[diag] OK — connection without a client certificate was rejected (${reason})`);
      } else {
        console.log("[diag] NO-CLIENT-CERT TEST FAILED — connection stayed open without a client certificate");
        process.exitCode = 1;
      }
      resolve();
    };

    const socket = tlsConnect({ host, port, ca: caCert, rejectUnauthorized: true, timeout: 5_000 }, () => {
      // Handshake "completed" from our side — this is NOT proof of
      // acceptance (see comment above). Give the server a window to send
      // its post-handshake rejection, then treat "still open" as a real
      // failure only if nothing happened by then.
      setTimeout(() => settle(false, "connection stayed open past the grace window"), 1_500);
    });
    socket.on("error", (err) => settle(true, (err as Error).message));
    socket.on("close", () => settle(true, "closed by peer"));
    socket.on("timeout", () => settle(true, "timeout"));
  });
}

/** Connects through our loopback relay (mTLS layer succeeds fine) but with
 *  wrong DB credentials — must fail cleanly at the MySQL auth layer. */
async function testBadDbCredentials(): Promise<void> {
  console.log("[diag] --- failure-mode test: wrong database credentials ---");
  const relay = await ensureRelayListening(diagRelayConfig());
  const badPool = createPool({
    host: relay.host,
    port: relay.port,
    user: "nonexistent_user_for_failure_test",
    password: "wrong",
    database: requireEnv("DIAG_DB_NAME"),
    allowPublicKeyRetrieval: true,
    connectTimeout: 5_000,
    acquireTimeout: 5_000,
  });
  try {
    await badPool.query("SELECT 1");
    console.log("[diag] FAILURE-MODE TEST FAILED — bad credentials were unexpectedly accepted");
    process.exitCode = 1;
  } catch (err) {
    console.log(`[diag] OK — bad credentials correctly rejected (${(err as Error).name})`);
  } finally {
    await badPool.end().catch(() => {});
  }
}

async function main() {
  console.log("[diag] Phase 3 mTLS relay diagnostic starting");
  console.log(`[diag] target relay: ${requireEnv("DIAG_DB_PROXY_HOST")}:${requireEnv("DIAG_DB_PROXY_PORT")}`);

  await testNoClientCert();

  const pool = await makePool();
  try {
    for (let i = 1; i <= 5; i++) {
      await testConnection(pool, `attempt ${i}/5`);
    }
    console.log("[diag] 5/5 consecutive connections succeeded through the relay chain");
  } finally {
    await pool.end().catch(() => {});
  }

  await testBadDbCredentials();

  console.log("[diag] DONE");
  await closeRelay();
}

main()
  .catch((err) => {
    console.error("[diag] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // The relay's net.Server would otherwise keep the event loop alive
    // (by design, for warm-reuse in a real serverless container) — this
    // CLI script is a one-shot diagnostic, not a long-running process.
    process.exit(process.exitCode ?? 0);
  });
