"use client";

import { useState, useTransition } from "react";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/client";
import { updateRoomStatusAction } from "./actions";

const STATUS_OPTIONS: { value: RoomOperationalStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "OCCUPIED", label: "Occupied" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MAINTENANCE", label: "Maintenance" },
];

export function RoomStatusActions({ roomId, currentStatus }: { roomId: number; currentStatus: RoomOperationalStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);

  function handleChange(next: string) {
    setError(null);
    const previous = status;
    setStatus(next as RoomOperationalStatus);
    startTransition(async () => {
      const result = await updateRoomStatusAction(roomId, next);
      if (result.error) {
        setError(result.error);
        setStatus(previous);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-mist-200 px-2.5 py-1.5 text-xs font-medium text-ink-900 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
