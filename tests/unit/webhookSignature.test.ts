import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyYocoWebhookSignature } from "@/lib/yoco/webhookSignature";

const SECRET = "whsec_" + Buffer.from("test-signing-key-bytes").toString("base64");

function sign(webhookId: string, webhookTimestamp: string, rawBody: string, secret = SECRET): string {
  const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${signature}`;
}

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("verifyYocoWebhookSignature", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const rawBody = JSON.stringify({ id: "evt_1", type: "payment.succeeded" });
    const webhookId = "msg_1";
    const webhookTimestamp = nowSeconds();
    const webhookSignature = sign(webhookId, webhookTimestamp, rawBody);

    expect(verifyYocoWebhookSignature({ webhookId, webhookTimestamp, webhookSignature }, rawBody, SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const webhookId = "msg_1";
    const webhookTimestamp = nowSeconds();
    const wrongSecret = "whsec_" + Buffer.from("a-completely-different-key").toString("base64");
    const webhookSignature = sign(webhookId, webhookTimestamp, rawBody, wrongSecret);

    expect(verifyYocoWebhookSignature({ webhookId, webhookTimestamp, webhookSignature }, rawBody, SECRET)).toBe(false);
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const originalBody = JSON.stringify({ id: "evt_1", amount: 100000 });
    const tamperedBody = JSON.stringify({ id: "evt_1", amount: 1 });
    const webhookId = "msg_1";
    const webhookTimestamp = nowSeconds();
    const webhookSignature = sign(webhookId, webhookTimestamp, originalBody);

    expect(verifyYocoWebhookSignature({ webhookId, webhookTimestamp, webhookSignature }, tamperedBody, SECRET)).toBe(false);
  });

  it("rejects a timestamp outside the 3 minute replay window", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const webhookId = "msg_1";
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 10 * 60); // 10 minutes ago
    const webhookSignature = sign(webhookId, staleTimestamp, rawBody);

    expect(
      verifyYocoWebhookSignature({ webhookId, webhookTimestamp: staleTimestamp, webhookSignature }, rawBody, SECRET),
    ).toBe(false);
  });

  it("rejects when required headers are missing", () => {
    const rawBody = "{}";
    expect(
      verifyYocoWebhookSignature({ webhookId: null, webhookTimestamp: nowSeconds(), webhookSignature: "v1,x" }, rawBody, SECRET),
    ).toBe(false);
    expect(
      verifyYocoWebhookSignature({ webhookId: "msg_1", webhookTimestamp: null, webhookSignature: "v1,x" }, rawBody, SECRET),
    ).toBe(false);
    expect(
      verifyYocoWebhookSignature({ webhookId: "msg_1", webhookTimestamp: nowSeconds(), webhookSignature: null }, rawBody, SECRET),
    ).toBe(false);
  });

  it("matches against any entry in a space-separated multi-signature header", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const webhookId = "msg_1";
    const webhookTimestamp = nowSeconds();
    const real = sign(webhookId, webhookTimestamp, rawBody);
    const webhookSignature = `v1,bogussignaturevalue ${real}`;

    expect(verifyYocoWebhookSignature({ webhookId, webhookTimestamp, webhookSignature }, rawBody, SECRET)).toBe(true);
  });
});
