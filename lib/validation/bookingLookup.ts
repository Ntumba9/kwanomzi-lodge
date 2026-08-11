import { z } from "zod";

export const bookingLookupSchema = z.object({
  reference: z.string().trim().min(1),
  email: z.string().trim().email(),
});

export type BookingLookupRequest = z.infer<typeof bookingLookupSchema>;
