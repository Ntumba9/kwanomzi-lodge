import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { processYocoWebhook } from "@/lib/services/WebhookService";
import {
  createTestRoomWithType,
  createTestBooking,
  createTestPayment,
  buildSignedWebhookRequest,
  yocoPaymentSucceededPayload,
  yocoPaymentFailedPayload,
} from "./helpers";

vi.mock("@/lib/services/EmailService", () => ({
  sendGuestConfirmationEmail: vi.fn(),
  sendGuestPaymentFailedEmail: vi.fn(),
  sendGuestBookingExpiredEmail: vi.fn(),
  sendStaffPaidReservationEmail: vi.fn(),
}));

import {
  sendGuestConfirmationEmail,
  sendGuestPaymentFailedEmail,
  sendStaffPaidReservationEmail,
} from "@/lib/services/EmailService";

beforeEach(() => {
  vi.clearAllMocks();
});

async function setupPendingBookingWithPayment(amountOverride?: number) {
  const { room } = await createTestRoomWithType(150000);
  const booking = await createTestBooking({ roomId: room.id });
  const payment = await createTestPayment(booking.id, { amountCents: amountOverride });
  return { room, booking, payment };
}

describe("webhook: successful payment", () => {
  it("confirms the booking, marks the payment paid, and sends exactly one guest + one staff email", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();

    const { rawBody, headers } = buildSignedWebhookRequest(
      yocoPaymentSucceededPayload({
        eventId: `evt_${payment.id}`,
        paymentId: `pay_${payment.id}`,
        amountCents: booking.totalAmountCents,
        bookingId: booking.id,
        internalPaymentId: payment.id,
      }),
    );

    const outcome = await processYocoWebhook(rawBody, headers);
    expect(outcome.result).toBe("confirmed");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("CONFIRMED");

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("SUCCEEDED");
    expect(updatedPayment.paidAt).not.toBeNull();
    expect(updatedPayment.providerReference).toBe(`pay_${payment.id}`);

    expect(sendGuestConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendStaffPaidReservationEmail).toHaveBeenCalledTimes(1);
    expect(sendGuestPaymentFailedEmail).not.toHaveBeenCalled();

    // BookingNight rows must survive confirmation untouched.
    const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(booking.nights);
  });
});

describe("webhook: failed payment", () => {
  it("marks the payment failed, leaves the booking PAYMENT_PENDING, and sends exactly one payment-failed email", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();

    const { rawBody, headers } = buildSignedWebhookRequest(
      yocoPaymentFailedPayload({
        eventId: `evt_${payment.id}`,
        paymentId: `pay_${payment.id}`,
        amountCents: booking.totalAmountCents,
        bookingId: booking.id,
        internalPaymentId: payment.id,
      }),
    );

    const outcome = await processYocoWebhook(rawBody, headers);
    expect(outcome.result).toBe("payment_failed");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("PAYMENT_PENDING");

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("FAILED");

    expect(sendGuestPaymentFailedEmail).toHaveBeenCalledTimes(1);
    expect(sendGuestConfirmationEmail).not.toHaveBeenCalled();
    expect(sendStaffPaidReservationEmail).not.toHaveBeenCalled();

    // Room is still held for retry — nights are not released on a failed attempt.
    const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    expect(nights).toBe(booking.nights);
  });
});

describe("webhook: duplicate delivery", () => {
  it("processes a repeated event exactly once — no duplicate payment mutation, no duplicate emails", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();
    const payload = yocoPaymentSucceededPayload({
      eventId: `evt_${payment.id}`,
      paymentId: `pay_${payment.id}`,
      amountCents: booking.totalAmountCents,
      bookingId: booking.id,
      internalPaymentId: payment.id,
    });

    const first = buildSignedWebhookRequest(payload);
    const firstOutcome = await processYocoWebhook(first.rawBody, first.headers);
    expect(firstOutcome.result).toBe("confirmed");

    // A genuine retry: Yoco resends the exact same event id.
    const second = buildSignedWebhookRequest(payload);
    const secondOutcome = await processYocoWebhook(second.rawBody, second.headers);
    expect(secondOutcome.result).toBe("duplicate");

    expect(sendGuestConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendStaffPaidReservationEmail).toHaveBeenCalledTimes(1);

    const payments = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(1);

    const events = await prisma.webhookEvent.findMany({ where: { eventId: payload.id } });
    expect(events).toHaveLength(1);
  });
});

describe("webhook: invalid signature", () => {
  it("rejects the request and makes no database changes", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();
    const payload = yocoPaymentSucceededPayload({
      eventId: `evt_${payment.id}`,
      paymentId: `pay_${payment.id}`,
      amountCents: booking.totalAmountCents,
      bookingId: booking.id,
      internalPaymentId: payment.id,
    });
    const { rawBody, headers } = buildSignedWebhookRequest(payload);

    const tamperedHeaders = { ...headers, webhookSignature: "v1,not-a-real-signature" };
    const outcome = await processYocoWebhook(rawBody, tamperedHeaders);
    expect(outcome.result).toBe("invalid_signature");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("PAYMENT_PENDING");
    const events = await prisma.webhookEvent.findMany({ where: { eventId: payload.id } });
    expect(events).toHaveLength(0);
    expect(sendGuestConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe("webhook: amount mismatch", () => {
  it("does not confirm the booking and records the discrepancy", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();

    const { rawBody, headers } = buildSignedWebhookRequest(
      yocoPaymentSucceededPayload({
        eventId: `evt_${payment.id}`,
        paymentId: `pay_${payment.id}`,
        amountCents: booking.totalAmountCents - 1, // one cent short
        bookingId: booking.id,
        internalPaymentId: payment.id,
      }),
    );

    const outcome = await processYocoWebhook(rawBody, headers);
    expect(outcome.result).toBe("amount_mismatch");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("PAYMENT_PENDING");
    expect(sendGuestConfirmationEmail).not.toHaveBeenCalled();

    const audit = await prisma.auditLog.findFirst({ where: { action: "PAYMENT_AMOUNT_MISMATCH", entityId: String(booking.id) } });
    expect(audit).not.toBeNull();
  });
});

describe("webhook: payment succeeds after the booking already expired", () => {
  it("does not re-confirm the booking and logs it for manual review", async () => {
    const { booking, payment } = await setupPendingBookingWithPayment();

    // Simulate the hold-expiry sweep having already run before this (late)
    // webhook arrives.
    await prisma.$transaction([
      prisma.bookingNight.deleteMany({ where: { bookingId: booking.id } }),
      prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } }),
    ]);

    const { rawBody, headers } = buildSignedWebhookRequest(
      yocoPaymentSucceededPayload({
        eventId: `evt_${payment.id}`,
        paymentId: `pay_${payment.id}`,
        amountCents: booking.totalAmountCents,
        bookingId: booking.id,
        internalPaymentId: payment.id,
      }),
    );

    const outcome = await processYocoWebhook(rawBody, headers);
    expect(outcome.result).toBe("stale_booking");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("EXPIRED"); // not silently re-confirmed
    expect(sendGuestConfirmationEmail).not.toHaveBeenCalled();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "PAYMENT_SUCCEEDED_AFTER_BOOKING_NO_LONGER_PENDING", entityId: String(booking.id) },
    });
    expect(audit).not.toBeNull();
  });
});

describe("webhook: unmatched payment metadata", () => {
  it("is handled without throwing when metadata references a nonexistent payment", async () => {
    const { rawBody, headers } = buildSignedWebhookRequest(
      yocoPaymentSucceededPayload({
        eventId: "evt_unmatched",
        paymentId: "pay_unmatched",
        amountCents: 10000,
        bookingId: 999_999_999,
        internalPaymentId: 999_999_999,
      }),
    );

    const outcome = await processYocoWebhook(rawBody, headers);
    expect(outcome.result).toBe("unmatched_payment");
  });
});
