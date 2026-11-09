import { NextResponse } from "next/server";
import { expireStaleHolds } from "@/lib/services/BookingService";
import { timingSafeSecretEquals } from "@/lib/auth/timingSafeSecret";

/**
 * Guarded by a shared secret rather than admin session auth, since a
 * scheduler calling this has no browser session to present. Two accepted
 * credentials, checked independently:
 *
 *  - `x-internal-secret: <INTERNAL_SWEEP_SECRET>` — for manual/external
 *    invocation (curl, an external cron service, ad-hoc ops use).
 *  - `Authorization: Bearer <CRON_SECRET>` — what Vercel Cron sends
 *    automatically on every request it triggers, once CRON_SECRET is set as
 *    a project environment variable (see vercel.json for the schedule).
 *
 * Either one alone is sufficient; neither is required to equal the other.
 */
function isAuthorizedSweepRequest(request: Request): boolean {
  if (timingSafeSecretEquals(process.env.INTERNAL_SWEEP_SECRET, request.headers.get("x-internal-secret"))) return true;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (timingSafeSecretEquals(process.env.CRON_SECRET, bearer)) return true;

  return false;
}

async function runSweep(request: Request) {
  if (!isAuthorizedSweepRequest(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing sweep secret." } }, { status: 401 });
  }

  const result = await expireStaleHolds();
  return NextResponse.json({ data: result });
}

/** Vercel Cron only ever issues GET requests — this is the path it hits. */
export async function GET(request: Request) {
  return runSweep(request);
}

/** Kept for manual/external-scheduler invocation via x-internal-secret. */
export async function POST(request: Request) {
  return runSweep(request);
}
