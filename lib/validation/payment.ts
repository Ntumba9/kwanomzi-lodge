import { z } from "zod";

// Mirrors bookingLookupSchema's reference+email ownership proof rather than
// accepting a raw bookingId — there are no guest accounts (per the approved
// architecture), so reference+email is the established way a guest proves
// a booking is theirs before the API acts on it. Staff-initiated checkouts
// go through a separate, session-authenticated server action instead (see
// app/staff/bookings/actions.ts) and don't need this schema.
export const initiateCheckoutSchema = z.object({
  bookingReference: z.string().trim().min(1),
  email: z.string().trim().email(),
});

export type InitiateCheckoutRequest = z.infer<typeof initiateCheckoutSchema>;
