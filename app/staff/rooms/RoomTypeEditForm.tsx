"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { updateRoomTypeAction, type ActionState } from "./actions";

const initialState: ActionState = {};

interface RoomTypeEditFormProps {
  roomTypeId: number;
  capacity: number;
  basePriceCents: number;
}

export function RoomTypeEditForm({ roomTypeId, capacity, basePriceCents }: RoomTypeEditFormProps) {
  const boundAction = updateRoomTypeAction.bind(null, roomTypeId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-700/50">Sleeps</label>
        <input
          name="capacity"
          type="number"
          min={1}
          max={20}
          defaultValue={capacity}
          className="w-16 rounded-lg border border-mist-200 px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-700/50">Rate (cents/night)</label>
        <input
          name="basePriceCents"
          type="number"
          min={0}
          defaultValue={basePriceCents}
          className="w-28 rounded-lg border border-mist-200 px-2 py-1 text-xs"
        />
      </div>
      <Button type="submit" size="md" variant="ghost" disabled={pending} className="px-3 py-1.5 text-xs">
        {pending ? "Saving…" : "Save rate"}
      </Button>
      {state.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-xs font-medium text-emerald-700">{state.success}</p>}
    </form>
  );
}
