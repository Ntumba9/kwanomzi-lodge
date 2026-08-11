"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RetryPaymentButton({ bookingReference, email }: { bookingReference: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingReference, email }),
      });
      const body = (await res.json()) as { data?: { redirectUrl: string }; error?: { message: string } };
      if (!res.ok || !body.data) {
        setError(body.error?.message ?? "Could not start payment right now.");
        setLoading(false);
        return;
      }
      window.location.href = body.data.redirectUrl;
    } catch {
      setError("Could not start payment right now.");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button size="lg" onClick={handleClick} disabled={loading}>
        {loading ? "Starting payment…" : "Try Payment Again"}
      </Button>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
