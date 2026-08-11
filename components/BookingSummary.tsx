import type { Prisma } from "@/lib/generated/prisma/client";
import { formatDateDisplay, formatMoney } from "@/lib/format";
import { BookingStatusPill } from "@/components/ui/StatusPill";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export type BookingWithDetails = Prisma.BookingGetPayload<{
  include: { guest: true; room: { include: { roomType: true } } };
}>;

export function BookingSummary({ booking }: { booking: BookingWithDetails }) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-700/60">Booking Reference</p>
          <p className="font-display text-lg text-ink-900">{booking.bookingReference}</p>
        </div>
        <BookingStatusPill status={booking.status} />
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Detail label="Room" value={`${booking.room.roomType.name} — ${booking.room.name}`} />
        <Detail label="Guest" value={`${booking.guest.firstName} ${booking.guest.lastName}`} />
        <Detail label="Check-in" value={formatDateDisplay(booking.checkIn)} />
        <Detail label="Check-out" value={formatDateDisplay(booking.checkOut)} />
        <Detail label="Nights" value={String(booking.nights)} />
        {booking.guestCount != null && <Detail label="Guests" value={String(booking.guestCount)} />}
        <Detail label="Total" value={formatMoney(booking.totalAmountCents, booking.currency)} />
        {booking.specialRequests && (
          <div className="sm:col-span-2">
            <Detail label="Special requests" value={booking.specialRequests} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-700/60">{label}</p>
      <p className="mt-0.5 text-sm text-ink-900">{value}</p>
    </div>
  );
}
