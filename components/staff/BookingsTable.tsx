import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatDateDisplay, formatMoney } from "@/lib/format";
import { BookingStatusPill, PaymentStatusPill } from "@/components/ui/StatusPill";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export type BookingListItem = Prisma.BookingGetPayload<{
  include: { guest: true; room: { include: { roomType: true } }; payments: true };
}>;

export function BookingsTable({ bookings }: { bookings: BookingListItem[] }) {
  if (bookings.length === 0) {
    return <EmptyState title="No bookings match these filters" description="Try widening your date range or status filter." />;
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Reference</Th>
          <Th>Guest</Th>
          <Th>Room</Th>
          <Th>Check-in</Th>
          <Th>Check-out</Th>
          <Th>Total</Th>
          <Th>Booking Status</Th>
          <Th>Payment</Th>
        </tr>
      </TableHead>
      <TableBody>
        {bookings.map((booking) => {
          const latestPayment = [...booking.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          return (
            <TableRow key={booking.id}>
              <Td>
                <Link href={`/staff/bookings/${booking.id}`} className="font-medium text-lagoon-600 hover:underline">
                  {booking.bookingReference}
                </Link>
              </Td>
              <Td>
                {booking.guest.firstName} {booking.guest.lastName}
              </Td>
              <Td>
                {booking.room.roomType.name} — {booking.room.name}
              </Td>
              <Td>{formatDateDisplay(booking.checkIn)}</Td>
              <Td>{formatDateDisplay(booking.checkOut)}</Td>
              <Td>{formatMoney(booking.totalAmountCents, booking.currency)}</Td>
              <Td>
                <BookingStatusPill status={booking.status} />
              </Td>
              <Td>{latestPayment ? <PaymentStatusPill status={latestPayment.status} /> : <span className="text-ink-700/40">—</span>}</Td>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
