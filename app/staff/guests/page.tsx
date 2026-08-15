import Link from "next/link";
import { listGuests } from "@/lib/services/GuestService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function StaffGuestsPage({ searchParams }: PageProps<"/staff/guests">) {
  const { allowed } = await checkPermission("guests:view");
  if (!allowed) return <Forbidden />;

  const params = await searchParams;
  const search = firstValue(params.q);
  const guests = await listGuests(search);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-ink-900">Guests</h1>

      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-mist-200 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-medium text-ink-700">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Name, email or phone"
            defaultValue={search ?? ""}
            className="w-64 rounded-lg border border-mist-200 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-full border border-lagoon-600 px-5 py-2.5 text-sm font-medium text-lagoon-600 hover:bg-lagoon-600 hover:text-mist-50">
          Search
        </button>
        {search && (
          <Link href="/staff/guests" className="text-sm font-medium text-ink-700 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {guests.length === 0 ? (
        <EmptyState title="No guests found" />
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
                  <Link href={`/staff/guests/${guest.id}`} className="text-lagoon-600 hover:underline">
                    {guest.firstName} {guest.lastName}
                  </Link>
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

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
