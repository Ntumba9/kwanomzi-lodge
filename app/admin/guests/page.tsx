import { listGuests } from "@/lib/services/GuestService";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminGuestsPage() {
  const guests = await listGuests();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-ink-900">Guests</h1>

      {guests.length === 0 ? (
        <EmptyState title="No guests yet" />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Bookings</Th>
            </tr>
          </TableHead>
          <TableBody>
            {guests.map((guest) => (
              <TableRow key={guest.id}>
                <Td className="font-medium">
                  {guest.firstName} {guest.lastName}
                </Td>
                <Td>{guest.email}</Td>
                <Td>{guest.phone ?? "—"}</Td>
                <Td>{guest._count.bookings}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
