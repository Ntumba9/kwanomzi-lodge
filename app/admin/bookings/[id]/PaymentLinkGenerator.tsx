"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { generatePaymentLinkAction } from "../actions";

export function PaymentLinkGenerator({ bookingId }: { bookingId: number }) {
  const [pending, startTransition] = useTransition();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generatePaymentLinkAction(bookingId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRedirectUrl(result.redirectUrl ?? null);
    });
  }

  async function handleCopy() {
    if (!redirectUrl) return;
    await navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-700/70">
        Generate a Yoco payment link for this booking to send the guest directly (e.g. via WhatsApp or email).
      </p>
      <div>
        <Button variant="secondary" onClick={handleGenerate} disabled={pending}>
          {pending ? "Generating…" : "Generate Payment Link"}
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {redirectUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-mist-200 bg-mist-50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-ink-800">{redirectUrl}</code>
          <Button size="md" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
