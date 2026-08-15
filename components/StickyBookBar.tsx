"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Mobile-only persistent booking CTA. The header's own "Book Now" button
 * scrolls out of view immediately on a phone, so without this the only way
 * back to booking on a long page is scrolling all the way back up — a real
 * conversion cost on the device most guests actually browse from.
 *
 * Hidden on /book itself (already mid-booking, the CTA would be redundant)
 * and on /staff routes (guest conversion chrome has no business there,
 * though the guest layout never wraps staff pages anyway — this is just
 * defense in depth).
 */
export function StickyBookBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/book") || pathname.startsWith("/staff")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-mist-200 bg-mist-50/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-900">Ready to stay at KwaNomzi?</p>
        <p className="truncate text-xs text-ink-700/60">Check dates and reserve your room</p>
      </div>
      <Button href="/book" size="md" className="shrink-0">
        Book Now
      </Button>
    </div>
  );
}
