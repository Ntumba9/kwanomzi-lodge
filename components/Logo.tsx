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
 *
 * `size="header"` is a bolder, larger treatment for the sticky nav bar —
 * the client asked for the top-left branding to carry the same confident,
 * bold typographic presence as the hero heading (font-bold, larger scale)
 * rather than the smaller/lighter mark used elsewhere (e.g. the footer,
 * which keeps the original "default" size — that placement doesn't need
 * to compete with a hero and stays as it was).
 */
export function Logo({
  variant = "light",
  size = "default",
  className,
}: {
  variant?: "light" | "dark";
  size?: "default" | "header";
  className?: string;
}) {
  if (siteImages.logo.src) {
    const dimension = size === "header" ? "h-12 w-12 md:h-14 md:w-14" : "h-11 w-11";
    return (
      <span className={cn("relative inline-block shrink-0", dimension, className)}>
        <Image src={siteImages.logo.src} alt={siteImages.logo.alt} fill sizes="56px" className="object-contain" />
      </span>
    );
  }

  const wordmarkColor = variant === "dark" ? "text-ink-950" : "text-mist-50";
  const subColor = variant === "dark" ? "text-stone-500" : "text-stone-300";
  const isHeader = size === "header";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-ink-950",
          isHeader ? "h-11 w-11 md:h-12 md:w-12" : "h-9 w-9",
        )}
      >
        <DropletIcon className={isHeader ? "h-5 w-5 md:h-5.5 md:w-5.5 text-lagoon-400" : "h-4.5 w-4.5 text-lagoon-400"} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display tracking-wide",
            isHeader ? "text-2xl font-bold md:text-3xl" : "text-lg font-semibold",
            wordmarkColor,
          )}
        >
          <span className="text-lagoon-400">Kwa</span>
          {"Nomzi"}
        </span>
        <span
          className={cn(
            "font-display italic tracking-wide",
            isHeader ? "text-xs md:text-sm" : "text-[10px]",
            subColor,
          )}
        >
          Boutique Lodge
        </span>
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
