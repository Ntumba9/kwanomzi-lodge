import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * No real KwaNomzi photography has been supplied yet, and per instruction
 * we don't invent fake stock photos and present them as the real lodge.
 * This renders a clearly-labelled, on-brand placeholder wherever a real
 * photograph will eventually go.
 *
 * Pass `src` once a real file exists under public/images/ (see
 * lib/content/images.ts) and this renders the actual photo instead — every
 * call site stays the same either way, nothing else needs to change.
 *
 * Pass `showLabel={false}` when this is used as a full-bleed background
 * behind other overlaid content (e.g. a hero section) — the label centers
 * itself within the whole element, which collides with foreground text at
 * large sizes. Real headings already communicate what the image would show
 * in that case, so the label is redundant there anyway.
 */
export function PlaceholderImage({
  label,
  src,
  showLabel = true,
  className,
}: {
  label: string;
  src?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image src={src} alt={label} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-lagoon-700",
        className,
      )}
    >
      {/* Soft droplet-like glows, echoing the logo's blue-on-black treatment. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 22% 25%, rgba(127,176,218,0.45), transparent 40%), radial-gradient(circle at 78% 68%, rgba(91,152,201,0.4), transparent 45%)",
        }}
      />
      {showLabel && (
        <span className="relative px-4 text-center font-display text-sm tracking-wide text-mist-100/80">
          {label}
          <br />
          <span className="text-xs font-sans text-mist-100/50">Photo coming soon</span>
        </span>
      )}
    </div>
  );
}
