"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { updateHoldMinutesAction, updateRateCardAction, type SettingsActionState } from "./actions";

const initialState: SettingsActionState = {};

export function HoldMinutesForm({ currentValue }: { currentValue: number }) {
  const [state, formAction, pending] = useActionState(updateHoldMinutesAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Booking hold duration (minutes)"
        name="holdMinutes"
        type="number"
        min={1}
        max={1440}
        defaultValue={currentValue}
        hint="How long a booking holds its room before payment is required, before the automatic sweep releases it."
        required
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function RateCardForm({ currentValue }: { currentValue: string }) {
  const [state, formAction, pending] = useActionState(updateRateCardAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextAreaField
        label="Rate card (JSON)"
        name="rateCard"
        defaultValue={currentValue}
        className="min-h-64 font-mono text-xs"
        hint="Accommodation, meals, and packages arrays — each entry needs a label and cents (whole ZAR cents)."
        required
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {state.success}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save rate card"}
      </Button>
    </form>
  );
}
