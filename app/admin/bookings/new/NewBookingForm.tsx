"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/FormField";
import { createManualBookingAction, type ActionState } from "../actions";

interface RoomOption {
  id: number;
  label: string;
}

const initialState: ActionState = {};

export function NewBookingForm({ rooms }: { rooms: RoomOption[] }) {
  const [state, formAction, pending] = useActionState(createManualBookingAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <SelectField label="Room" name="roomId" required className="sm:col-span-2">
        <option value="">Select a room…</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.label}
          </option>
        ))}
      </SelectField>

      <TextField label="Check-in" type="date" name="checkIn" required />
      <TextField label="Check-out" type="date" name="checkOut" required />

      <TextField label="First name" name="firstName" required />
      <TextField label="Last name" name="lastName" required />
      <TextField label="Email" type="email" name="email" required className="sm:col-span-2" />
      <TextField label="Phone" name="phone" required />
      <TextField label="Number of guests" type="number" name="guestCount" min={1} max={20} defaultValue={1} required />
      <TextAreaField label="Special requests (optional)" name="specialRequests" className="sm:col-span-2" />

      {state.error && (
        <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Creating…" : "Create Booking"}
        </Button>
      </div>
    </form>
  );
}
