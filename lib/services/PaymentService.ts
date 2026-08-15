import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma, type PaymentStatus } from "@/lib/generated/prisma/client";
import { BookingNotFoundError, PaymentNotAllowedError, ServiceNotConfiguredError } from "@/lib/errors";

const YOCO_CHECKOUT_URL = "https://payments.yoco.com/api/checkouts";

export interface CheckoutResult {
  paymentId: number;
  checkoutId: string;
  redirectUrl: string;
}

/**
 * Creates a Yoco Checkout for a PAYMENT_PENDING booking, using the amount
 * already stored on the booking (never a client-supplied figure — see
 * BookingService.createBooking, which computes totalAmountCents server-side
 * at booking creation).
 *
 * We deliberately point successUrl/cancelUrl/failureUrl at the SAME
 * confirmation page. The browser redirect is never authoritative for
 * payment status (the webhook is — see app/api/webhooks/yoco), so there's
 * no reason for the three URLs to differ: whichever one Yoco redirects to,
 * the confirmation page renders whatever the database actually says at
 * that moment, which is correct regardless of which URL got hit.
 */
export async function initiateCheckout(bookingId: number): Promise<CheckoutResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { guest: true } });
  if (!booking) {
    throw new BookingNotFoundError();
  }
  if (booking.status !== "PAYMENT_PENDING") {
    throw new PaymentNotAllowedError(
      `Booking ${booking.bookingReference} is ${booking.status}, not PAYMENT_PENDING — a checkout cannot be created for it.`,
    );
  }

  const secretKey = process.env.YOCO_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceNotConfiguredError(
      "YOCO_SECRET_KEY is not configured — online payment is unavailable until it's set. See .env.example.",
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new ServiceNotConfiguredError("NEXT_PUBLIC_APP_URL is not configured — see .env.example.");
  }

  // Created before calling Yoco so we have our own row id to embed in the
  // checkout's metadata — that id, not providerReference, is what the
  // webhook uses to find the exact Payment row unambiguously (a booking can
  // have multiple payment attempts if an earlier one failed and the guest
  // retried).
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: "yoco",
      amountCents: booking.totalAmountCents,
      currency: booking.currency,
      status: "INITIATED",
    },
  });

  const returnUrl = `${appUrl}/book/${booking.bookingReference}?email=${encodeURIComponent(booking.guest.email)}`;

  let response: Response;
  try {
    response = await fetch(YOCO_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        amount: booking.totalAmountCents,
        currency: booking.currency,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
        failureUrl: returnUrl,
        metadata: {
          bookingId: String(booking.id),
          paymentId: String(payment.id),
          bookingReference: booking.bookingReference,
        },
      }),
    });
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ServiceNotConfiguredError(
      `Could not reach Yoco to create a checkout: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    const bodyText = await response.text().catch(() => "");
    throw new ServiceNotConfiguredError(`Yoco checkout creation failed (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  const checkout = (await response.json()) as { id: string; redirectUrl: string };

  await prisma.payment.update({
    where: { id: payment.id },
    // The checkout id is the only provider reference we have at this point;
    // the webhook handler overwrites this with the actual payment id once
    // a payment succeeds (see app/api/webhooks/yoco) — that's the more
    // meaningful reference for reconciliation once it exists.
    data: { providerReference: checkout.id, status: "PENDING" },
  });

  return { paymentId: payment.id, checkoutId: checkout.id, redirectUrl: checkout.redirectUrl };
}

export interface RevenueSummary {
  totalRevenueCents: number;
  todayRevenueCents: number;
  weekRevenueCents: number;
  monthRevenueCents: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  currency: string;
}

/**
 * Read-only reporting for the staff dashboard/reports. Revenue is defined as
 * Payment.status === "SUCCEEDED" — never inferred from Booking.status, since
 * a booking can be CONFIRMED while its Payment row is the actual record of
 * what was collected (see WebhookService, the only place SUCCEEDED is set).
 * Assumes a single currency (ZAR, the app-wide default) for the sum, which
 * holds for every payment this app has ever created. "Pending" here means
 * PaymentService's own INITIATED/PENDING states — a payment attempt that
 * hasn't resolved either way yet.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000); // last 7 days inclusive of today
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [totalResult, todayResult, weekResult, monthResult, paidCount, pendingCount, failedCount] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: todayStart } }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: weekStart } }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    prisma.payment.count({ where: { status: "SUCCEEDED" } }),
    prisma.payment.count({ where: { status: { in: ["INITIATED", "PENDING"] } } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
  ]);

  return {
    totalRevenueCents: totalResult._sum.amountCents ?? 0,
    todayRevenueCents: todayResult._sum.amountCents ?? 0,
    weekRevenueCents: weekResult._sum.amountCents ?? 0,
    monthRevenueCents: monthResult._sum.amountCents ?? 0,
    paidCount,
    pendingCount,
    failedCount,
    currency: "ZAR",
  };
}

const paymentListInclude = {
  booking: { include: { guest: true, room: { include: { roomType: true } } } },
} satisfies Prisma.PaymentInclude;

export interface ListPaymentsFilters {
  status?: PaymentStatus;
}

/** Full payment ledger for /staff/payments — never exposes provider secrets, only what's already in the Payment row. */
export function listPayments(filters: ListPaymentsFilters = {}) {
  return prisma.payment.findMany({
    where: { status: filters.status },
    include: paymentListInclude,
    orderBy: { createdAt: "desc" },
  });
}
