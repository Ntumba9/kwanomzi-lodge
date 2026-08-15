"use client";

import { useEffect, useRef } from "react";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { cn } from "@/lib/utils";
import type { VideoSlot } from "@/lib/content/images";

interface HeroMediaProps {
  video: VideoSlot;
  /** Falls back to this when the video itself has no poster set. */
  fallbackImageSrc: string | null;
  fallbackImageAlt: string;
  className?: string;
}

/**
 * Three-way fallback, in order: real video (muted/looped background), then
 * a static poster/hero image, then the same on-brand gradient placeholder
 * used everywhere else a real asset hasn't been supplied yet — so the hero
 * never shows a broken element, no matter which assets exist.
 *
 * Respects prefers-reduced-motion via the `motion-reduce:` Tailwind variant
 * (pure CSS, not JS state) — a viewer with that preference sees the poster/
 * placeholder instead of the video, and the effect below additionally
 * pauses the underlying element so it isn't silently decoding in the
 * background. Deliberately not done via `useState(matchMedia(...).matches)`:
 * `window` doesn't exist during SSR, so seeding state from it would produce
 * a different result on the server than on the client's first render — a
 * hydration mismatch. CSS media queries don't have that problem; they're
 * evaluated identically regardless of where the HTML came from.
 *
 * Runs full-bleed on mobile too. `preload="metadata"` (not `auto`) keeps
 * the initial page load from pulling the whole file — only enough to get
 * dimensions/poster timing, with the rest streaming in once playback
 * starts, so the poster image is what viewers actually see first.
 */
export function HeroMedia({ video, fallbackImageSrc, fallbackImageAlt, className }: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (query.matches) {
        el.pause();
      } else {
        el.play().catch(() => {
          // Autoplay can still be blocked by the browser despite `muted` in
          // rare cases (e.g. data-saver mode) — the poster frame underneath
          // covers that gracefully, nothing further to do.
        });
      }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const posterSrc = video.poster ?? fallbackImageSrc ?? undefined;

  if (!video.src) {
    return <PlaceholderImage label={fallbackImageAlt} src={fallbackImageSrc} showLabel={false} className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden bg-ink-950", className)}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={posterSrc}
        aria-hidden
      >
        <source src={video.src} type="video/mp4" />
      </video>
      {/* Static image behind: prefers-reduced-motion, or while the video buffers — never an empty layer. */}
      <PlaceholderImage
        label={fallbackImageAlt}
        src={posterSrc ?? null}
        showLabel={!posterSrc}
        className="absolute inset-0 motion-safe:hidden"
      />
    </div>
  );
}
