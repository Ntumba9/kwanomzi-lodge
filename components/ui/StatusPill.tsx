import type { BookingStatus, PaymentStatus } from "@/lib/generated/prisma/client";
import { cn } from "@/lib/utils";

const bookingStatusStyles: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAYMENT_PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CHECKED_IN: "bg-sky-100 text-sky-800",
  CHECKED_OUT: "bg-mist-200 text-ink-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-mist-200 text-ink-700/70",
};

const bookingStatusLabels: Record<BookingStatus, string> = {
  PENDING: "Pending",
  PAYMENT_PENDING: "Awaiting Payment",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  INITIATED: "bg-mist-200 text-ink-700",
  PENDING: "bg-amber-100 text-amber-800",
  SUCCEEDED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-mist-200 text-ink-700/70",
  REFUNDED: "bg-sky-100 text-sky-800",
  PARTIALLY_REFUNDED: "bg-sky-100 text-sky-800",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  INITIATED: "Initiated",
  PENDING: "Pending",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

function Pill({ className, children }: { className?: string; children: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  return <Pill className={bookingStatusStyles[status]}>{bookingStatusLabels[status]}</Pill>;
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return <Pill className={paymentStatusStyles[status]}>{paymentStatusLabels[status]}</Pill>;
}
