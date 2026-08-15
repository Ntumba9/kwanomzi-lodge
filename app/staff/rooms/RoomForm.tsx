"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { createRoomAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function RoomForm({ roomTypeId }: { roomTypeId: number }) {
  const [state, formAction, pending] = useActionState(createRoomAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="roomTypeId" value={roomTypeId} />
      <div className="w-40">
        <TextField label="Room name" name="name" required />
      </div>
      <div className="w-32">
        <TextField label="Capacity override" name="capacity" type="number" min={1} max={20} />
      </div>
      <div className="w-40">
        <TextField label="Price override (cents)" name="priceOverrideCents" type="number" min={0} />
      </div>
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Adding…" : "Add room"}
      </Button>
      {state.error && <p className="w-full text-sm font-medium text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm font-medium text-emerald-700">{state.success}</p>}
    </form>
  );
}
