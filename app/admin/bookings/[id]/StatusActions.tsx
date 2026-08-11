"use client";

import { useState, useTransition } from "react";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/Button";
import { transitionBookingAction } from "../actions";

const TRANSITION_LABELS: Partial<Record<BookingStatus, string>> = {
  PAYMENT_PENDING: "Move to Payment Pending",
  CONFIRMED: "Confirm Booking",
  CHECKED_IN: "Check In",
  CHECKED_OUT: "Check Out",
  CANCELLED: "Cancel Booking",
  EXPIRED: "Mark as Expired",
};

interface StatusActionsProps {
  bookingId: number;
  availableTransitions: BookingStatus[];
}

export function StatusActions({ bookingId, availableTransitions }: StatusActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);

  if (availableTransitions.length === 0) {
    return <p className="text-sm text-ink-700/60">This booking has no further status changes available.</p>;
  }

  function handleClick(toStatus: BookingStatus) {
    setError(null);
    setPendingStatus(toStatus);
    startTransition(async () => {
      const result = await transitionBookingAction(bookingId, toStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {availableTransitions.map((status) => (
          <Button
            key={status}
            variant={status === "CANCELLED" ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => handleClick(status)}
          >
            {pending && pendingStatus === status ? "Updating…" : (TRANSITION_LABELS[status] ?? status)}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
