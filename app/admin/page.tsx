import Link from "next/link";
import { getDashboardStats, listBookings } from "@/lib/services/BookingService";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { BookingsTable } from "@/components/admin/BookingsTable";
import { Button } from "@/components/ui/Button";

export default async function AdminDashboardPage() {
  const [stats, recentBookings] = await Promise.all([getDashboardStats(), listBookings()]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink-900">Dashboard</h1>
        <Button href="/admin/bookings/new">New Booking</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminStatCard label="Arrivals Today" value={stats.arrivalsToday} />
        <AdminStatCard label="Departures Today" value={stats.departuresToday} />
        <AdminStatCard label="Upcoming Confirmed" value={stats.upcomingConfirmed} />
        <AdminStatCard label="Awaiting Payment" value={stats.pendingCount} hint="Held, not yet confirmed" />
        <AdminStatCard label="Active Rooms" value={stats.activeRoomCount} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink-900">Recent bookings</h2>
          <Link href="/admin/bookings" className="text-sm font-medium text-lagoon-600 hover:underline">
            View all →
          </Link>
        </div>
        <BookingsTable bookings={recentBookings.slice(0, 8)} />
      </div>
    </div>
  );
}
