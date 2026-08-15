import Link from "next/link";
import type { PaymentStatus } from "@/lib/generated/prisma/client";
import { listPayments } from "@/lib/services/PaymentService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { PaymentStatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateDisplay, formatMoney } from "@/lib/format";

const STATUS_OPTIONS: PaymentStatus[] = ["INITIATED", "PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];

export default async function StaffPaymentsPage({ searchParams }: PageProps<"/staff/payments">) {
  const { allowed } = await checkPermission("payments:view");
  if (!allowed) return <Forbidden />;

  const params = await searchParams;
  const status = firstValue(params.status);
  const payments = await listPayments({
    status: status && STATUS_OPTIONS.includes(status as PaymentStatus) ? (status as PaymentStatus) : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Payments</h1>
        <p className="mt-1 text-sm text-ink-700/60">
          Every payment attempt recorded against a booking. Amounts and statuses only — no provider credentials are
          ever shown here.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-mist-200 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs font-medium text-ink-700">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="rounded-lg border border-mist-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-full border border-lagoon-600 px-5 py-2.5 text-sm font-medium text-lagoon-600 hover:bg-lagoon-600 hover:text-mist-50">
          Apply
        </button>
        {status && (
          <Link href="/staff/payments" className="text-sm font-medium text-ink-700 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {payments.length === 0 ? (
        <EmptyState title="No payments match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 text-ink-900">{payment.providerReference ?? <span className="text-ink-700/40">—</span>}</td>
                  <td className="px-4 py-3">
                    <Link href={`/staff/bookings/${payment.bookingId}`} className="font-medium text-lagoon-600 hover:underline">
                      {payment.booking.bookingReference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-900">
                    {payment.booking.guest.firstName} {payment.booking.guest.lastName}
                  </td>
                  <td className="px-4 py-3 text-ink-900">{formatMoney(payment.amountCents, payment.currency)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusPill status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-900">
                    {payment.paidAt ? formatDateDisplay(payment.paidAt) : formatDateDisplay(payment.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
