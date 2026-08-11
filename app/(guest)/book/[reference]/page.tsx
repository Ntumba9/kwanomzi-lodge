import Link from "next/link";
import { findBookingForGuest } from "@/lib/services/BookingService";
import { formatDateDisplay, formatMoney } from "@/lib/format";
import { BookingSummary } from "@/components/BookingSummary";
import { RetryPaymentButton } from "./RetryPaymentButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps<"/book/[reference]">) {
  const { reference } = await params;
  const { email } = await searchParams;
  const emailValue = Array.isArray(email) ? email[0] : email;

  const booking = emailValue ? await findBookingForGuest(reference, emailValue) : null;

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 md:px-8">
        <EmptyState
          title="We couldn't find that booking"
          description="Double-check your booking reference and the email address used when booking."
          action={
            <Button href="/manage-booking" variant="secondary">
              Look up a booking
            </Button>
          }
        />
      </div>
    );
  }

  // Most recent payment attempt, if any — used only to explain a
  // PAYMENT_PENDING booking ("last attempt failed, try again") or to show
  // what was actually paid for a CONFIRMED one. Never used to decide
  // whether the booking is confirmed — booking.status (set only by the
  // webhook) is the only source of truth for that.
  const latestPayment = [...booking.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 md:px-8">
      <StatusHeader status={booking.status} guestFirstName={booking.guest.firstName} latestPaymentFailed={latestPayment?.status === "FAILED"} />

      <div className="mt-8">
        <BookingSummary booking={booking} />
      </div>

      {booking.status === "CONFIRMED" && latestPayment && (
        <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">Payment verified</p>
          <p className="mt-1">
            {formatMoney(latestPayment.amountCents, latestPayment.currency)} paid on{" "}
            {latestPayment.paidAt ? formatDateDisplay(latestPayment.paidAt) : "—"}
            {latestPayment.providerReference && <> · Reference: {latestPayment.providerReference}</>}
          </p>
        </div>
      )}

      {booking.status === "PAYMENT_PENDING" && (
        <div className="mt-6 flex flex-col gap-4 rounded-lg bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <p>
            {latestPayment?.status === "FAILED"
              ? "Your last payment attempt was unsuccessful. Your room is still held — you can try again below."
              : "Payment is still pending. Your reservation is not yet confirmed — complete payment to secure it."}
          </p>
          <div>
            <RetryPaymentButton bookingReference={booking.bookingReference} email={booking.guest.email} />
          </div>
        </div>
      )}

      {(booking.status === "CANCELLED" || booking.status === "EXPIRED") && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {booking.status === "EXPIRED"
            ? "This booking's payment hold expired before payment was completed, so the room was released. Your reservation was not confirmed."
            : "This booking was cancelled and was not confirmed."}
        </div>
      )}

      <div className="mt-8">
        <Link href="/" className="text-sm font-medium text-lagoon-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function StatusHeader({
  status,
  guestFirstName,
  latestPaymentFailed,
}: {
  status: string;
  guestFirstName: string;
  latestPaymentFailed: boolean;
}) {
  if (status === "CONFIRMED") {
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Reservation Confirmed</p>
        <h1 className="mt-3 font-display text-3xl text-ink-900">Thank you, {guestFirstName}</h1>
        <p className="mt-3 text-ink-700/80">
          Your payment has been verified and your stay at KwaNomzi is confirmed. Keep your booking reference and
          email safe — you&rsquo;ll need them to look up this booking again.
        </p>
      </>
    );
  }

  if (status === "PAYMENT_PENDING") {
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">
          {latestPaymentFailed ? "Payment Unsuccessful" : "Payment Pending"}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink-900">Hi {guestFirstName}, one step left</h1>
        <p className="mt-3 text-ink-700/80">
          Your room is held, but payment has not yet been completed. This reservation is <strong>not confirmed</strong> until payment succeeds.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
        {status === "EXPIRED" ? "Hold Expired" : "Booking Cancelled"}
      </p>
      <h1 className="mt-3 font-display text-3xl text-ink-900">This reservation was not confirmed</h1>
    </>
  );
}
