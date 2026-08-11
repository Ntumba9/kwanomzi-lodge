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
