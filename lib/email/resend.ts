import { Resend } from "resend";

/**
 * Lazily constructed so importing this module (or anything that imports it)
 * never fails just because RESEND_API_KEY isn't set yet — e.g. in dev/test
 * environments without real email credentials. The error only surfaces when
 * something actually tries to send, with a message that says exactly what's
 * missing rather than an opaque SDK error.
 */
let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured — email sending is unavailable until it's set. See .env.example.",
    );
  }
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

/** The FROM address — must be on a domain verified with Resend; see .env.example. */
export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not configured — see .env.example.");
  }
  return from;
}
