/**
 * DIAGNOSTIC ONLY — read-only. Lists RoomImage rows per RoomType through
 * the mTLS relay, so we know which image file is already attached to which
 * room type before adding a new one. Delete once no longer needed.
 *
 * Run: npx tsx scripts/list-room-images.ts
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

  const roomTypes = await prisma.roomType.findMany({
    include: { images: true },
    orderBy: { id: "asc" },
  });
  for (const rt of roomTypes) {
    console.log(`#${rt.id} "${rt.name}"`);
    for (const img of rt.images) {
      console.log(`    image #${img.id} primary=${img.isPrimary} order=${img.displayOrder} url=${img.url}`);
    }
  }

  // Also check whether the migration columns exist yet.
  const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'room_type' AND COLUMN_NAME IN ('pricingModel','soloPriceCents','sharingPriceCents','perGuestPriceCents')",
  );
  console.log(`room_type pricing columns present: ${cols.map((c) => c.COLUMN_NAME).join(", ") || "(none)"}`);

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
