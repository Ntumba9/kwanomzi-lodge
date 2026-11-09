import { getPrisma } from "@/lib/db/prisma";
import { fetchYocoCheckout } from "@/lib/yoco/checkoutApi";
import { sendGuestConfirmationEmail, sendStaffPaidReservationEmail } from "@/lib/services/EmailService";
import { toBookingEmailData } from "@/lib/email/mappers";
import type { PaymentEmailData } from "@/lib/email/templates";

export interface ReconciliationResult {
  confirmed: string[];
  flaggedDuplicates: number;
  stillPending: number;
}

/**
 * Safety net, not the primary confirmation path — the webhook
 * (app/api/webhooks/yoco) should normally confirm payments in real time.
 * This exists because that path depends on a Yoco Application API key that
 * has an unresolved permission problem (see WebhookService.ts), and because
 * a Checkout API payment can sit in "processing" for a long time before
 * settling one way or the other. Run on a schedule (see
 * app/api/internal/reconcile-payments/route.ts), it re-checks every booking
 * still sitting at PAYMENT_PENDING directly against the Checkout API — which
 * has worked reliably throughout this incident — and confirms anything that
 * actually succeeded, so a payment can land even if the webhook never does.
 */
export async function reconcilePendingPayments(): Promise<ReconciliationResult> {
  const prisma = await getPrisma();

  const pendingBookings = await prisma.booking.findMany({
    where: { status: "PAYMENT_PENDING" },
    include: {
      guest: true,
      room: { include: { roomType: true } },
      payments: { where: { status: "PENDING" } },
    },
  });

  const confirmed: string[] = [];
  let flaggedDuplicates = 0;
  let stillPending = 0;

  for (const booking of pendingBookings) {
    for (const payment of booking.payments) {
      if (!payment.providerReference) {
        stillPending++;
        continue;
      }
      let checkout;
      try {
        checkout = await fetchYocoCheckout(payment.providerReference);
      } catch (err) {
        console.error(`Reconciliation: checkout fetch failed for payment #${payment.id}:`, err);
        continue;
      }

      if (!checkout || checkout.status !== "completed") {
        stillPending++;
        continue;
      }

      // Re-read fresh — a prior payment earlier in this same loop, the
      // webhook, or a manual fix may have already confirmed this booking.
      const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
      if (!fresh || fresh.status !== "PAYMENT_PENDING") {
        // A real successful charge with nothing left to confirm — e.g. a
        // guest paying twice after the site incorrectly showed "pending".
        // Never silently drop this; it needs a human to refund it.
        await prisma.auditLog.create({
          data: {
            action: "PAYMENT_SUCCEEDED_AFTER_BOOKING_NO_LONGER_PENDING",
            entityType: "Booking",
            entityId: String(booking.id),
            metadata: { paymentId: payment.id, checkoutId: payment.providerReference, bookingStatus: fresh?.status ?? "unknown" },
          },
        });
        flaggedDuplicates++;
        continue;
      }

      if (checkout.amount !== booking.totalAmountCents || checkout.currency !== booking.currency) {
        await prisma.auditLog.create({
          data: {
            action: "PAYMENT_AMOUNT_MISMATCH",
            entityType: "Booking",
            entityId: String(booking.id),
            metadata: {
              expectedCents: booking.totalAmountCents,
              expectedCurrency: booking.currency,
              reportedCents: checkout.amount,
              reportedCurrency: checkout.currency,
              paymentId: payment.id,
            },
          },
        });
        continue;
      }

      const paidAt = new Date();
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCEEDED", paidAt, providerReference: checkout.paymentId },
        }),
        prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } }),
        prisma.auditLog.create({
          data: {
            action: "PAYMENT_RECONCILED_VIA_SWEEP",
            entityType: "Booking",
            entityId: String(booking.id),
            metadata: { paymentId: payment.id, checkoutId: payment.providerReference, yocoPaymentId: checkout.paymentId },
          },
        }),
      ]);

      const emailBooking = toBookingEmailData(booking);
      const emailPayment: PaymentEmailData = {
        amountCents: checkout.amount,
        currency: checkout.currency,
        providerReference: checkout.paymentId,
        paidAt,
      };
      await safelySendEmail(() => sendGuestConfirmationEmail(emailBooking, emailPayment));
      await safelySendEmail(() => sendStaffPaidReservationEmail(emailBooking, emailPayment));

      confirmed.push(booking.bookingReference);
      break; // booking is confirmed now — any other PENDING payment on it is handled above as a duplicate, not a second confirmation.
    }
  }

  return { confirmed, flaggedDuplicates, stillPending };
}

async function safelySendEmail(send: () => Promise<void>) {
  try {
    await send();
  } catch (err) {
    console.error("Email send failed (payment/booking state already committed):", err);
  }
}
