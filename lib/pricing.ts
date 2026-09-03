import type { RoomTypePricingModel } from "@/lib/generated/prisma/client";

/**
 * The subset of RoomType fields computeRoomTypePriceCents needs — kept as
 * its own interface (rather than importing the full Prisma RoomType type)
 * so callers can pass a partial/plain object (e.g. from an API response)
 * without a full Prisma model shape.
 */
export interface RoomTypePriceInput {
  pricingModel: RoomTypePricingModel;
  basePriceCents: number;
  soloPriceCents: number | null;
  sharingPriceCents: number | null;
  perGuestPriceCents: number | null;
  capacity: number;
}

/**
 * Computes a room type's per-night price for a given party size, per its
 * pricingModel (see schema.prisma's RoomTypePricingModel for what each
 * value means). This is the single place all three models are
 * interpreted — every call site (availability display, BookingWizard,
 * BookingService.createBooking) goes through this function rather than
 * re-implementing the branching, so a guest never sees one number and gets
 * charged another.
 *
 * Room.priceOverrideCents is NOT handled here — callers apply that
 * precedence themselves (it wins over any of this, same as the original
 * flat-rate design), since this function only knows about RoomType, not a
 * specific Room.
 */
export function computeRoomTypePriceCents(roomType: RoomTypePriceInput, guestCount: number): number {
  const guests = Math.max(1, Math.floor(guestCount) || 1);

  switch (roomType.pricingModel) {
    case "OCCUPANCY_TIERED": {
      if (guests <= 1) return roomType.soloPriceCents ?? roomType.basePriceCents;
      return roomType.sharingPriceCents ?? roomType.basePriceCents;
    }
    case "PER_GUEST": {
      const rate = roomType.perGuestPriceCents ?? roomType.basePriceCents;
      const billableGuests = Math.min(guests, Math.max(1, roomType.capacity));
      return rate * billableGuests;
    }
    case "FLAT":
    default:
      return roomType.basePriceCents;
  }
}
