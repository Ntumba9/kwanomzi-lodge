/**
 * The lodge's confirmed business facts, supplied directly by the client
 * (Phase 3.5). This is the single place these values are written — every
 * page/component imports from here rather than repeating strings, so a
 * future correction only needs to happen once.
 *
 * Deliberately excluded because they were never supplied and must not be
 * invented: additional phone numbers, additional addresses, social media
 * accounts, awards, star ratings, reviews, nearby attractions, business
 * history.
 */
export const business = {
  name: "KwaNomzi Boutique Lodge",
  email: "kwanomzilodge@gmail.com",
  phone: "+27 76 939 7629",
  address: {
    line1: "R61, KwaBushula",
    line2: "Lusikisiki 4820",
    full: "R61, KwaBushula, Lusikisiki 4820",
  },
  tagline: "A haven to unwind",
} as const;

/**
 * Where staff/owner transactional notifications are sent — currently just
 * the paid-reservation notification (see EmailService.sendStaffPaidReservationEmail),
 * fired once per booking the moment a payment is verified. Deliberately
 * separate from `business.email` above: that one is the *public* contact
 * address shown on the website (footer, contact section, mailto links,
 * guest-facing email footers) — changing where internal notifications land
 * shouldn't silently change what guests see as the lodge's contact email.
 */
export const staffNotificationEmail = "info@kwanomziboutiquelodge.co.za";

/**
 * wa.me deep link built from the same phone number above — not a separate
 * contact detail, just WhatsApp's own URL format (international number,
 * digits only, no leading +). Prefilled text is a generic greeting, not a
 * claim about response times or availability we haven't confirmed.
 */
export const whatsappUrl = `https://wa.me/${business.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
  `Hi KwaNomzi, I'd like to ask about a stay at the lodge.`,
)}`;

/**
 * Google Maps "get directions" deep link, built from the lodge's own
 * confirmed address above (never invented/guessed coordinates). The
 * `maps/dir/?api=1&destination=` form works as a plain URL on both
 * desktop (opens Google Maps in a new tab) and mobile (the OS/browser can
 * hand this off to the native Maps app where one is installed) — no
 * separate mobile-specific link needed. Same formula components/LocationMap.tsx
 * already uses; exported here so other call sites (e.g. the hero's
 * location link) share the exact same URL rather than recomputing it.
 */
export const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address.full)}`;
