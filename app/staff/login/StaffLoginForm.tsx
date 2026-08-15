"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField label="Email" name="email" type="email" autoComplete="username" required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
