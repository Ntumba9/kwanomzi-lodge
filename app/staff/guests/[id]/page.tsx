import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuestById } from "@/lib/services/GuestService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BookingStatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateDisplay, formatMoney } from "@/lib/format";

export default async function StaffGuestDetailPage({ params }: PageProps<"/staff/guests/[id]">) {
  const { allowed } = await checkPermission("guests:view");
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const guestId = Number(id);
  const guest = Number.isFinite(guestId) ? await getGuestById(guestId) : null;

  if (!guest) {
    notFound();
  }

  const today = new Date();
  const upcoming = guest.bookings.filter((b) => b.checkOut.getTime() >= today.getTime());
  const past = guest.bookings.filter((b) => b.checkOut.getTime() < today.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-700/60">Guest</p>
        <h1 className="font-display text-3xl text-ink-900">
          {guest.firstName} {guest.lastName}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Contact</p>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm">
          <p>{guest.email}</p>
          {guest.phone && <p>{guest.phone}</p>}
          {guest.specialRequests && <p className="text-ink-700/70">Notes: {guest.specialRequests}</p>}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-4 font-display text-xl text-ink-900">Current &amp; upcoming bookings</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No current or upcoming bookings" />
        ) : (
          <BookingList bookings={upcoming} />
        )}
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl text-ink-900">Past bookings</h2>
        {past.length === 0 ? <EmptyState title="No past bookings" /> : <BookingList bookings={past} />}
      </div>
    </div>
  );
}

function BookingList({ bookings }: { bookings: NonNullable<Awaited<ReturnType<typeof getGuestById>>>["bookings"] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
          <tr>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">Room</th>
            <th className="px-4 py-3 font-medium">Check-in</th>
            <th className="px-4 py-3 font-medium">Check-out</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mist-200">
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td className="px-4 py-3">
                <Link href={`/staff/bookings/${booking.id}`} className="font-medium text-lagoon-600 hover:underline">
                  {booking.bookingReference}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink-900">
                {booking.room.roomType.name} — {booking.room.name}
              </td>
              <td className="px-4 py-3 text-ink-900">{formatDateDisplay(booking.checkIn)}</td>
              <td className="px-4 py-3 text-ink-900">{formatDateDisplay(booking.checkOut)}</td>
              <td className="px-4 py-3 text-ink-900">{formatMoney(booking.totalAmountCents, booking.currency)}</td>
              <td className="px-4 py-3">
                <BookingStatusPill status={booking.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
