import { randomInt } from "node:crypto";

// Excludes 0/O and 1/I to avoid visual ambiguity when a guest reads this aloud or types it in.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 6;

/** Generates a human-readable booking reference, e.g. "KWZ-20260810-7F3K9Q". Not guaranteed unique on its own — callers must handle a unique-constraint retry. */
export function generateBookingReference(date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `KWZ-${datePart}-${suffix}`;
}
