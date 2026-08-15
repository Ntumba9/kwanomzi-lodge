import type { BookingStatus } from "@/lib/generated/prisma/client";
import { listBookings } from "@/lib/services/BookingService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { hasPermission } from "@/lib/auth/permissions";
import { BookingsTable } from "@/components/staff/BookingsTable";
import { Forbidden } from "@/components/staff/Forbidden";
import { Button } from "@/components/ui/Button";

const STATUS_OPTIONS: BookingStatus[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "EXPIRED",
];

export default async function StaffBookingsPage({ searchParams }: PageProps<"/staff/bookings">) {
  const { allowed, session } = await checkPermission("bookings:view");
  if (!allowed) return <Forbidden />;
  const canManage = hasPermission(session.user.role, "bookings:manage");

  const params = await searchParams;
  const status = firstValue(params.status);
  const from = firstValue(params.from);
  const to = firstValue(params.to);
  const search = firstValue(params.q);

  const bookings = await listBookings({
    status: status && STATUS_OPTIONS.includes(status as BookingStatus) ? (status as BookingStatus) : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink-900">Bookings</h1>
        {canManage && <Button href="/staff/bookings/new">New Booking</Button>}
      </div>

      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-mist-200 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-medium text-ink-700">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Reference, guest name or email"
            defaultValue={search ?? ""}
            className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs font-medium text-ink-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-xs font-medium text-ink-700">
            Check-in from
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-xs font-medium text-ink-700">
            Check-in to
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        {(status || from || to || search) && (
          <Button href="/staff/bookings" variant="ghost">
            Clear
          </Button>
        )}
      </form>

      <BookingsTable bookings={bookings} />
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
