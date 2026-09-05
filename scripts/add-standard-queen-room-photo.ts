/**
 * ONE-TIME: adds a stock photo to "Standard Queen Rooms" (RoomType #10),
 * the only room type with zero images — no real KwaNomzi photography
 * exists for it yet. Same sourcing convention as the other 3 stock photos
 * already in the repo (public/images/rooms/stock/): Pexels License, free
 * for commercial use, no attribution required, kept here for future
 * replacement with a real photo once the client supplies one.
 *
 * Source: https://www.pexels.com/photo/an-organized-bed-9582660/
 * Photographer: Erik Mclean
 *
 * Idempotent: if this exact URL is already attached, does nothing.
 * Run: npx tsx scripts/add-standard-queen-room-photo.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const ROOM_TYPE_ID = 10;
const IMAGE_URL = "/images/rooms/stock/standard-queen-room-stock-1.jpg";
const ATTRIBUTION =
  "Pexels — Erik Mclean — https://www.pexels.com/photo/an-organized-bed-9582660/ — Pexels License — free for commercial use, no attribution required (kept here for future replacement)";

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
  console.log(`[add-photo] found RoomType #${roomType.id} "${roomType.name}" (${roomType.images.length} existing image(s))`);

  const existing = roomType.images.find((img) => img.url === IMAGE_URL);
  if (existing) {
    console.log(`[add-photo] already attached (#${existing.id}) — nothing to do.`);
  } else {
    const created = await prisma.roomImage.create({
      data: {
        roomTypeId: ROOM_TYPE_ID,
        url: IMAGE_URL,
        altText: `${roomType.name} at KwaNomzi Boutique Lodge`,
        displayOrder: roomType.images.length,
        isPrimary: roomType.images.length === 0,
        source: "STOCK",
        attribution: ATTRIBUTION,
      },
    });
    console.log(`[add-photo] created RoomImage #${created.id} -> ${created.url} (primary=${created.isPrimary})`);
  }

  console.log("[add-photo] Done.");
  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("[add-photo] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
