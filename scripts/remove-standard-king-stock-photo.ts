/**
 * ONE-TIME: removes the stock fallback photo from "Standard King" now that
 * real client photos exist for it (RoomImage #5,
 * /images/rooms/stock/deluxe-king-room-stock-1.jpg — not primary, not
 * referenced by any other room type).
 *
 * Run: npx tsx scripts/remove-standard-king-stock-photo.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const IMAGE_URL = "/images/rooms/stock/deluxe-king-room-stock-1.jpg";

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

  const image = await prisma.roomImage.findFirst({ where: { url: IMAGE_URL } });
  if (!image) {
    console.log(`No RoomImage row found for ${IMAGE_URL} — already removed, nothing to do.`);
  } else {
    console.log(`Found RoomImage #${image.id} on roomTypeId=${image.roomTypeId}, isPrimary=${image.isPrimary} — deleting.`);
    await prisma.roomImage.delete({ where: { id: image.id } });
    console.log("Deleted.");
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
