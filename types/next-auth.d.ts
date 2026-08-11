import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

// @auth/core's own callback signatures reference JWT from "@auth/core/jwt"
// directly rather than the "next-auth/jwt" re-export, so the augmentation
// above alone doesn't reach them — augment both. Verified by reading
// node_modules/@auth/core/index.d.ts, not assumed.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
