/**
 * ONE-TIME: adds 4 more real photos to "Standard King" (RoomType #3) —
 * client sent two separate king rooms, each with its own bathroom
 * (k1=bed A, k2=bath A, k3=bed B, k4=bath B). Appended after the existing
 * primary photo, in that order.
 *
 * Idempotent: skips any URL already attached.
 * Run: npx tsx scripts/add-standard-king-second-gallery.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const ROOM_TYPE_ID = 3;
const IMAGE_URLS = ["/images/rooms/k1.jpeg", "/images/rooms/k2.jpeg", "/images/rooms/k3.jpeg", "/images/rooms/k4.jpeg"];

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

  const roomType = await prisma.roomType.findUnique({ where: { id: ROOM_TYPE_ID }, include: { images: true } });
  if (!roomType) throw new Error(`RoomType #${ROOM_TYPE_ID} not found — refusing to guess a different one.`);
  console.log(`Found RoomType #${roomType.id} "${roomType.name}" (${roomType.images.length} existing image(s))`);

  let nextOrder = roomType.images.length;
  for (const url of IMAGE_URLS) {
    const existing = roomType.images.find((img) => img.url === url);
    if (existing) {
      console.log(`  already attached: ${url} (#${existing.id}) — skipping`);
      continue;
    }
    const created = await prisma.roomImage.create({
      data: {
        roomTypeId: ROOM_TYPE_ID,
        url,
        altText: `${roomType.name} at KwaNomzi Boutique Lodge`,
        displayOrder: nextOrder,
        isPrimary: false,
        source: "LODGE",
      },
    });
    console.log(`  created RoomImage #${created.id} -> ${created.url} (order ${created.displayOrder})`);
    nextOrder++;
  }

  console.log("Done.");
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
