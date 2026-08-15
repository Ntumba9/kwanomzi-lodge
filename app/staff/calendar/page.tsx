import Link from "next/link";
import { getBookingsForMonth } from "@/lib/services/BookingService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { BookingStatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function monthHref(year: number, month: number): string {
  return `/staff/calendar?year=${year}&month=${month + 1}`;
}

export default async function StaffCalendarPage({ searchParams }: PageProps<"/staff/calendar">) {
  const { allowed } = await checkPermission("calendar:view");
  if (!allowed) return <Forbidden />;

  const params = await searchParams;
  const now = new Date();

  const yearParam = firstValue(params.year);
  const monthParam = firstValue(params.month);
  const year = yearParam && Number.isFinite(Number(yearParam)) ? Number(yearParam) : now.getUTCFullYear();
  // Query param month is 1-indexed (human-facing URL); internally 0-indexed like Date.
  const month =
    monthParam && Number.isFinite(Number(monthParam)) ? Math.min(11, Math.max(0, Number(monthParam) - 1)) : now.getUTCMonth();

  const bookings = await getBookingsForMonth(year, month);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = new Date(Date.UTC(year, month, 1)).getUTCDay();

  const todayKey = formatDayKey(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: { day: number | null }[] = [
    ...Array.from({ length: leadingBlanks }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink-900">
          {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex gap-2">
          <Link
            href={monthHref(prevYear, prevMonth)}
            className="rounded-full border border-mist-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-mist-100"
          >
            ← Previous
          </Link>
          <Link
            href={monthHref(now.getUTCFullYear(), now.getUTCMonth())}
            className="rounded-full border border-mist-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-mist-100"
          >
            Today
          </Link>
          <Link
            href={monthHref(nextYear, nextMonth)}
            className="rounded-full border border-mist-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-mist-100"
          >
            Next →
          </Link>
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings this month" description="Check-ins, stays and check-outs will appear here once bookings exist." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
          <div className="grid min-w-[840px] grid-cols-7 border-b border-mist-200 bg-mist-100 text-xs font-semibold uppercase tracking-wide text-ink-700/70">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-3 py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid min-w-[840px] grid-cols-7">
            {cells.map((cell, idx) => {
              if (cell.day === null) {
                return <div key={`blank-${idx}`} className="min-h-28 border-b border-r border-mist-100 bg-mist-50/40" />;
              }

              const dayKey = formatDayKey(year, month, cell.day);
              const dayDate = new Date(Date.UTC(year, month, cell.day));
              const dayBookings = bookings.filter(
                (b) => b.checkIn.getTime() <= dayDate.getTime() && dayDate.getTime() < b.checkOut.getTime(),
              );

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "flex min-h-28 flex-col gap-1 border-b border-r border-mist-100 p-2",
                    dayKey === todayKey && "bg-lagoon-50",
                  )}
                >
                  <span className={cn("text-xs font-semibold", dayKey === todayKey ? "text-lagoon-700" : "text-ink-700/60")}>
                    {cell.day}
                  </span>
                  <div className="flex flex-col gap-1">
                    {dayBookings.slice(0, 3).map((b) => {
                      const isArrival = b.checkIn.getTime() === dayDate.getTime();
                      const isDeparture = new Date(b.checkOut.getTime() - 86400000).getTime() === dayDate.getTime();
                      return (
                        <Link
                          key={b.id}
                          href={`/staff/bookings/${b.id}`}
                          className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:underline"
                          title={`${b.guest.firstName} ${b.guest.lastName} — ${b.room.roomType.name} ${b.room.name}`}
                        >
                          <span className={cn("mr-1", isArrival && "text-emerald-700", isDeparture && "text-amber-700")}>
                            {isArrival ? "↓" : isDeparture ? "↑" : "•"}
                          </span>
                          {b.guest.lastName} — {b.room.name}
                        </Link>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <span className="text-[11px] text-ink-700/50">+{dayBookings.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-ink-700/60">
        <span>
          <span className="mr-1 text-emerald-700">↓</span> Arrival
        </span>
        <span>
          <span className="mr-1 text-amber-700">↑</span> Departure
        </span>
        <span>
          <span className="mr-1">•</span> Staying
        </span>
        <BookingStatusPill status="PAYMENT_PENDING" />
      </div>
    </div>
  );
}

function formatDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
