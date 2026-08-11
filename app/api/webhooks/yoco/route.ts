import { NextResponse } from "next/server";
import { processYocoWebhook } from "@/lib/services/WebhookService";

// Deliberately thin: read the raw body + headers, hand off to the service,
// map its outcome to a status code. All decision-making lives in
// WebhookService so it stays unit/integration-testable without an HTTP
// server in the loop.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const outcome = await processYocoWebhook(rawBody, {
    webhookId: request.headers.get("webhook-id"),
    webhookTimestamp: request.headers.get("webhook-timestamp"),
    webhookSignature: request.headers.get("webhook-signature"),
  });

  switch (outcome.result) {
    case "invalid_signature":
      return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed." } }, { status: 401 });
    case "malformed":
      return NextResponse.json({ error: { code: "MALFORMED_PAYLOAD", message: "Could not parse webhook payload." } }, { status: 400 });
    // Everything else is a case we understood and handled (even if the
    // outcome was "don't confirm this") — Yoco should not retry any of
    // these, so all return 200.
    case "duplicate":
    case "unmatched_payment":
    case "amount_mismatch":
    case "stale_booking":
    case "confirmed":
    case "payment_failed":
    case "ignored_event_type":
      return NextResponse.json({ received: true, result: outcome.result });
  }
}
