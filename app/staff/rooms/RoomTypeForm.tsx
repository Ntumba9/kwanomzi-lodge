"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { createRoomTypeAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function RoomTypeForm() {
  const [state, formAction, pending] = useActionState(createRoomTypeAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Name" name="name" required className="sm:col-span-2" />
      <TextAreaField label="Description (optional)" name="description" className="sm:col-span-2" />
      <TextField label="Capacity" name="capacity" type="number" min={1} max={20} required />
      <TextField label="Base price (cents)" name="basePriceCents" type="number" min={0} required hint="e.g. 180000 = R1,800" />
      {state.error && (
        <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="sm:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {state.success}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add room type"}
        </Button>
      </div>
    </form>
  );
}
