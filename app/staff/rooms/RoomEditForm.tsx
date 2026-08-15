"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { updateRoomAction, type ActionState } from "./actions";

const initialState: ActionState = {};

interface RoomEditFormProps {
  roomId: number;
  capacity: number | null;
  priceOverrideCents: number | null;
  isActive: boolean;
}

export function RoomEditForm({ roomId, capacity, priceOverrideCents, isActive }: RoomEditFormProps) {
  const boundAction = updateRoomAction.bind(null, roomId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-700/50">Capacity</label>
        <input
          name="capacity"
          type="number"
          min={1}
          max={20}
          defaultValue={capacity ?? ""}
          placeholder="Default"
          className="w-20 rounded-lg border border-mist-200 px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-700/50">Price override</label>
        <input
          name="priceOverrideCents"
          type="number"
          min={0}
          defaultValue={priceOverrideCents ?? ""}
          placeholder="Default"
          className="w-24 rounded-lg border border-mist-200 px-2 py-1 text-xs"
        />
      </div>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink-700">
        {/* Checkbox must precede the hidden fallback in DOM order — FormData.get()
            returns the first same-named value, and only an unchecked box omits its own. */}
        <input type="checkbox" name="isActive" value="true" defaultChecked={isActive} className="h-3.5 w-3.5" />
        <input type="hidden" name="isActive" value="false" />
        Active
      </label>
      <Button type="submit" size="md" variant="ghost" disabled={pending} className="px-3 py-1.5 text-xs">
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
