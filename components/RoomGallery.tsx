"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";

export interface RoomGalleryImage {
  id: number;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  source: "LODGE" | "STOCK";
}

interface RoomGalleryProps {
  roomName: string;
  images: RoomGalleryImage[];
  className?: string;
}

/**
 * Room photo gallery: a horizontal scroll-snap strip (native touch swipe on
 * mobile, no JS drag handling needed) with thumbnail nav and a fullscreen
 * lightbox, backed entirely by RoomImage rows — nothing here is a hardcoded
 * URL. STOCK images (temporary licensed photos standing in for real
 * KwaNomzi photography that hasn't been supplied yet) get a small corner
 * label so they're never mistaken for an actual photo of the lodge; LODGE
 * images get none. See lib/content/images.ts / RoomImage.source for how
 * that distinction is made and stored.
 *
 * Every slide sits in a fixed-aspect-ratio box so the gallery reserves its
 * final layout space before any image finishes loading — no shift once
 * photos arrive. Only the first (primary) image loads eagerly; the rest
 * use next/image's default lazy loading.
 */
export function RoomGallery({ roomName, images, className }: RoomGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const lightboxTrackRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (track: HTMLDivElement | null, index: number) => {
    const slide = track?.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const handleTrackScroll = useCallback((track: HTMLDivElement) => {
    const slideWidth = track.clientWidth;
    if (!slideWidth) return;
    const index = Math.round(track.scrollLeft / slideWidth);
    setActiveIndex((prev) => (prev === index ? prev : index));
  }, []);

  const goTo = (index: number) => {
    const clamped = (index + images.length) % images.length;
    setActiveIndex(clamped);
    scrollToIndex(trackRef.current, clamped);
    scrollToIndex(lightboxTrackRef.current, clamped);
  };

  useEffect(() => {
    if (lightboxOpen) scrollToIndex(lightboxTrackRef.current, activeIndex);
    // Sync the lightbox's scroll position to whatever slide was active in
    // the inline gallery only at the moment it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") goTo(activeIndex + 1);
      if (e.key === "ArrowLeft") goTo(activeIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, activeIndex]);

  if (images.length === 0) {
    return (
      <PlaceholderImage
        label={roomName}
        className={cn("aspect-[4/3] w-full rounded-2xl sm:aspect-[16/9]", className)}
      />
    );
  }

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={(e) => handleTrackScroll(e.currentTarget)}
          className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl sm:aspect-[16/9] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`View ${image.altText ?? roomName} fullscreen`}
              className="relative h-full w-full shrink-0 snap-start overflow-hidden bg-ink-950"
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${roomName} — photo ${index + 1}`}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
                priority={index === 0}
                loading={index === 0 ? undefined : "lazy"}
              />
              {image.source === "STOCK" && (
                <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium text-mist-50 backdrop-blur-sm">
                  Similar room shown
                </span>
              )}
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-mist-50/90 text-ink-900 shadow-sm transition hover:bg-mist-50"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-mist-50/90 text-ink-900 shadow-sm transition hover:bg-mist-50"
            >
              ›
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs text-mist-50 backdrop-blur-sm">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === activeIndex}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1 transition",
                index === activeIndex ? "ring-lagoon-600" : "ring-transparent hover:ring-mist-300",
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${roomName} photos`}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close fullscreen view"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-mist-50/10 text-2xl text-mist-50 transition hover:bg-mist-50/20"
          >
            ×
          </button>

          <div
            ref={lightboxTrackRef}
            className="flex h-full max-h-[85vh] w-full max-w-5xl snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {images.map((image, index) => (
              <div key={image.id} className="relative h-full w-full shrink-0 snap-start">
                <Image
                  src={image.url}
                  alt={image.altText ?? `${roomName} — photo ${index + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  loading={Math.abs(index - activeIndex) <= 1 ? undefined : "lazy"}
                />
                {image.source === "STOCK" && (
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium text-mist-50 backdrop-blur-sm">
                    Similar room shown — not an actual photo of this room
                  </span>
                )}
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous photo"
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-mist-50/10 text-2xl text-mist-50 transition hover:bg-mist-50/20"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-mist-50/10 text-2xl text-mist-50 transition hover:bg-mist-50/20"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
