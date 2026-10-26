"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/FormField";
import { createRoomBlockAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function RoomBlockForm({ rooms }: { rooms: { id: number; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createRoomBlockAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Room" name="roomId" required className="sm:col-span-2">
        <option value="">Select a room…</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.label}
          </option>
        ))}
      </SelectField>
      <TextField label="From" type="date" name="startDate" required />
      <TextField label="Until (exclusive)" type="date" name="endDate" required />
      <div className="sm:col-span-2">
        <TextAreaField label="Reason (optional, for your own reference)" name="reason" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? "Blocking…" : "Block these dates"}
        </Button>
      </div>
      {state.error && <p className="sm:col-span-2 text-sm font-medium text-red-600">{state.error}</p>}
      {state.success && <p className="sm:col-span-2 text-sm font-medium text-emerald-700">{state.success}</p>}
    </form>
  );
}
