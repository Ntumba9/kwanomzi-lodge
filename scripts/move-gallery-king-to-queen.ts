/**
 * ONE-TIME: corrects a misassignment — s1.jpeg..s6.jpeg were attached to
 * "Standard King" (RoomType #3) based on a guess that turned out wrong;
 * the client confirmed via WhatsApp these are actually "Standard Queen"
 * (RoomType #10, "sleeps 1-2"), replacing its stock placeholder photo.
 * Standard King reverts to just its original real photo.
 *
 * Run: npx tsx scripts/move-gallery-king-to-queen.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const KING_ROOM_TYPE_ID = 3;
const QUEEN_ROOM_TYPE_ID = 10;
const GALLERY_URLS = [
  "/images/rooms/s1.jpeg",
  "/images/rooms/s2.jpeg",
  "/images/rooms/s3.jpeg",
  "/images/rooms/s4.jpeg",
  "/images/rooms/s5.jpeg",
  "/images/rooms/s6.jpeg",
];
const NEW_PRIMARY_URL = "/images/rooms/s2.jpeg"; // clearest bed shot, branded towel visible
const STOCK_URL_TO_REMOVE = "/images/rooms/stock/standard-queen-room-stock-1.jpg";

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

  // 1. Remove the Queen stock placeholder — real photos replace it now.
  const stock = await prisma.roomImage.findFirst({ where: { url: STOCK_URL_TO_REMOVE } });
  if (stock) {
    await prisma.roomImage.delete({ where: { id: stock.id } });
    console.log(`Removed stock placeholder #${stock.id} from RoomType #${QUEEN_ROOM_TYPE_ID}`);
  }

  // 2. Move each gallery image from King to Queen, fixing order/primary.
  for (const [index, url] of GALLERY_URLS.entries()) {
    const image = await prisma.roomImage.findFirst({ where: { url, roomTypeId: KING_ROOM_TYPE_ID } });
    if (!image) {
      console.log(`  ${url} not found on RoomType #${KING_ROOM_TYPE_ID} — skipping (already moved?).`);
      continue;
    }
    await prisma.roomImage.update({
      where: { id: image.id },
      data: { roomTypeId: QUEEN_ROOM_TYPE_ID, displayOrder: index, isPrimary: url === NEW_PRIMARY_URL },
    });
    console.log(`  moved RoomImage #${image.id} (${url}) -> RoomType #${QUEEN_ROOM_TYPE_ID}, order ${index}, primary=${url === NEW_PRIMARY_URL}`);
  }

  const king = await prisma.roomType.findUnique({ where: { id: KING_ROOM_TYPE_ID }, include: { images: true } });
  const queen = await prisma.roomType.findUnique({ where: { id: QUEEN_ROOM_TYPE_ID }, include: { images: true } });
  console.log(`\nFinal state:`);
  console.log(`  Standard King (#${KING_ROOM_TYPE_ID}): ${king?.images.length} image(s)`);
  console.log(`  Standard Queen (#${QUEEN_ROOM_TYPE_ID}): ${queen?.images.length} image(s)`);

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
