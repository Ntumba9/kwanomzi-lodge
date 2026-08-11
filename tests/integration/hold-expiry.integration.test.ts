import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expireStaleHolds } from "@/lib/services/BookingService";
import { createTestRoomWithType, createTestBooking } from "./helpers";

vi.mock("@/lib/services/EmailService", () => ({
  sendGuestConfirmationEmail: vi.fn(),
  sendGuestPaymentFailedEmail: vi.fn(),
  sendGuestBookingExpiredEmail: vi.fn(),
  sendStaffPaidReservationEmail: vi.fn(),
}));

import { sendGuestBookingExpiredEmail } from "@/lib/services/EmailService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expireStaleHolds", () => {
  it("expires a PAYMENT_PENDING booking past its hold and releases its BookingNight rows", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    // Force the hold into the past — createBooking always computes it from
    // the configured hold-minutes setting, so this simulates time passing.
    await prisma.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });

    const result = await expireStaleHolds();

    expect(result.bookingReferences).toContain(booking.bookingReference);
    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updated.status).toBe("EXPIRED");

    const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(0);

    expect(sendGuestBookingExpiredEmail).toHaveBeenCalledTimes(1);

    // The dates are free again — a new booking for the same room/dates now succeeds.
    const { createBooking } = await import("@/lib/services/BookingService");
    const rebooked = await createBooking({
      roomId: room.id,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      guestCount: 1,
      guest: { firstName: "New", lastName: "Guest", email: `rebooked-${Date.now()}@example.com`, phone: "+27 71 000 0000" },
    });
    expect(rebooked.status).toBe("PAYMENT_PENDING");
  });

  it("does not touch a PAYMENT_PENDING booking whose hold has not expired yet", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    const result = await expireStaleHolds();

    expect(result.bookingReferences).not.toContain(booking.bookingReference);
    const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(unchanged.status).toBe("PAYMENT_PENDING");
    expect(sendGuestBookingExpiredEmail).not.toHaveBeenCalled();
  });

  it("does not touch a CONFIRMED booking even with a past holdExpiresAt", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", holdExpiresAt: new Date(Date.now() - 60_000) },
    });

    await expireStaleHolds();

    const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(unchanged.status).toBe("CONFIRMED");
    const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(booking.nights);
  });
});
