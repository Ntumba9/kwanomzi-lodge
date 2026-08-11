import Image from "next/image";
import { cn } from "@/lib/utils";
import { siteImages } from "@/lib/content/images";

/**
 * The real logo file hasn't been placed in the repo yet (it arrived as a
 * chat attachment, not a file on disk). Once it exists at
 * public/images/branding/kwanomzi-logo.png and siteImages.logo.src is set,
 * this renders the real file automatically — every call site stays the
 * same either way.
 *
 * The real-image branch uses a fixed-size relative container with `fill`
 * + `object-contain` rather than fixed width/height, so the logo's actual
 * aspect ratio is always preserved (never stretched) and never cropped,
 * regardless of the source file's true dimensions.
 *
 * Until the file exists, this renders a typographic mark styled directly
 * from the logo's own black badge + blue water-droplet motif: a dark
 * circular badge, a simple droplet glyph in the brand blue, and the
 * wordmark split the same way the real logo splits it ("Kwa" in blue,
 * "Nomzi" in stone).
 */
export function Logo({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  if (siteImages.logo.src) {
    return (
      <span className={cn("relative inline-block h-11 w-11 shrink-0", className)}>
        <Image src={siteImages.logo.src} alt={siteImages.logo.alt} fill sizes="44px" className="object-contain" />
      </span>
    );
  }

  const wordmarkColor = variant === "dark" ? "text-ink-950" : "text-mist-50";
  const subColor = variant === "dark" ? "text-stone-500" : "text-stone-300";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-950">
        <DropletIcon className="h-4.5 w-4.5 text-lagoon-400" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-lg font-semibold tracking-wide", wordmarkColor)}>
          <span className="text-lagoon-400">Kwa</span>
          {"Nomzi"}
        </span>
        <span className={cn("font-display text-[10px] italic tracking-wide", subColor)}>Boutique Lodge</span>
      </span>
    </span>
  );
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c-.3 0-.58.14-.76.38C9.7 4.9 5 11.2 5 15a7 7 0 0 0 14 0c0-3.8-4.7-10.1-6.24-12.62A.94.94 0 0 0 12 2Z" />
    </svg>
  );
}
