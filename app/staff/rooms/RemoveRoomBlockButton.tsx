"use client";

import { useState, useTransition } from "react";
import { deleteRoomBlockAction } from "./actions";

export function RemoveRoomBlockButton({ blockId }: { blockId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoomBlockAction(blockId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
