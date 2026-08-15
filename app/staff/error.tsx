"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Staff portal error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-6 py-16 text-center">
      <p className="font-display text-lg text-ink-900">Something went wrong</p>
      <p className="max-w-sm text-sm text-ink-700/70">
        This page couldn&rsquo;t load. This has been logged — try again, or come back in a moment.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
