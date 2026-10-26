/**
 * DIAGNOSTIC ONLY — read-only. Shows the most recent booking + payment +
 * webhook event, to confirm the real test payment actually confirmed
 * correctly end-to-end. Delete once no longer needed.
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

  const booking = await prisma.booking.findFirst({
    orderBy: { createdAt: "desc" },
    include: { guest: true, payments: true, room: { include: { roomType: true } } },
  });

  if (!booking) {
    console.log("No bookings found.");
  } else {
    console.log("Most recent booking:");
    console.log(`  reference: ${booking.bookingReference}`);
    console.log(`  status: ${booking.status}`);
    console.log(`  room: ${booking.room.roomType.name}`);
    console.log(`  guest: ${booking.guest.firstName} ${booking.guest.lastName} (${booking.guest.email})`);
    console.log(`  totalAmountCents: ${booking.totalAmountCents}`);
    console.log(`  createdAt: ${booking.createdAt.toISOString()}`);
    for (const p of booking.payments) {
      console.log(`  payment #${p.id}: status=${p.status} amountCents=${p.amountCents} providerReference=${p.providerReference} paidAt=${p.paidAt?.toISOString() ?? "-"}`);
    }
  }

  const recentEvents = await prisma.webhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: 5,
  });
  console.log("\nRecent webhook events:");
  for (const e of recentEvents) {
    console.log(`  #${e.id} provider=${e.provider} type=${e.eventType} status=${e.status} receivedAt=${e.receivedAt.toISOString()}`);
  }

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
