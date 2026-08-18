import { beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { createBooking, transitionBooking } from "@/lib/services/BookingService";
import { InvalidStatusTransitionError } from "@/lib/errors";
import { createTestRoomWithType, testGuestInput } from "./helpers";
import { formatDateOnly } from "@/lib/dates";

let prisma: Awaited<ReturnType<typeof getPrisma>>;
beforeAll(async () => {
  prisma = await getPrisma();
});

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

describe("cancellation releases nights", () => {
  it("frees the room for the same dates after CANCELLED", async () => {
    const { room } = await createTestRoomWithType();
    const checkIn = daysFromNow(120);
    const checkOut = daysFromNow(123);

    const booking = await createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() });
    await transitionBooking(booking.id, "CANCELLED");

    const remainingNights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(remainingNights).toBe(0);

    // The same dates can now be booked again.
    const rebooked = await createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() });
    expect(rebooked.status).toBe("PENDING");
  });
});

describe("expiry releases nights", () => {
  it("frees the room for the same dates after EXPIRED", async () => {
    const { room } = await createTestRoomWithType();
    const checkIn = daysFromNow(130);
    const checkOut = daysFromNow(132);

    const booking = await createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() });
    await transitionBooking(booking.id, "EXPIRED");

    const remainingNights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(remainingNights).toBe(0);

    const rebooked = await createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() });
    expect(rebooked.status).toBe("PENDING");
  });
});

describe("checked-out bookings keep their occupancy history", () => {
  it("does not release nights on CHECKED_IN or CHECKED_OUT", async () => {
    const { room } = await createTestRoomWithType();
    const checkIn = daysFromNow(1);
    const checkOut = daysFromNow(3);

    const booking = await createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() });
    await transitionBooking(booking.id, "PAYMENT_PENDING");
    await transitionBooking(booking.id, "CONFIRMED");
    await transitionBooking(booking.id, "CHECKED_IN");

    let nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(2);

    await transitionBooking(booking.id, "CHECKED_OUT");

    nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(2);

    // And a future booking for the SAME dates is still correctly rejected,
    // because the completed stay's nights are still on the calendar.
    await expect(
      createBooking({ roomId: room.id, checkIn, checkOut, guest: testGuestInput() }),
    ).rejects.toThrow();
  });
});

describe("invalid status transitions", () => {
  it("rejects a transition not on the allow-list", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(200),
      checkOut: daysFromNow(202),
      guest: testGuestInput(),
    });

    await expect(transitionBooking(booking.id, "CHECKED_OUT")).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );

    const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("rejects transitioning out of a terminal state", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(210),
      checkOut: daysFromNow(212),
      guest: testGuestInput(),
    });
    await transitionBooking(booking.id, "CANCELLED");

    await expect(transitionBooking(booking.id, "PENDING")).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );
  });
});
