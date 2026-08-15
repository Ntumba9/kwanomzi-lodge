import { prisma } from "@/lib/db/prisma";
import { todayUtc } from "@/lib/dates";

const REPORT_WINDOW_DAYS = 30;

/**
 * Every figure here is derived directly from existing Booking/Payment/Room
 * rows — nothing is estimated or invented. Where the underlying data can't
 * support a metric (e.g. no historical daily-rate tracking exists), that
 * metric is simply not included rather than approximated.
 */
export interface OccupancyReport {
  windowDays: number;
  totalRoomNights: number;
  bookedRoomNights: number;
  occupancyRate: number; // 0..1
}

export async function getOccupancyReport(): Promise<OccupancyReport> {
  const today = todayUtc();
  const windowEnd = new Date(today.getTime() + REPORT_WINDOW_DAYS * 86_400_000);

  const [activeRoomCount, bookedNights] = await Promise.all([
    prisma.room.count({ where: { isActive: true } }),
    prisma.bookingNight.count({
      where: { stayDate: { gte: today, lt: windowEnd }, room: { isActive: true } },
    }),
  ]);

  const totalRoomNights = activeRoomCount * REPORT_WINDOW_DAYS;

  return {
    windowDays: REPORT_WINDOW_DAYS,
    totalRoomNights,
    bookedRoomNights: bookedNights,
    occupancyRate: totalRoomNights > 0 ? bookedNights / totalRoomNights : 0,
  };
}

export interface BookingVolumeReport {
  windowDays: number;
  createdCount: number;
  byStatus: Record<string, number>;
}

export async function getBookingVolumeReport(): Promise<BookingVolumeReport> {
  const since = new Date(Date.now() - REPORT_WINDOW_DAYS * 86_400_000);

  const bookings = await prisma.booking.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  const byStatus: Record<string, number> = {};
  let createdCount = 0;
  for (const row of bookings) {
    byStatus[row.status] = row._count._all;
    createdCount += row._count._all;
  }

  return { windowDays: REPORT_WINDOW_DAYS, createdCount, byStatus };
}

export interface RoomTypePerformance {
  roomTypeId: number;
  roomTypeName: string;
  bookingCount: number;
  revenueCents: number;
}

/** Bookings and collected revenue per room type, all-time — what's actually earning at the lodge. */
export async function getRoomTypePerformance(): Promise<RoomTypePerformance[]> {
  const roomTypes = await prisma.roomType.findMany({
    select: {
      id: true,
      name: true,
      rooms: {
        select: {
          bookings: {
            where: { status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } },
            select: {
              totalAmountCents: true,
              payments: { where: { status: "SUCCEEDED" }, select: { amountCents: true } },
            },
          },
        },
      },
    },
    orderBy: { basePriceCents: "asc" },
  });

  return roomTypes.map((rt) => {
    const bookings = rt.rooms.flatMap((room) => room.bookings);
    const revenueCents = bookings.reduce(
      (sum, booking) => sum + booking.payments.reduce((paidSum, p) => paidSum + p.amountCents, 0),
      0,
    );
    return { roomTypeId: rt.id, roomTypeName: rt.name, bookingCount: bookings.length, revenueCents };
  });
}
