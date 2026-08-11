import { describe, expect, it } from "vitest";
import {
  guestConfirmationEmail,
  guestPaymentFailedEmail,
  guestBookingExpiredEmail,
  staffPaidReservationEmail,
  type BookingEmailData,
  type PaymentEmailData,
} from "@/lib/email/templates";

const booking: BookingEmailData = {
  bookingReference: "KWZ-20260101-ABC123",
  guestFirstName: "Nomsa",
  guestLastName: "Dlamini",
  guestEmail: "nomsa@example.com",
  guestPhone: "+27 71 555 0100",
  guestCount: 2,
  roomTypeName: "Garden Suite",
  roomName: "Garden 1",
  checkIn: new Date("2026-08-10T00:00:00.000Z"),
  checkOut: new Date("2026-08-13T00:00:00.000Z"),
  nights: 3,
  totalAmountCents: 540000,
  currency: "ZAR",
};

const payment: PaymentEmailData = {
  amountCents: 540000,
  currency: "ZAR",
  providerReference: "pay_abc123",
  paidAt: new Date("2026-08-01T12:00:00.000Z"),
};

describe("guestConfirmationEmail", () => {
  it("includes the booking reference, guest name, and paid amount", () => {
    const { subject, html } = guestConfirmationEmail(booking, payment);
    expect(subject).toContain("KWZ-20260101-ABC123");
    expect(html).toContain("Nomsa");
    expect(html).toContain("R5,400");
    expect(html).toContain("Confirmed");
  });
});

describe("guestPaymentFailedEmail", () => {
  it("does not claim confirmation anywhere in the content", () => {
    const { subject, html } = guestPaymentFailedEmail(booking);
    expect(subject.toLowerCase()).not.toContain("confirmed");
    expect(html.toLowerCase()).not.toContain("confirmed");
    expect(html).toContain(booking.bookingReference);
  });
});

describe("guestBookingExpiredEmail", () => {
  it("clearly states the room was released", () => {
    const { html } = guestBookingExpiredEmail(booking);
    expect(html.toLowerCase()).toContain("released");
  });
});

describe("staffPaidReservationEmail", () => {
  it("has the required PAID RESERVATION subject format and includes guest contact details", () => {
    const { subject, html } = staffPaidReservationEmail(booking, payment);
    expect(subject).toMatch(/^PAID RESERVATION — KWZ-20260101-ABC123 — Nomsa Dlamini$/);
    expect(html).toContain(booking.guestEmail);
    expect(html).toContain(booking.guestPhone as string);
    expect(html).toContain("pay_abc123");
    expect(html).toContain("PAID");
    expect(html).toContain("CONFIRMED");
  });
});
