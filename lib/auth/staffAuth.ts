import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

/**
 * proxy.ts already redirects unauthenticated requests away from /staff/**
 * before any page or Server Action runs — this is defense-in-depth on top
 * of that, not the primary gate. Every staff page and every mutating
 * Server Action calls this (or requirePermission below) itself rather than
 * assuming the route it's declared on was reachable only because proxy.ts
 * allowed it; a session or Server Action re-entering this file from a
 * different code path must not accidentally skip the check.
 */
export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/staff/login");
  }
  return session;
}

/**
 * For Server Components (pages): redirects to login if unauthenticated,
 * returns the session so the page can itself decide whether to render a
 * Forbidden state for an insufficiently-privileged role (see
 * components/staff/Forbidden.tsx) rather than redirecting away, which would
 * either loop or silently hide *why* access was denied.
 */
export async function requireStaffPage() {
  return requireStaffSession();
}

export interface PermissionCheckResult {
  session: Awaited<ReturnType<typeof requireStaffSession>>;
  allowed: boolean;
}

export async function checkPermission(permission: Permission): Promise<PermissionCheckResult> {
  const session = await requireStaffSession();
  return { session, allowed: hasPermission(session.user.role, permission) };
}

/**
 * For Server Actions (mutations): throws rather than returning a boolean,
 * since an action has no page to render a Forbidden state into — the caller
 * catches this the same way it already catches DomainError, or lets it
 * surface as a generic failure. Never trusts anything client-supplied;
 * the role comes only from the server-verified session.
 */
export async function requirePermission(permission: Permission) {
  const session = await requireStaffSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new Error("Forbidden: insufficient permissions for this action.");
  }
  return session;
}
