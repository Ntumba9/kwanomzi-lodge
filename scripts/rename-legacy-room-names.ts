/**
 * ONE-TIME: renames the original physical Room rows (whose names still say
 * "Deluxe ...") to match their RoomType's new name, so the booking flow's
 * "RoomTypeName (RoomName)" fallback (shown only when they differ — see
 * BookingWizard's review step) doesn't display a stale name alongside the
 * new one. Purely cosmetic; no pricing/availability effect.
 *
 * Idempotent. Run: npx tsx scripts/rename-legacy-room-names.ts
 * Delete once no longer needed.
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

const RENAMES: { roomId: number; newName: string }[] = [
  { roomId: 1, newName: "Standard Single Bed" },
  { roomId: 2, newName: "2x Twin Double Beds" },
  { roomId: 3, newName: "Standard King 1" },
  { roomId: 13, newName: "2x Twin Queen Beds 1" },
];

async function main() {
  const relay = await ensureRelayListening({
    proxyHost: requireEnv("DIAG_DB_PROXY_HOST"),
    proxyPort: Number(requireEnv("DIAG_DB_PROXY_PORT")),
    clientCert: requireEnv("DIAG_DB_CLIENT_CERT").replace(/\\n/g, "\n"),
    clientKey: requireEnv("DIAG_DB_CLIENT_KEY").replace(/\\n/g, "\n"),
    caCert: requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n"),
  });
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

  for (const { roomId, newName } of RENAMES) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      console.log(`  Room #${roomId} not found — skipping.`);
      continue;
    }
    if (room.name === newName) {
      console.log(`  Room #${roomId} already "${newName}" — skipping.`);
      continue;
    }
    await prisma.room.update({ where: { id: roomId }, data: { name: newName } });
    console.log(`  Room #${roomId} "${room.name}" -> "${newName}"`);
  }

  console.log("[rename] Done.");
  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("[rename] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
