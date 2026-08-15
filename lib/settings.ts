import { prisma } from "@/lib/db/prisma";

// Fallback only — the real, authoritative value lives in the Setting table
// and is a business decision the client hasn't finalized yet (Phase 0 §21).
// This constant exists purely so the system behaves sensibly in dev/test
// before that row is seeded, not as a substitute for making it configurable.
const FALLBACK_BOOKING_HOLD_MINUTES = 15;
const BOOKING_HOLD_MINUTES_KEY = "BOOKING_HOLD_MINUTES";

export async function getBookingHoldMinutes(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: BOOKING_HOLD_MINUTES_KEY } });
  const parsed = setting ? Number(setting.value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_BOOKING_HOLD_MINUTES;
}

/** Staff-facing setter (see app/staff/settings) — writes the same Setting row getBookingHoldMinutes() reads. */
export async function setBookingHoldMinutes(minutes: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: BOOKING_HOLD_MINUTES_KEY },
    update: { value: String(minutes) },
    create: {
      key: BOOKING_HOLD_MINUTES_KEY,
      value: String(minutes),
      description: "Minutes a PENDING/PAYMENT_PENDING booking holds a room before it may expire.",
    },
  });
}

const RATE_CARD_KEY = "RATE_CARD";

export interface RateCardEntry {
  label: string;
  cents: number;
  note?: string;
}

export interface RateCard {
  accommodation: RateCardEntry[];
  meals: RateCardEntry[];
  packages: RateCardEntry[];
}

/**
 * The lodge's official accommodation/meal/package rate sheet, as supplied by
 * the client. Stored in the Setting table (not hardcoded in a component) so
 * the owner can update a price later without a code change — see the
 * Phase 3.5 report for why this lives here rather than on RoomType: the
 * client's Single/Double/Sharing categories don't have a confirmed mapping
 * to the seeded Garden Suite/Family Cottage room types, so this rate card
 * is presented as the lodge's general pricing, separate from (and not
 * assumed to equal) any specific RoomType.basePriceCents.
 */
export async function getRateCard(): Promise<RateCard | null> {
  const setting = await prisma.setting.findUnique({ where: { key: RATE_CARD_KEY } });
  if (!setting) return null;
  try {
    return JSON.parse(setting.value) as RateCard;
  } catch {
    return null;
  }
}

/** Staff-facing setter (see app/staff/settings) — writes the same Setting row getRateCard() reads. */
export async function setRateCard(rateCard: RateCard): Promise<void> {
  await prisma.setting.upsert({
    where: { key: RATE_CARD_KEY },
    update: { value: JSON.stringify(rateCard) },
    create: {
      key: RATE_CARD_KEY,
      value: JSON.stringify(rateCard),
      description: "Official KwaNomzi accommodation/meal/package rates.",
    },
  });
}
