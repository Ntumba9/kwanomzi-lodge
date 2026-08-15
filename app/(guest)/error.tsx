"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { business } from "@/lib/content/business";

export default function GuestError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Guest site error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center md:px-8">
      <p className="font-display text-2xl text-ink-900">Something went wrong</p>
      <p className="text-sm text-ink-700/70">
        This page couldn&rsquo;t load. Please try again — if it keeps happening, contact us directly at{" "}
        <a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="font-medium text-lagoon-600 hover:underline">
          {business.phone}
        </a>{" "}
        or{" "}
        <a href={`mailto:${business.email}`} className="font-medium text-lagoon-600 hover:underline">
          {business.email}
        </a>
        .
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
