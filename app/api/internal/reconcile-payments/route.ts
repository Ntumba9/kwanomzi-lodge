import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/lib/services/PaymentReconciliationService";

/**
 * Same auth pattern as /api/internal/expire-holds — see that route for why
 * two independent secrets are accepted. This one is meant to also be hit
 * by an external scheduler every few minutes (via x-internal-secret), not
 * just Vercel Cron's daily run, since the webhook path this backs up can
 * leave a payment unconfirmed for a while before this catches it.
 */
function isAuthorizedSweepRequest(request: Request): boolean {
  const sweepSecret = process.env.INTERNAL_SWEEP_SECRET;
  const providedSweepSecret = request.headers.get("x-internal-secret");
  if (sweepSecret && providedSweepSecret === sweepSecret) return true;

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

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
