import { whatsappUrl } from "@/lib/content/business";

/**
 * Sitewide floating contact shortcut — WhatsApp is the primary informal
 * contact channel guests actually use for South African hospitality
 * businesses, and was missing entirely before this. Fixed position so it
 * follows scroll on every guest page; sits above the mobile sticky booking
 * bar (see StickyBookBar) via z-index and bottom offset, never overlapping
 * it.
 */
export function WhatsAppButton() {
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with KwaNomzi on WhatsApp"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-ink-950/20 transition hover:scale-105 hover:shadow-xl md:bottom-6"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.44 1.26 4.88L2 22l5.25-1.38A9.96 9.96 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2c-1.6 0-3.1-.43-4.4-1.19l-.32-.18-3.11.82.83-3.03-.2-.31a8.18 8.18 0 0 1-1.26-4.31c0-4.53 3.68-8.2 8.2-8.2s8.2 3.68 8.2 8.2-3.67 8.2-8.2 8.2Zm4.5-6.14c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.63.8-.78.96-.14.16-.28.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
