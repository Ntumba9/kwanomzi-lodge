import { getBookingVolumeReport, getOccupancyReport, getRoomTypePerformance } from "@/lib/services/ReportService";
import { getRevenueSummary } from "@/lib/services/PaymentService";
import { getUpcomingBookings } from "@/lib/services/BookingService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { StaffStatCard } from "@/components/staff/StaffStatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";

export default async function StaffReportsPage() {
  const { allowed } = await checkPermission("reports:view");
  if (!allowed) return <Forbidden />;

  const [occupancy, bookingVolume, roomPerformance, revenue, upcoming] = await Promise.all([
    getOccupancyReport(),
    getBookingVolumeReport(),
    getRoomTypePerformance(),
    getRevenueSummary(),
    getUpcomingBookings(100),
  ]);

  const occupancyPct = Math.round(occupancy.occupancyRate * 1000) / 10;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Reports</h1>
        <p className="mt-1 text-sm text-ink-700/60">
          Based on the last {occupancy.windowDays} days of bookings and payments, plus every confirmed stay still to
          come.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaffStatCard label={`Occupancy (next ${occupancy.windowDays}d)`} value={`${occupancyPct}%`} hint={`${occupancy.bookedRoomNights} of ${occupancy.totalRoomNights} room-nights`} />
        <StaffStatCard label="Bookings created (30d)" value={bookingVolume.createdCount} />
        <StaffStatCard label="Upcoming confirmed stays" value={upcoming.length} />
        <StaffStatCard label="Revenue this month" value={formatMoney(revenue.monthRevenueCents, revenue.currency)} />
      </div>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Revenue</p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Today</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{formatMoney(revenue.todayRevenueCents, revenue.currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">This week</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{formatMoney(revenue.weekRevenueCents, revenue.currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">All time</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{formatMoney(revenue.totalRevenueCents, revenue.currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Paid payments</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{revenue.paidCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Pending payments</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{revenue.pendingCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Failed payments</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{revenue.failedCount}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Bookings by status (last 30 days, by creation date)</p>
        </CardHeader>
        <CardBody>
          {Object.keys(bookingVolume.byStatus).length === 0 ? (
            <EmptyState title="No bookings created in this window" />
          ) : (
            <div className="flex flex-wrap gap-6">
              {Object.entries(bookingVolume.byStatus).map(([status, count]) => (
                <div key={status}>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">{status}</p>
                  <p className="mt-1 font-display text-2xl text-ink-900">{count}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Room type performance (all time)</p>
        </CardHeader>
        <CardBody>
          {roomPerformance.length === 0 ? (
            <EmptyState title="No room types yet" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-mist-200">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Room type</th>
                    <th className="px-4 py-3 font-medium">Bookings</th>
                    <th className="px-4 py-3 font-medium">Revenue collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-200">
                  {roomPerformance.map((rt) => (
                    <tr key={rt.roomTypeId}>
                      <td className="px-4 py-3 font-medium text-ink-900">{rt.roomTypeName}</td>
                      <td className="px-4 py-3 text-ink-900">{rt.bookingCount}</td>
                      <td className="px-4 py-3 text-ink-900">{formatMoney(rt.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
