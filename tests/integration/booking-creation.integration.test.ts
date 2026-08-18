import { beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { createBooking } from "@/lib/services/BookingService";
import { findOrCreateGuest } from "@/lib/services/GuestService";
import { RoomNotAvailableError, InvalidDateRangeError, RoomNotFoundError } from "@/lib/errors";
import { createTestRoomWithType, testGuestInput } from "./helpers";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";

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

describe("room creation", () => {
  it("persists a room under a room type", async () => {
    const { room, roomType } = await createTestRoomWithType(150000);
    expect(room.roomTypeId).toBe(roomType.id);
    const found = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    expect(found.name).toBe(room.name);
  });
});

describe("guest creation", () => {
  it("creates a new guest when none matches the email", async () => {
    const input = testGuestInput();
    const guest = await findOrCreateGuest(input);
    expect(guest.email).toBe(input.email);
  });

  it("reuses an existing guest with the same email instead of duplicating", async () => {
    const input = testGuestInput();
    const first = await findOrCreateGuest(input);
    const second = await findOrCreateGuest({ ...input, firstName: "Different" });
    expect(second.id).toBe(first.id);
  });
});

describe("booking creation — happy path", () => {
  it("creates a PENDING booking with a correct money snapshot", async () => {
    const { room } = await createTestRoomWithType(180000);
    const booking = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(5),
      checkOut: daysFromNow(8),
      guest: testGuestInput(),
    });

    expect(booking.status).toBe("PENDING");
    expect(booking.nights).toBe(3);
    expect(booking.pricePerNightCents).toBe(180000);
    expect(booking.totalAmountCents).toBe(540000);
    expect(booking.bookingReference).toMatch(/^KWZ-\d{8}-/);

    const nights = await prisma.bookingNight.findMany({ where: { bookingId: booking.id } });
    expect(nights).toHaveLength(3);
  });

  it("uses the room's price override instead of the room type base price when set", async () => {
    const { roomType } = await createTestRoomWithType(100000);
    const room = await prisma.room.create({
      data: { roomTypeId: roomType.id, name: `Override Room ${Date.now()}`, priceOverrideCents: 250000 },
    });

    const booking = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(5),
      checkOut: daysFromNow(6),
      guest: testGuestInput(),
    });

    expect(booking.pricePerNightCents).toBe(250000);
  });

  it("rejects a booking for a nonexistent room", async () => {
    await expect(
      createBooking({
        roomId: 999_999_999,
        checkIn: daysFromNow(5),
        checkOut: daysFromNow(6),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(RoomNotFoundError);
  });
});

describe("booking creation — invalid dates", () => {
  it("rejects check-out before check-in", async () => {
    const { room } = await createTestRoomWithType();
    await expect(
      createBooking({
        roomId: room.id,
        checkIn: daysFromNow(10),
        checkOut: daysFromNow(5),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
  });

  it("rejects check-out equal to check-in", async () => {
    const { room } = await createTestRoomWithType();
    await expect(
      createBooking({
        roomId: room.id,
        checkIn: daysFromNow(5),
        checkOut: daysFromNow(5),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
  });

  it("rejects a check-in date in the past", async () => {
    const { room } = await createTestRoomWithType();
    await expect(
      createBooking({
        roomId: room.id,
        checkIn: daysFromNow(-2),
        checkOut: daysFromNow(2),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
  });
});

describe("booking creation — sequential overlap handling", () => {
  it("rejects a second booking that overlaps an existing one", async () => {
    const { room } = await createTestRoomWithType();
    await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(15),
      guest: testGuestInput(),
    });

    await expect(
      createBooking({
        roomId: room.id,
        checkIn: daysFromNow(13),
        checkOut: daysFromNow(17),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(RoomNotAvailableError);
  });

  it("allows a second booking for entirely different dates on the same room", async () => {
    const { room } = await createTestRoomWithType();
    await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(15),
      guest: testGuestInput(),
    });

    const second = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(40),
      checkOut: daysFromNow(45),
      guest: testGuestInput(),
    });
    expect(second.status).toBe("PENDING");
  });

  it("allows a booking that starts exactly on another booking's checkout day (adjacent, non-overlapping)", async () => {
    const { room } = await createTestRoomWithType();
    await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(15),
      guest: testGuestInput(),
    });

    const second = await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(15),
      checkOut: daysFromNow(18),
      guest: testGuestInput(),
    });
    expect(second.status).toBe("PENDING");

    const roomNights = await prisma.bookingNight.findMany({
      where: { roomId: room.id },
      orderBy: { stayDate: "asc" },
    });
    const dates = roomNights.map((n) => formatDateOnly(n.stayDate));
    // day 15 must appear exactly once (as booking A's last night is day 14,
    // not day 15 — booking B's first night IS day 15).
    expect(dates.filter((d) => d === formatDateOnly(parseDateOnly(daysFromNow(15))))).toHaveLength(1);
  });

  it("rejects a booking for different dates that still overlaps by one night at the boundary", async () => {
    const { room } = await createTestRoomWithType();
    await createBooking({
      roomId: room.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(15),
      guest: testGuestInput(),
    });

    // Ends on day 15, which A does NOT occupy (A's last night is day 14) —
    // but starts on day 14, which A DOES occupy. Must be rejected.
    await expect(
      createBooking({
        roomId: room.id,
        checkIn: daysFromNow(14),
        checkOut: daysFromNow(16),
        guest: testGuestInput(),
      }),
    ).rejects.toBeInstanceOf(RoomNotAvailableError);
  });
});
