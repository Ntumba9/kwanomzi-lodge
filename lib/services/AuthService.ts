import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/passwords";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Verifies email/password against the User table. Returns null on any
 * failure (unknown email, wrong password, inactive account) — deliberately
 * generic so callers (Auth.js's authorize callback) can't leak which part
 * of the credential was wrong.
 */
export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return null;

  return { id: String(user.id), email: user.email, name: user.name, role: user.role };
}
