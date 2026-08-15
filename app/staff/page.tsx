import Link from "next/link";
import {
  getDashboardStats,
  getPendingPaymentBookings,
  getTodaysCheckouts,
  getUpcomingBookings,
  listBookings,
} from "@/lib/services/BookingService";
import { getRevenueSummary } from "@/lib/services/PaymentService";
import { getRoomStatusBreakdown } from "@/lib/services/RoomService";
import { requireStaffPage } from "@/lib/auth/staffAuth";
import { hasPermission } from "@/lib/auth/permissions";
import { StaffStatCard } from "@/components/staff/StaffStatCard";
import { BookingsTable } from "@/components/staff/BookingsTable";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateDisplay, formatMoney } from "@/lib/format";

export default async function StaffDashboardPage() {
  const session = await requireStaffPage();
  const role = session.user.role;

  const canViewBookings = hasPermission(role, "bookings:view");
  const canManageBookings = hasPermission(role, "bookings:manage");
  const canViewFinancial = hasPermission(role, "financial:view");
  const isHousekeepingOnly = hasPermission(role, "housekeeping:view") && !canViewBookings;

  const [stats, roomBreakdown] = await Promise.all([getDashboardStats(), getRoomStatusBreakdown()]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink-900">Dashboard</h1>
        {canManageBookings && (
          <div className="flex flex-wrap gap-3">
            <Button href="/staff/calendar" variant="secondary">
              View Calendar
            </Button>
            <Button href="/staff/bookings/new">New Booking</Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StaffStatCard label="Arrivals Today" value={stats.arrivalsToday} />
        <StaffStatCard label="Departures Today" value={stats.departuresToday} />
        <StaffStatCard label="Occupied Rooms" value={roomBreakdown.counts.OCCUPIED} />
        <StaffStatCard label="Available Rooms" value={roomBreakdown.counts.AVAILABLE} />
        <StaffStatCard label="Needs Cleaning" value={roomBreakdown.counts.CLEANING} />
        {isHousekeepingOnly ? (
          <StaffStatCard label="Maintenance" value={roomBreakdown.counts.MAINTENANCE} />
        ) : (
          <StaffStatCard label="Awaiting Payment" value={stats.pendingPaymentCount} hint="Held, not yet confirmed" />
        )}
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl text-ink-900">Room status</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StaffStatCard label="Available" value={roomBreakdown.counts.AVAILABLE} />
          <StaffStatCard label="Occupied" value={roomBreakdown.counts.OCCUPIED} />
          <StaffStatCard label="Reserved" value={roomBreakdown.counts.RESERVED} />
          <StaffStatCard label="Cleaning" value={roomBreakdown.counts.CLEANING} />
          <StaffStatCard label="Maintenance" value={roomBreakdown.counts.MAINTENANCE} />
        </div>
      </div>

      {canViewFinancial && <FinancialSection />}

      {isHousekeepingOnly ? (
        <HousekeepingCheckouts />
      ) : (
        canViewBookings && <BookingSections canManageBookings={canManageBookings} />
      )}
    </div>
  );
}

async function FinancialSection() {
  const revenue = await getRevenueSummary();
  return (
    <div>
      <h2 className="mb-4 font-display text-xl text-ink-900">Financial</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Revenue — today</p>
            <p className="mt-2 font-display text-3xl text-ink-900">{formatMoney(revenue.todayRevenueCents, revenue.currency)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Revenue — this week</p>
            <p className="mt-2 font-display text-3xl text-ink-900">{formatMoney(revenue.weekRevenueCents, revenue.currency)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Revenue — this month</p>
            <p className="mt-2 font-display text-3xl text-ink-900">{formatMoney(revenue.monthRevenueCents, revenue.currency)}</p>
          </CardBody>
        </Card>
        <StaffStatCard label="Paid Payments" value={revenue.paidCount} />
        <StaffStatCard label="Pending Payments" value={revenue.pendingCount} />
        <StaffStatCard label="Failed Payments" value={revenue.failedCount} />
      </div>
    </div>
  );
}

async function BookingSections({ canManageBookings }: { canManageBookings: boolean }) {
  const [recentBookings, upcomingBookings, pendingPaymentBookings] = await Promise.all([
    listBookings(),
    getUpcomingBookings(5),
    getPendingPaymentBookings(5),
  ]);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink-900">Upcoming bookings</h2>
            <Link href="/staff/calendar" className="text-sm font-medium text-lagoon-600 hover:underline">
              View calendar →
            </Link>
          </div>
          <BookingsTable bookings={upcomingBookings} />
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink-900">Awaiting payment</h2>
            {canManageBookings && (
              <Link href="/staff/bookings?status=PAYMENT_PENDING" className="text-sm font-medium text-lagoon-600 hover:underline">
                View all →
              </Link>
            )}
          </div>
          <BookingsTable bookings={pendingPaymentBookings} />
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink-900">Recent bookings</h2>
          <Link href="/staff/bookings" className="text-sm font-medium text-lagoon-600 hover:underline">
            View all →
          </Link>
        </div>
        <BookingsTable bookings={recentBookings.slice(0, 8)} />
      </div>
    </>
  );
}

/** No Total/Payment columns here — housekeeping gets room/guest/checkout time only, never financial detail. */
async function HousekeepingCheckouts() {
  const checkouts = await getTodaysCheckouts();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl text-ink-900">Today&rsquo;s check-outs</h2>
      {checkouts.length === 0 ? (
        <EmptyState title="No check-outs today" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {checkouts.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-3 text-ink-900">
                    {booking.room.roomType.name} — {booking.room.name}
                  </td>
                  <td className="px-4 py-3 text-ink-900">
                    {booking.guest.firstName} {booking.guest.lastName}
                  </td>
                  <td className="px-4 py-3 text-ink-900">{formatDateDisplay(booking.checkOut)}</td>
                  <td className="px-4 py-3 text-ink-900">{booking.status === "CHECKED_OUT" ? "Checked out" : "Departing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-sm text-ink-700/60">
        Update a room&rsquo;s status once it&rsquo;s turned over — see{" "}
        <Link href="/staff/rooms" className="font-medium text-lagoon-600 hover:underline">
          Rooms
        </Link>
        .
      </p>
    </div>
  );
}
