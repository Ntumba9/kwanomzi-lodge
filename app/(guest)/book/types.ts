// Client-side contract types for the booking flow's fetch calls. Deliberately
// decoupled from Prisma's generated types (which model dates as Date objects)
// since everything here has already passed through JSON over HTTP.

export interface AvailableRoom {
  id: number;
  name: string;
  priceOverrideCents: number | null;
}

export interface RoomImageSummary {
  id: number;
  url: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

// See prisma/schema.prisma's RoomTypePricingModel and lib/pricing.ts's
// computeRoomTypePriceCents for what each value means and how the
// solo/sharing/perGuest fields below are interpreted.
export type RoomTypePricingModel = "FLAT" | "OCCUPANCY_TIERED" | "PER_GUEST";

export interface AvailabilityResult {
  roomType: {
    id: number;
    name: string;
    description: string | null;
    capacity: number;
    basePriceCents: number;
    // AvailabilityService.searchAvailableRoomTypes already returns every
    // scalar RoomType column (it's a plain Prisma findMany, no `select`),
    // these three just weren't declared here until pricing needed them —
    // see lib/pricing.ts's computeRoomTypePriceCents.
    pricingModel: RoomTypePricingModel;
    soloPriceCents: number | null;
    sharingPriceCents: number | null;
    perGuestPriceCents: number | null;
    amenities: { id: number; name: string }[];
    // AvailabilityService.searchAvailableRoomTypes already includes this —
    // it just wasn't declared here until the homepage quick-reservation
    // widget needed to render a real room photo.
    images: RoomImageSummary[];
  };
  availableRooms: AvailableRoom[];
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests: string;
}

export interface ApiError {
  error: { code: string; message: string };
}
