/**
 * ONE-TIME: renames RoomType #2 ("Deluxe Double Room with Two Single Beds")
 * to "2x Twin Double Beds", sets its flat rate to R1,800/room, and makes
 * the newly-supplied public/images/rooms/double twin beds.jpeg its primary
 * photo — demoting the existing real photo and stock fallback rather than
 * deleting either.
 *
 * Idempotent: safe to re-run (checks the RoomImage url before inserting).
 * Run: npx tsx scripts/add-double-twin-beds-photo.ts
 * Delete once no longer needed.
 */
import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, closeRelay } from "@/lib/db/mtlsRelay";

const ROOM_TYPE_ID = 2;
const NEW_NAME = "2x Twin Double Beds";
const NEW_BASE_PRICE_CENTS = 180_000; // R1,800.00 / room
const NEW_IMAGE_URL = "/images/rooms/double twin beds.jpeg";

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
  console.log(`[add-photo] found RoomType #${roomType.id} "${roomType.name}"`);

  await prisma.roomType.update({
    where: { id: ROOM_TYPE_ID },
    data: { name: NEW_NAME, basePriceCents: NEW_BASE_PRICE_CENTS },
  });
  console.log(`[add-photo] renamed to "${NEW_NAME}", basePriceCents=${NEW_BASE_PRICE_CENTS}`);

  const existingImage = roomType.images.find((img) => img.url === NEW_IMAGE_URL);
  if (existingImage) {
    console.log(`[add-photo] image already exists (#${existingImage.id}) — leaving as-is.`);
  } else {
    // Demote every current image by one display-order slot, then insert
    // the new photo as primary at order 0 — never delete an existing row.
    for (const img of roomType.images) {
      await prisma.roomImage.update({
        where: { id: img.id },
        data: { isPrimary: false, displayOrder: img.displayOrder + 1 },
      });
    }
    const created = await prisma.roomImage.create({
      data: {
        roomTypeId: ROOM_TYPE_ID,
        url: NEW_IMAGE_URL,
        altText: `${NEW_NAME} at KwaNomzi Boutique Lodge`,
        displayOrder: 0,
        isPrimary: true,
        source: "LODGE",
      },
    });
    console.log(`[add-photo] created RoomImage #${created.id} -> ${created.url} (primary)`);
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
