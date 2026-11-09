import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/services/PaymentReconciliationService";
import { timingSafeSecretEquals } from "@/lib/auth/timingSafeSecret";

/**
 * Same auth pattern as /api/internal/expire-holds — see that route for why
 * two independent secrets are accepted. This one is meant to also be hit
 * by an external scheduler every few minutes (via x-internal-secret), not
 * just Vercel Cron's daily run, since the webhook path this backs up can
 * leave a payment unconfirmed for a while before this catches it.
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

  const result = await reconcilePendingPayments();
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
