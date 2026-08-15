"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/FormField";
import { createStaffAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function StaffCreateForm() {
  const [state, formAction, pending] = useActionState(createStaffAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Full name" name="name" required />
      <TextField label="Email" name="email" type="email" required />
      <TextField label="Temporary password" name="password" type="password" minLength={8} required hint="At least 8 characters — they can change it later." />
      <SelectField label="Role" name="role" required defaultValue="RECEPTION">
        <option value="OWNER">Owner</option>
        <option value="MANAGER">Manager</option>
        <option value="RECEPTION">Reception</option>
        <option value="HOUSEKEEPING">Housekeeping</option>
        <option value="READ_ONLY">Read Only</option>
      </SelectField>
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
          {pending ? "Creating…" : "Create staff account"}
        </Button>
      </div>
    </form>
  );
}
