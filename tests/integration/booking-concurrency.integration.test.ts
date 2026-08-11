import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createBooking } from "@/lib/services/BookingService";
import { RoomNotAvailableError } from "@/lib/errors";
import { createTestRoomWithType, testGuestInput } from "./helpers";
import { formatDateOnly } from "@/lib/dates";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

/**
 * THE critical test for the whole Phase 2 architecture: fires multiple
 * genuinely concurrent booking attempts at a real MySQL database for the
 * same room and overlapping dates, and proves the UNIQUE(room_id,
 * stay_date) constraint on BookingNight is what actually decides the
 * outcome — not application-level timing.
 */
describe("concurrent competing booking attempts — same room, overlapping dates", () => {
  it("lets exactly one attempt win and rejects the rest with RoomNotAvailableError", async () => {
    const { room } = await createTestRoomWithType();
    const checkIn = daysFromNow(60);
    const checkOut = daysFromNow(65);
    const CONCURRENT_ATTEMPTS = 8;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_ATTEMPTS }, () =>
        createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(CONCURRENT_ATTEMPTS - 1);

    for (const r of rejected) {
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(RoomNotAvailableError);
      }
    }

    // Only the winner's booking exists for this room+date range.
    const bookingsForRoom = await prisma.booking.findMany({ where: { roomId: room.id } });
    expect(bookingsForRoom).toHaveLength(1);

    // Only the winner's nights are claimed — no orphaned rows from any of
    // the losing attempts (their whole transaction, Booking row included,
    // rolled back on conflict).
    const nightsForRoom = await prisma.bookingNight.findMany({ where: { roomId: room.id } });
    expect(nightsForRoom).toHaveLength(5); // 60→65 = 5 nights

    // Every Booking row that exists has a complete, matching set of
    // BookingNight rows — proof no failed attempt left a partial record.
    for (const booking of bookingsForRoom) {
      const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
      expect(nights).toBe(booking.nights);
    }
  });

  it("still lets exactly one win when attempts only partially overlap each other", async () => {
    const { room } = await createTestRoomWithType();
    // Each attempt below shares at least one night with the next, so no two
    // can both succeed, even though no two requests target identical dates.
    const attempts = [
      { checkIn: daysFromNow(80), checkOut: daysFromNow(85) },
      { checkIn: daysFromNow(82), checkOut: daysFromNow(87) },
      { checkIn: daysFromNow(84), checkOut: daysFromNow(89) },
    ];

    const results = await Promise.allSettled(
      attempts.map((dates) =>
        createBooking({ roomId: room.id, ...dates, guest: testGuestInput() }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(attempts.length - 1);

    const bookingsForRoom = await prisma.booking.findMany({ where: { roomId: room.id } });
    expect(bookingsForRoom).toHaveLength(1);
  });
});

describe("concurrent booking attempts for different rooms", () => {
  it("lets all of them succeed — no false contention across unrelated rooms", async () => {
    const { roomType } = await createTestRoomWithType();
    const rooms = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.room.create({ data: { roomTypeId: roomType.id, name: `Concurrency Room ${Date.now()}-${i}` } }),
      ),
    );
    const checkIn = daysFromNow(100);
    const checkOut = daysFromNow(103);

    const results = await Promise.allSettled(
      rooms.map((room) => createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() })),
    );

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
