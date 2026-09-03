/**
 * ONE-TIME: applies the client's confirmed rate sheet to production.
 *
 * Mapping confirmed with the client in chat (see session notes):
 *  - RoomType #1 "Deluxe Single Room" -> "Standard Single Bed", FLAT R700/room.
 *    Room count already 1 — no room changes needed.
 *  - RoomType #2 "2x Twin Double Beds" — already renamed/repriced by
 *    scripts/add-double-twin-beds-photo.ts. Untouched here.
 *  - RoomType #3 "Deluxe King Room" -> "Standard King", OCCUPANCY_TIERED
 *    solo R1,300 / sharing R1,400. Room count 1 -> 3 (add 2 more).
 *  - RoomType #4 "Deluxe Double Room with Two Double Beds" — NOT in the
 *    client's list. Left completely untouched.
 *  - RoomType #9 "Deluxe Guest Room, 2 Queen Twins" -> "2x Twin Queen Beds",
 *    capacity corrected 2 -> 4, PER_GUEST R1,100/bed/person. Room count
 *    1 -> 2 (add 1 more).
 *  - NEW RoomType "Standard Queen Rooms", OCCUPANCY_TIERED solo R1,100 /
 *    sharing R1,200, capacity 2, 4 rooms.
 *
 * Idempotent: re-running is safe (checks names/counts before creating).
 * Run: npx tsx scripts/update-room-rates-and-meals.ts
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

async function ensureRoomCount(prisma: PrismaClient, roomTypeId: number, baseName: string, targetCount: number) {
  const rooms = await prisma.room.findMany({ where: { roomTypeId } });
  console.log(`  currently ${rooms.length} room(s), target ${targetCount}`);
  for (let i = rooms.length + 1; i <= targetCount; i++) {
    const name = `${baseName} ${i}`;
    const created = await prisma.room.create({ data: { roomTypeId, name } });
    console.log(`  created Room #${created.id} "${created.name}"`);
  }
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

  // --- #3 "Deluxe King Room" -> "Standard King" ---
  console.log('[update] "Deluxe King Room" -> "Standard King"');
  const king = await prisma.roomType.findUnique({ where: { id: 3 } });
  if (!king) throw new Error("RoomType #3 not found — refusing to guess.");
  await prisma.roomType.update({
    where: { id: 3 },
    data: {
      name: "Standard King",
      pricingModel: "OCCUPANCY_TIERED",
      soloPriceCents: 130_000,
      sharingPriceCents: 140_000,
    },
  });
  await ensureRoomCount(prisma, 3, "Standard King", 3);

  // --- #9 "Deluxe Guest Room, 2 Queen Twins" -> "2x Twin Queen Beds" ---
  console.log('[update] "Deluxe Guest Room, 2 Queen Twins" -> "2x Twin Queen Beds"');
  const queenTwins = await prisma.roomType.findUnique({ where: { id: 9 } });
  if (!queenTwins) throw new Error("RoomType #9 not found — refusing to guess.");
  await prisma.roomType.update({
    where: { id: 9 },
    data: {
      name: "2x Twin Queen Beds",
      capacity: 4,
      pricingModel: "PER_GUEST",
      perGuestPriceCents: 110_000,
    },
  });
  await ensureRoomCount(prisma, 9, "2x Twin Queen Beds", 2);

  // --- #1 "Deluxe Single Room" -> "Standard Single Bed" ---
  console.log('[update] "Deluxe Single Room" -> "Standard Single Bed"');
  const single = await prisma.roomType.findUnique({ where: { id: 1 } });
  if (!single) throw new Error("RoomType #1 not found — refusing to guess.");
  await prisma.roomType.update({
    where: { id: 1 },
    data: { name: "Standard Single Bed", pricingModel: "FLAT", basePriceCents: 70_000 },
  });
  await ensureRoomCount(prisma, 1, "Standard Single Bed", 1);

  // --- NEW "Standard Queen Rooms" ---
  console.log('[update] ensuring "Standard Queen Rooms" exists');
  let standardQueen = await prisma.roomType.findFirst({ where: { name: "Standard Queen Rooms" } });
  if (!standardQueen) {
    standardQueen = await prisma.roomType.create({
      data: {
        name: "Standard Queen Rooms",
        capacity: 2,
        pricingModel: "OCCUPANCY_TIERED",
        basePriceCents: 110_000, // fallback, mirrors soloPriceCents
        soloPriceCents: 110_000,
        sharingPriceCents: 120_000,
      },
    });
    console.log(`  created RoomType #${standardQueen.id}`);
  } else {
    console.log(`  already exists (#${standardQueen.id}) — updating rates just in case`);
    await prisma.roomType.update({
      where: { id: standardQueen.id },
      data: {
        pricingModel: "OCCUPANCY_TIERED",
        basePriceCents: 110_000,
        soloPriceCents: 110_000,
        sharingPriceCents: 120_000,
      },
    });
  }
  await ensureRoomCount(prisma, standardQueen.id, "Standard Queen Room", 4);

  console.log("[update] Done.");
  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("[update] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
