/**
 * DIAGNOSTIC ONLY — read-only inspection of the real production RoomType/
 * Room catalog through the mTLS relay. Never writes anything. Delete once
 * no longer needed.
 *
 * Bypasses lib/db/prisma.ts's getPrisma() singleton (which pools 10
 * connections by default and was observed here to hit Prisma's internal
 * pool-acquire timeout every time from this network — the raw `mariadb`
 * pool used by scripts/diag-mtls-relay.ts, with a smaller connectionLimit,
 * connects fine) and builds its own single-connection PrismaMariaDb
 * adapter instead, matching the working diag script's pool settings.
 *
 * Run: npx tsx scripts/list-room-types.ts
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const relay = await ensureRelayListening({
    proxyHost: requireEnv("DIAG_DB_PROXY_HOST"),
    proxyPort: Number(requireEnv("DIAG_DB_PROXY_PORT")),
    clientCert: requireEnv("DIAG_DB_CLIENT_CERT").replace(/\\n/g, "\n"),
    clientKey: requireEnv("DIAG_DB_CLIENT_KEY").replace(/\\n/g, "\n"),
    caCert: requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n"),
  });
  console.log(`[list-room-types] relay listening on ${relay.host}:${relay.port}`);

  const adapter = new PrismaMariaDb({
    host: relay.host,
    port: relay.port,
    user: requireEnv("DIAG_DB_USER"),
    password: requireEnv("DIAG_DB_PASSWORD"),
    database: requireEnv("DIAG_DB_NAME"),
    allowPublicKeyRetrieval: true,
    connectionLimit: 3,
    connectTimeout: 8_000,
  });
  const prisma = new PrismaClient({ adapter });

  const roomTypes = await prisma.roomType.findMany({
    include: { rooms: true },
    orderBy: { id: "asc" },
  });

  for (const rt of roomTypes) {
    console.log(
      `#${rt.id} "${rt.name}" — capacity ${rt.capacity}, base R${(rt.basePriceCents / 100).toFixed(2)}, active=${rt.isActive}, rooms=${rt.rooms.length}`,
    );
    for (const room of rt.rooms) {
      console.log(`    room #${room.id} "${room.name}" active=${room.isActive} override=${room.priceOverrideCents ?? "-"}`);
    }
  }
  console.log(`Total room types: ${roomTypes.length}`);

  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
