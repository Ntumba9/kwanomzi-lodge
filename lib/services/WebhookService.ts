import { getPrisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { verifyYocoWebhookSignature, type YocoWebhookHeaders } from "@/lib/yoco/webhookSignature";
import { fetchYocoOrder, type YocoOrderPayment } from "@/lib/yoco/ordersApi";
import {
  sendGuestConfirmationEmail,
  sendStaffPaidReservationEmail,
} from "@/lib/services/EmailService";
import { toBookingEmailData } from "@/lib/email/mappers";
import type { PaymentEmailData } from "@/lib/email/templates";

/**
 * Yoco's Application-webhooks event body (Standard Webhooks envelope).
 * Deliberately thin — unlike the Checkout API's documented (but, verified
 * directly, non-functional for registration) webhook format, this carries
 * no amount/currency/metadata of its own. Those are only available by
 * calling back to GET /v1/orders/:order_id (see lib/yoco/ordersApi.ts) —
 * see this file's header comment in git history / the Phase 4 follow-up
 * report for how that was discovered.
 */
interface YocoOrderEventBody {
  business_id: string;
  event_type: string;
  order_id: string;
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

/**
 * Entry point for POST /api/webhooks/yoco. Owns the full flow — signature
 * verification, idempotency, the order lookup, amount validation, the
 * confirming transaction, and triggering post-commit emails — so the route
 * handler itself stays a thin HTTP adapter (parse request -> call this ->
 * map result to a status code), per the project's route -> validation ->
 * service -> Prisma rule.
 */
export async function processYocoWebhook(rawBody: string, headers: YocoWebhookHeaders): Promise<WebhookOutcome> {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret || !verifyYocoWebhookSignature(headers, rawBody, secret)) {
    return { result: "invalid_signature" };
  }

  let event: YocoOrderEventBody;
  try {
    event = JSON.parse(rawBody) as YocoOrderEventBody;
  } catch {
    return { result: "malformed" };
  }
  if (!event?.event_type || !event.order_id) {
    return { result: "malformed" };
  }

  // This event body carries no id of its own (unlike the old Checkout API
  // format) — the Standard Webhooks delivery id (the webhook-id header,
  // already verified as genuinely from Yoco above) is the only unique
  // identifier available, so it's what the idempotency gate keys on.
  const deliveryId = headers.webhookId;
  if (!deliveryId) {
    return { result: "malformed" };
  }

  const prisma = await getPrisma();

  // The idempotency gate: a second delivery of the same webhook-id fails
  // this unique insert and we return before touching anything else — the
  // same pattern BookingNight uses for double-booking prevention (see
  // schema.prisma), applied here to webhook dedup.
  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { provider: "yoco", eventId: deliveryId, eventType: event.event_type, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    if (isDuplicateEventId(err)) return { result: "duplicate" };
    throw err;
  }

  if (event.event_type !== "order.completed") {
    // Includes order.created/order.updated/order.cancelled and anything
    // future — acknowledged, not treated as an error, never left stuck as
    // RECEIVED forever. A cancelled/abandoned checkout simply never
    // reaches order.completed; the existing hold-expiry sweep (see
    // BookingService.expireStaleHolds) is what releases those rooms, not
    // this webhook.
    await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
    return { result: "ignored_event_type" };
  }

  return handleOrderCompleted(webhookEvent.id, event.order_id);
}

async function handleOrderCompleted(webhookEventId: number, orderId: string): Promise<WebhookOutcome> {
  const prisma = await getPrisma();

  const order = await fetchYocoOrder(orderId);
  if (!order) {
    await markEventFailed(webhookEventId);
    await prisma.auditLog.create({
      data: {
        action: "WEBHOOK_ORDER_NOT_FOUND",
        entityType: "WebhookEvent",
        entityId: String(webhookEventId),
        metadata: { orderId },
      },
    });
    return { result: "unmatched_payment" };
  }

  // This Yoco account also runs the client's unrelated coffee shop — an
  // order's payments here are only ours if one of them was created by our
  // own checkout flow. PaymentService.initiateCheckout stores the Yoco
  // checkout id as Payment.providerReference at creation time (before any
  // webhook exists), so matching on that is the actual linking mechanism;
  // nothing in this payload is "ours" by default.
  for (const yocoPayment of order.payments) {
    if (yocoPayment.status !== "approved") continue;

    const payment = await prisma.payment.findUnique({
      where: { providerReference: yocoPayment.checkout_id },
      include: { booking: { include: { guest: true, room: { include: { roomType: true } } } } },
    });
    if (!payment) continue; // not a checkout this app created — e.g. the coffee shop, or a payment link

    return confirmBookingPayment(webhookEventId, payment, yocoPayment);
  }

  // No payment on this order matched any Payment row we created — either
  // unrelated account activity, or (defensively) a race where the webhook
  // arrived before the checkout's own response finished writing
  // providerReference. Either way this needs a human, not a silent drop.
  await markEventFailed(webhookEventId);
  await prisma.auditLog.create({
    data: {
      action: "WEBHOOK_UNMATCHED_PAYMENT",
      entityType: "WebhookEvent",
      entityId: String(webhookEventId),
      metadata: { orderId, checkoutIds: order.payments.map((p) => p.checkout_id) },
    },
  });
  return { result: "unmatched_payment" };
}

type PaymentWithBooking = Prisma.PaymentGetPayload<{
  include: { booking: { include: { guest: true; room: { include: { roomType: true } } } } };
}>;

async function confirmBookingPayment(
  webhookEventId: number,
  payment: PaymentWithBooking,
  yocoPayment: YocoOrderPayment,
): Promise<WebhookOutcome> {
  const booking = payment.booking;
  const prisma = await getPrisma();

  if (yocoPayment.total_amount.amount !== booking.totalAmountCents || yocoPayment.total_amount.currency !== booking.currency) {
    await markEventFailed(webhookEventId);
    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_AMOUNT_MISMATCH",
        entityType: "Booking",
        entityId: String(booking.id),
        metadata: {
          expectedCents: booking.totalAmountCents,
          expectedCurrency: booking.currency,
          reportedCents: yocoPayment.total_amount.amount,
          reportedCurrency: yocoPayment.total_amount.currency,
          paymentId: payment.id,
        },
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
        metadata: { bookingStatus: booking.status, paymentId: payment.id, yocoPaymentId: yocoPayment.id },
      },
    });
    return { result: "stale_booking" };
  }

  const paidAt = new Date();
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      // Replace providerReference (the checkout id used for matching) with
      // the actual Yoco payment id — the more meaningful reference for
      // reconciliation once a real payment exists, same precedent as
      // before this rewrite.
      data: { status: "SUCCEEDED", paidAt, providerReference: yocoPayment.id },
    }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } }),
  ]);
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id },
  });

  const emailBooking = toBookingEmailData(booking);
  const emailPayment: PaymentEmailData = {
    amountCents: yocoPayment.total_amount.amount,
    currency: yocoPayment.total_amount.currency,
    providerReference: yocoPayment.id,
    paidAt,
  };
  await safelySendEmail(() => sendGuestConfirmationEmail(emailBooking, emailPayment));
  await safelySendEmail(() => sendStaffPaidReservationEmail(emailBooking, emailPayment));

  return { result: "confirmed" };
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
