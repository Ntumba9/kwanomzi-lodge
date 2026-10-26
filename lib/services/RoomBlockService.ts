import { getPrisma } from "@/lib/db/prisma";
import { assertValidDateRange, nightsBetween } from "@/lib/dates";
import { InvalidDateRangeError, RoomNotAvailableError, RoomNotFoundError, RoomBlockNotFoundError } from "@/lib/errors";

export interface CreateRoomBlockInput {
  roomId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, exclusive — same convention as Booking.checkOut
  reason?: string;
}

/**
 * Blocks a room for a date range — staff maintenance/private-use, not a
 * guest reservation (see schema.prisma's RoomBlock comment for why this is
 * deliberately not a Booking). Mirrors BookingService.createBooking's
 * concurrency-safety shape: lock the room row, then insert one
 * RoomBlockNight per night, relying on its UNIQUE(roomId, stayDate) to
 * reject any overlap with an existing block exactly the way BookingNight
 * rejects a double-booking — never an application-level check alone.
 */
export async function createRoomBlock(input: CreateRoomBlockInput) {
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${input.endDate}T00:00:00.000Z`);
  try {
    assertValidDateRange(startDate, endDate);
  } catch (err) {
    throw new InvalidDateRangeError(err instanceof Error ? err.message : "Invalid date range");
  }

  const nights = nightsBetween(startDate, endDate);
  const prisma = await getPrisma();

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM room WHERE id = ${input.roomId} FOR UPDATE`;
    if (locked.length === 0) {
      throw new RoomNotFoundError();
    }

    // A block must not silently swallow nights a guest has already paid
    // for — check for real bookings the same way createBooking checks for
    // blocks, just from the other side of the same pair of tables.
    const bookedConflict = await tx.bookingNight.findFirst({ where: { roomId: input.roomId, stayDate: { in: nights } } });
    if (bookedConflict) {
      throw new RoomNotAvailableError();
    }

    const block = await tx.roomBlock.create({
      data: { roomId: input.roomId, startDate, endDate, reason: input.reason },
    });

    try {
      await tx.roomBlockNight.createMany({
        data: nights.map((stayDate) => ({ roomBlockId: block.id, roomId: input.roomId, stayDate })),
      });
    } catch {
      // Overlap with an existing block's nights — same unique-constraint
      // pattern as BookingNight, see RoomBlockNight's schema comment.
      throw new RoomNotAvailableError();
    }

    return block;
  });
}

/** Every block, soonest-ending first — past blocks included, so staff can see recent history, not just what's upcoming. */
export async function listRoomBlocks() {
  const prisma = await getPrisma();
  return prisma.roomBlock.findMany({
    include: { room: { include: { roomType: true } } },
    orderBy: { startDate: "asc" },
  });
}

/** Deletes a block early (its nights become bookable again immediately) — cascades to RoomBlockNight via onDelete: Cascade. */
export async function deleteRoomBlock(id: number) {
  const prisma = await getPrisma();
  const block = await prisma.roomBlock.findUnique({ where: { id } });
  if (!block) throw new RoomBlockNotFoundError();
  await prisma.roomBlock.delete({ where: { id } });
  return block;
}
