/**
 * One-time provisioning script for a new room type: "Deluxe Guest Room, 2
 * Queen Twins". Run manually (`npx tsx scripts/add-room-deluxe-guest-room-2-queen-twins.ts`),
 * never as part of build/deploy — same pattern as prisma/createOwner.ts,
 * since the app has no admin UI for creating RoomImage rows (RoomTypeForm
 * only covers RoomType fields) and the real production room-type catalog
 * has always been provisioned this way rather than through prisma/seed.ts
 * (which is dev/demo-only fixture data — see lib/content/images.ts).
 *
 * Idempotent: if a RoomType with this exact name already exists, does
 * nothing and reports that instead of creating a duplicate.
 *
 * Reuses the existing service layer (createRoomType, createRoom) exactly
 * as the staff admin UI's server actions do — see app/staff/rooms/actions.ts.
 * Only the RoomImage row is created directly via Prisma, since no service
 * function exists for that (matching how the other 4 room types' images
 * were provisioned).
 */
import "dotenv/config";
import { getPrisma } from "@/lib/db/prisma";
import { createRoomType, createRoom } from "@/lib/services/RoomService";

const ROOM_TYPE_NAME = "Deluxe Guest Room, 2 Queen Twins";
const IMAGE_URL = "/images/rooms/Deluxe. Guest Room, 2 Queen Twins.png";

async function main() {
  const prisma = await getPrisma();

  const existing = await prisma.roomType.findFirst({ where: { name: ROOM_TYPE_NAME } });
  if (existing) {
    console.log(`Room type "${ROOM_TYPE_NAME}" already exists (id ${existing.id}) — not creating a duplicate.`);
    return;
  }

  const roomType = await createRoomType({
    name: ROOM_TYPE_NAME,
    capacity: 2,
    basePriceCents: 180_000, // R1,800.00 / night
  });
  console.log(`Created RoomType "${roomType.name}" (id ${roomType.id}).`);

  // Matches the existing 1:1 RoomType:Room pattern used by all 4 current
  // room types (one physical Room per RoomType, same name as the type).
  const room = await createRoom({ roomTypeId: roomType.id, name: ROOM_TYPE_NAME });
  console.log(`Created Room "${room.name}" (id ${room.id}).`);

  const image = await prisma.roomImage.create({
    data: {
      roomTypeId: roomType.id,
      url: IMAGE_URL,
      altText: `${ROOM_TYPE_NAME} at KwaNomzi Boutique Lodge`,
      displayOrder: 0,
      isPrimary: true,
      source: "LODGE",
    },
  });
  console.log(`Created RoomImage (id ${image.id}) -> ${image.url}`);

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to provision room type:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closeRelay } = await import("@/lib/db/mtlsRelay");
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
