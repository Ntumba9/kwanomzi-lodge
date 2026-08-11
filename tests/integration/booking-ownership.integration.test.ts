import { describe, expect, it } from "vitest";
import { findBookingForGuest } from "@/lib/services/BookingService";
import { createTestRoomWithType, createTestBooking, testGuestInput } from "./helpers";

describe("findBookingForGuest — the only guest-facing booking lookup (no guest accounts)", () => {
  it("returns the booking when reference and email both match", async () => {
    const { room } = await createTestRoomWithType();
    const guest = testGuestInput({ email: `owner-${Date.now()}@example.com` });
    const booking = await createTestBooking({ roomId: room.id, guest });

    const found = await findBookingForGuest(booking.bookingReference, guest.email);
    expect(found?.id).toBe(booking.id);
  });

  it("refuses to return the booking when the email does not match, even with a correct reference", async () => {
    const { room } = await createTestRoomWithType();
    const guest = testGuestInput({ email: `owner-${Date.now()}@example.com` });
    const booking = await createTestBooking({ roomId: room.id, guest });

    const found = await findBookingForGuest(booking.bookingReference, "someone-else@example.com");
    expect(found).toBeNull();
  });

  it("returns null for a nonexistent reference (not a distinguishable error from a wrong email)", async () => {
    const found = await findBookingForGuest("KWZ-NOTAREALREFERENCE", "anyone@example.com");
    expect(found).toBeNull();
  });

  it("email match is case-insensitive but still requires the correct address", async () => {
    const { room } = await createTestRoomWithType();
    const guest = testGuestInput({ email: `Mixed-Case-${Date.now()}@Example.com` });
    const booking = await createTestBooking({ roomId: room.id, guest });

    const found = await findBookingForGuest(booking.bookingReference, guest.email.toLowerCase());
    expect(found?.id).toBe(booking.id);
  });
});
