import { getPrisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { verifyYocoWebhookSignature, type YocoWebhookHeaders } from "@/lib/yoco/webhookSignature";
import {
  sendGuestConfirmationEmail,
  sendGuestPaymentFailedEmail,
  sendStaffPaidReservationEmail,
} from "@/lib/services/EmailService";
import { toBookingEmailData } from "@/lib/email/mappers";
import type { PaymentEmailData } from "@/lib/email/templates";

interface YocoPaymentPayload {
  id: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
}

interface YocoWebhookBody {
  id: string;
  type: string;
  payload: YocoPaymentPayload;
}

export type WebhookOutcome =
  | { result: "invalid_signature" }
  | { result: "duplicate" }
  | { result: "malformed" }
  | { result: "unmatched_payment" }
  | { result: "amount_mismatch" }
  | { result: "stale_booking" }
  | { result: "confirmed" }
  | { result: "payment_failed" }
  | { result: "ignored_event_type" };

const paymentWithBookingInclude = {
  booking: { include: { guest: true, room: { include: { roomType: true } } } },
} satisfies Prisma.PaymentInclude;

/**
 * Entry point for POST /api/webhooks/yoco. Owns the full flow — signature
 * verification, idempotency, amount validation, the confirming transaction,
 * and triggering post-commit emails — so the route handler itself stays a
 * thin HTTP adapter (parse request -> call this -> map result to a status
 * code), per the project's route -> validation -> service -> Prisma rule.
 */
export async function processYocoWebhook(rawBody: string, headers: YocoWebhookHeaders): Promise<WebhookOutcome> {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret || !verifyYocoWebhookSignature(headers, rawBody, secret)) {
    return { result: "invalid_signature" };
  }

  let event: YocoWebhookBody;
  try {
    event = JSON.parse(rawBody) as YocoWebhookBody;
  } catch {
    return { result: "malformed" };
  }
  if (!event?.id || !event.type || !event.payload) {
    return { result: "malformed" };
  }

  const prisma = await getPrisma();

  // The idempotency gate: a second delivery of the same event id fails this
  // unique insert and we return before touching anything else — the same
  // pattern BookingNight uses for double-booking prevention (see
  // schema.prisma), applied here to webhook dedup.
  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { provider: "yoco", eventId: event.id, eventType: event.type, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    if (isDuplicateEventId(err)) return { result: "duplicate" };
    throw err;
  }

  const paymentIdRaw = event.payload.metadata?.paymentId;
  const bookingIdRaw = event.payload.metadata?.bookingId;
  const paymentId = paymentIdRaw ? Number(paymentIdRaw) : NaN;

  const payment = Number.isFinite(paymentId)
    ? await prisma.payment.findUnique({ where: { id: paymentId }, include: paymentWithBookingInclude })
    : null;

  if (!payment || String(payment.bookingId) !== String(bookingIdRaw)) {
    await markEventFailed(webhookEvent.id);
    await prisma.auditLog.create({
      data: {
        action: "WEBHOOK_UNMATCHED_PAYMENT",
        entityType: "WebhookEvent",
        entityId: String(webhookEvent.id),
        metadata: { eventId: event.id, paymentIdRaw: paymentIdRaw ?? null, bookingIdRaw: bookingIdRaw ?? null },
      },
    });
    return { result: "unmatched_payment" };
  }

  if (event.type === "payment.succeeded") {
    return handlePaymentSucceeded(webhookEvent.id, payment, event.payload);
  }
  if (event.type === "payment.failed") {
    return handlePaymentFailed(webhookEvent.id, payment);
  }

  // A future Yoco event type we don't yet handle — acknowledge, don't error,
  // don't leave it stuck as RECEIVED forever.
  await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
  return { result: "ignored_event_type" };
}

async function handlePaymentSucceeded(
  webhookEventId: number,
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentWithBookingInclude }>,
  payload: YocoPaymentPayload,
): Promise<WebhookOutcome> {
  const booking = payment.booking;
  const prisma = await getPrisma();

  if (payload.amount !== booking.totalAmountCents) {
    await markEventFailed(webhookEventId);
    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_AMOUNT_MISMATCH",
        entityType: "Booking",
        entityId: String(booking.id),
        metadata: { expectedCents: booking.totalAmountCents, reportedCents: payload.amount, paymentId: payment.id },
      },
    });
    return { result: "amount_mismatch" };
  }

  if (booking.status !== "PAYMENT_PENDING") {
    // Either already CONFIRMED (a genuine duplicate that somehow reached
    // here — safe no-op) or EXPIRED/CANCELLED (payment arrived after the
    // hold was already released — the nights may belong to someone else
    // now, so we do NOT silently re-confirm). Either way this needs a human,
    // not an automatic decision.
    await markEventFailed(webhookEventId);
    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_SUCCEEDED_AFTER_BOOKING_NO_LONGER_PENDING",
        entityType: "Booking",
        entityId: String(booking.id),
        metadata: { bookingStatus: booking.status, paymentId: payment.id, yocoPaymentId: payload.id },
      },
    });
    return { result: "stale_booking" };
  }

  const paidAt = new Date();
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", paidAt, providerReference: payload.id },
    }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } }),
  ]);
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id },
  });

  const emailBooking = toBookingEmailData(booking);
  const emailPayment: PaymentEmailData = {
    amountCents: payload.amount,
    currency: payment.currency,
    providerReference: payload.id,
    paidAt,
  };
  await safelySendEmail(() => sendGuestConfirmationEmail(emailBooking, emailPayment));
  await safelySendEmail(() => sendStaffPaidReservationEmail(emailBooking, emailPayment));

  return { result: "confirmed" };
}

async function handlePaymentFailed(
  webhookEventId: number,
  payment: Prisma.PaymentGetPayload<{ include: typeof paymentWithBookingInclude }>,
): Promise<WebhookOutcome> {
  const prisma = await getPrisma();
  // Booking deliberately stays PAYMENT_PENDING — a failed attempt is
  // retryable until the hold actually expires (see ALLOWED_TRANSITIONS in
  // BookingService and the Phase 4 plan's decision on this).
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id },
  });

  await safelySendEmail(() => sendGuestPaymentFailedEmail(toBookingEmailData(payment.booking)));

  return { result: "payment_failed" };
}

/**
 * Email delivery failures are logged, never thrown — the payment/booking
 * state is already correctly committed at this point, and there is no
 * scheduler infrastructure yet to retry a failed send (documented as a
 * known gap in the Phase 4 report). Letting this throw would make Yoco
 * retry the whole webhook, which the eventId uniqueness check would then
 * reject as a duplicate anyway — retrying would not fix a broken email
 * and would just mask that the payment/booking side already succeeded.
 */
async function safelySendEmail(send: () => Promise<void>) {
  try {
    await send();
  } catch (err) {
    console.error("Email send failed (payment/booking state already committed):", err);
  }
}

async function markEventFailed(webhookEventId: number) {
  const prisma = await getPrisma();
  await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { status: "FAILED", processedAt: new Date() } });
}

function isDuplicateEventId(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
