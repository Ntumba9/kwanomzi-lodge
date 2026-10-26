/**
 * Thin client for the Yoco API's Orders resource — used by WebhookService
 * to resolve an "order.completed" webhook (which carries only an order_id)
 * into the actual payment details (amount, status, and crucially the
 * checkout_id that links back to our own Payment row).
 *
 * Authenticated with an Application API key (YOCO_APPLICATION_API_KEY,
 * format "yoco_live_..."/"yoco_test_..."), generated in the Yoco Developer
 * Console for an application granted the `business/orders:read` scope.
 * This is a different credential from YOCO_SECRET_KEY (the Checkout API's
 * "sk_live_..." key, used only to create checkouts) — verified directly:
 * the Checkout API secret key was rejected with 401 when used against this
 * endpoint during integration testing.
 */

export interface YocoOrderPayment {
  id: string;
  checkout_id: string;
  status: string;
  total_amount: { amount: number; currency: string };
}

export interface YocoOrder {
  id: string;
  status: string;
  currency: string;
  payments: YocoOrderPayment[];
}

const YOCO_API_BASE = "https://api.yoco.com";

/** Returns null for a 404 (order not found) — every other non-2xx throws, since that's unexpected. */
export async function fetchYocoOrder(orderId: string): Promise<YocoOrder | null> {
  const apiKey = process.env.YOCO_APPLICATION_API_KEY;
  if (!apiKey) {
    throw new Error("YOCO_APPLICATION_API_KEY is not configured — cannot resolve order.completed webhooks.");
  }

  const response = await fetch(`${YOCO_API_BASE}/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`Yoco order fetch failed (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  return (await response.json()) as YocoOrder;
}
