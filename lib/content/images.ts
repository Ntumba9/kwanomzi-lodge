/**
 * Central registry of brand/marketing image slots. Most `src` values below
 * are still `null` (no real KwaNomzi photography/logo file placed in the
 * repo yet for those slots), which tells <SiteImage> / <Logo> to render the
 * on-brand PlaceholderImage instead of a broken <img>.
 *
 * To go live with a real asset: drop the file at the given `path` under
 * `public/`, then set that entry's `src` to the same path. Nothing else
 * needs to change — every component that renders these already handles
 * both states. `hero` below is the one slot that's already real.
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
    path: "/images/branding/NewBack1.jpeg",
    src: "/images/branding/NewBack1.jpeg",
    alt: "The hills and cliffs of KwaBushula, Lusikisiki, near KwaNomzi Boutique Lodge",
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
