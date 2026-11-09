const CHECKOUT_API_BASE = "https://payments.yoco.com";

export interface YocoCheckout {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentId: string;
}

/**
 * Looks up a checkout's current status directly, using the Checkout API's
 * own secret key (YOCO_SECRET_KEY) — deliberately NOT the Yoco API /
 * Application API key that GET /v1/orders/:id and GET /v1/payments/ depend
 * on. That key has been returning 403 on this account (see incident notes
 * in WebhookService.ts), but this endpoint has worked reliably every time
 * it's been checked, so PaymentReconciliationService uses it as a fallback
 * confirmation path that doesn't depend on that unresolved permission issue.
 */
export async function fetchYocoCheckout(checkoutId: string): Promise<YocoCheckout | null> {
  const secretKey = process.env.YOCO_SECRET_KEY;
  if (!secretKey) throw new Error("YOCO_SECRET_KEY is not configured — cannot reconcile pending payments.");

  const response = await fetch(`${CHECKOUT_API_BASE}/api/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`Yoco checkout fetch failed (${response.status}): ${bodyText.slice(0, 500)}`);
  }
  return (await response.json()) as YocoCheckout;
}
