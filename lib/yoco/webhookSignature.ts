import { createHmac, timingSafeEqual } from "node:crypto";

// Yoco's own recommendation — see developer.yoco.com/online/api-reference/webhooks/verifying-events.
const REPLAY_TOLERANCE_MS = 3 * 60 * 1000;

export interface YocoWebhookHeaders {
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
}

/**
 * Verifies a Yoco webhook per their documented algorithm (verified against
 * current docs, not assumed — see Phase 4 plan):
 *
 *   signedContent = "{webhook-id}.{webhook-timestamp}.{raw-body}"
 *   secretBytes   = base64-decode(secret with "whsec_" prefix stripped)
 *   expected      = base64(HMAC-SHA256(secretBytes, signedContent))
 *
 * webhook-signature is a space-separated list of "v1,<sig>" entries; any
 * one matching is sufficient. webhook-timestamp is checked against a 3
 * minute window to block replay of an old (even genuinely-signed) event.
 *
 * Deliberately takes the raw request body as a string, not a parsed
 * object — signing a re-serialized JSON.stringify() of the parsed body
 * would silently break the moment key order or whitespace differs from
 * what Yoco actually sent.
 */
export function verifyYocoWebhookSignature(
  headers: YocoWebhookHeaders,
  rawBody: string,
  secret: string,
  now: number = Date.now(),
): boolean {
  const { webhookId, webhookTimestamp, webhookSignature } = headers;
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;
  if (!secret.startsWith("whsec_")) return false;

  const timestampSeconds = Number(webhookTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now - timestampSeconds * 1000) > REPLAY_TOLERANCE_MS) return false;

  const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuffer = Buffer.from(expected);

  return webhookSignature
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((provided) => {
      const providedBuffer = Buffer.from(provided);
      return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
    });
}
