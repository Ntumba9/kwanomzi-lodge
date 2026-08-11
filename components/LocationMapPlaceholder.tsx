import { business } from "@/lib/content/business";

/**
 * No map integration/API key exists yet, and we don't invent one. This is a
 * polished placeholder that communicates the lodge's location without
 * claiming to be an interactive map — swap for a real embed (Google Maps,
 * Mapbox, etc.) once an API key/config is available.
 */
export function LocationMapPlaceholder() {
  return (
    <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border border-mist-200 bg-mist-100 md:aspect-[16/9]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 40%, rgba(91,152,201,0.25), transparent 45%), radial-gradient(circle at 70% 65%, rgba(154,160,166,0.25), transparent 45%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-2 px-6 text-center">
        <PinIcon className="h-7 w-7 text-lagoon-600" />
        <p className="font-display text-base text-ink-900">{business.address.full}</p>
        <p className="text-xs text-ink-700/60">Interactive map coming soon</p>
      </div>
    </div>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <path
        d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
