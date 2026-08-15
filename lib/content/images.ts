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

export interface VideoSlot {
  path: string;
  src: string | null;
  poster: string | null;
  description: string;
}

/**
 * The homepage hero's background video — same drop-in-a-file convention as
 * siteImages below. `poster` reuses siteImages.hero once that's real; until
 * then, both are null and the hero renders the placeholder gradient. See
 * components/HeroMedia.tsx for exactly how these three states (video, poster
 * image only, placeholder) get chosen.
 */
export const siteVideos = {
  hero: {
    path: "/videos/lodge-hero.mp4",
    src: "/videos/lodge-hero.mp4",
    poster: null,
    description:
      "Temporary licensed stock footage (Pexels — aerial view of a green resort with wooden huts, by Nguyễn Thành Nhơn) standing in for real KwaNomzi grounds/pool/exterior footage until that's shot.",
  },
} as const satisfies Record<string, VideoSlot>;

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

/**
 * Gallery ordering for a room type's photos: the primary photo always
 * leads (it's what RoomCard also uses as the single featured image), then
 * the rest follow by displayOrder. Real KwaNomzi photos are always set as
 * primary when both exist for a room type — see the room-image seed
 * script — so this alone is what keeps a genuine photo first without the
 * gallery needing to know about RoomImage.source itself.
 */
export function sortRoomImages<T extends { isPrimary: boolean; displayOrder: number }>(images: T[]): T[] {
  return [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.displayOrder - b.displayOrder;
  });
}
