import { getPrisma } from "@/lib/db/prisma";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import { assertValidDateRange, nightsBetween } from "@/lib/dates";
import { InvalidDateRangeError } from "@/lib/errors";

type Client = Prisma.TransactionClient | PrismaClient;

/**
 * Pre-flight check only — NOT the authority. It exists purely to give a
 * fast, friendly response before attempting a write. The actual guarantee
 * against double-booking comes from the UNIQUE(room_id, stay_date)
 * constraint enforced at insert time in BookingService.createBooking.
 *
 * `client` defaults to undefined rather than the prisma singleton directly
 * (default parameter initializers can't `await`) — resolved to the real
 * singleton just inside the function body instead.
 */
export async function isRoomAvailable(
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  client?: Client,
): Promise<boolean> {
  const db = client ?? (await getPrisma());
  const nights = nightsBetween(checkIn, checkOut);
  const conflict = await db.bookingNight.findFirst({
    where: { roomId, stayDate: { in: nights } },
  });
  return conflict === null;
}

/**
 * Guest-facing availability search: every active room type, with only the
 * specific rooms that are free for the whole requested date range attached.
 * Uses the exact same night-set semantics (nightsBetween) as
 * BookingService.createBooking, so a room shown as "available" here is
 * genuinely bookable — this is still a pre-flight read, not the authority.
 */
export async function searchAvailableRoomTypes(checkIn: Date, checkOut: Date) {
  try {
    assertValidDateRange(checkIn, checkOut);
  } catch (err) {
    throw new InvalidDateRangeError(err instanceof Error ? err.message : "Invalid date range");
  }

  const nights = nightsBetween(checkIn, checkOut);

  const prisma = await getPrisma();
  const roomTypes = await prisma.roomType.findMany({
    where: { isActive: true },
    include: {
      amenities: true,
      images: true,
      rooms: {
        where: { isActive: true },
        include: { bookingNights: { where: { stayDate: { in: nights } }, select: { id: true } } },
      },
    },
    orderBy: { basePriceCents: "asc" },
  });

  return roomTypes.map(({ rooms, ...roomType }) => ({
    roomType,
    // bookingNights is only fetched to test availability; every room here
    // has an empty array by construction, so it's harmless to leave in.
    availableRooms: rooms.filter((room) => room.bookingNights.length === 0),
  }));
}
