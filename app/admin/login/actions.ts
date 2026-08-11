"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(_prevState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Auth.js signals a successful sign-in redirect by throwing a special
    // NEXT_REDIRECT error — it is not a failure and must propagate.
    throw error;
  }
}
