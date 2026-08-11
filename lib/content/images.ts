/**
 * Central registry of brand/marketing image slots. No real KwaNomzi
 * photography or the logo file itself has been placed in the repository
 * yet — every `src` below is `null`, which tells <SiteImage> / <Logo> to
 * render the on-brand PlaceholderImage instead of a broken <img>.
 *
 * To go live with a real asset: drop the file at the given `path` under
 * `public/`, then set that entry's `src` to the same path. Nothing else
 * needs to change — every component that renders these already handles
 * both states.
 */
export interface ImageSlot {
  path: string;
  src: string | null;
  alt: string;
}

export const siteImages = {
  logo: {
    path: "/images/branding/kwanomzi-logo.png",
    src: null,
    alt: "KwaNomzi Boutique Lodge logo",
  },
  hero: {
    path: "/images/lodge/hero.jpg",
    src: null,
    alt: "KwaNomzi Boutique Lodge — grounds and entrance",
  },
  lodgeIntro: {
    path: "/images/lodge/exterior.jpg",
    src: null,
    alt: "KwaNomzi Boutique Lodge — lodge exterior",
  },
  dining: {
    path: "/images/dining/dining-area.jpg",
    src: null,
    alt: "KwaNomzi Boutique Lodge — dining area",
  },
} as const satisfies Record<string, ImageSlot>;

/**
 * Room-type photography is DB-driven (RoomImage.url), but the currently
 * seeded rows point at non-existent example.com URLs (Phase 2 seed data),
 * not real photographs. Until real RoomImage rows exist, room cards render
 * the same PlaceholderImage treatment rather than requesting a broken URL.
 */
export function resolveRoomImageSrc(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("https://example.com/") ? null : url;
}
