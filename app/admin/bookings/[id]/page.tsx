import { notFound } from "next/navigation";
import { getBookingById, ALLOWED_TRANSITIONS } from "@/lib/services/BookingService";
import { BookingSummary } from "@/components/BookingSummary";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PaymentStatusPill } from "@/components/ui/StatusPill";
import { formatDateDisplay, formatMoney } from "@/lib/format";
import { StatusActions } from "./StatusActions";
import { PaymentLinkGenerator } from "./PaymentLinkGenerator";

export default async function AdminBookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  const bookingId = Number(id);
  const booking = Number.isFinite(bookingId) ? await getBookingById(bookingId) : null;

  if (!booking) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-700/60">Booking</p>
        <h1 className="font-display text-3xl text-ink-900">{booking.bookingReference}</h1>
      </div>

      <BookingSummary booking={booking} />

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Status</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <StatusActions bookingId={booking.id} availableTransitions={ALLOWED_TRANSITIONS[booking.status]} />
          {booking.status === "PAYMENT_PENDING" && (
            <div className="border-t border-mist-200 pt-4">
              <PaymentLinkGenerator bookingId={booking.id} />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <p className="font-display text-lg text-ink-900">Payments</p>
        </CardHeader>
        <CardBody>
          {booking.payments.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No payment attempt has been recorded for this booking yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...booking.payments]
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .map((payment) => (
                  <li key={payment.id} className="flex flex-col gap-1 border-b border-mist-100 pb-3 text-sm last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink-900">
                        {payment.provider} — {formatMoney(payment.amountCents, payment.currency)}
                      </span>
                      <PaymentStatusPill status={payment.status} />
                    </div>
                    <div className="text-xs text-ink-700/60">
                      {payment.providerReference && <>Reference: {payment.providerReference} · </>}
                      {payment.paidAt ? `Paid ${formatDateDisplay(payment.paidAt)}` : `Created ${formatDateDisplay(payment.createdAt)}`}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Guest contact</p>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm">
          <p>{booking.guest.email}</p>
          {booking.guest.phone && <p>{booking.guest.phone}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
