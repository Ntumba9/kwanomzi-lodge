// Client-side contract types for the booking flow's fetch calls. Deliberately
// decoupled from Prisma's generated types (which model dates as Date objects)
// since everything here has already passed through JSON over HTTP.

export interface AvailableRoom {
  id: number;
  name: string;
  priceOverrideCents: number | null;
}

export interface AvailabilityResult {
  roomType: {
    id: number;
    name: string;
    description: string | null;
    capacity: number;
    basePriceCents: number;
    amenities: { id: number; name: string }[];
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
