import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const createBookingSchema = z.object({
  roomId: z.number().int().positive(),
  checkIn: dateOnly,
  checkOut: dateOnly,
  // Phase 4: the prepaid flow's guest-details step collects phone and party
  // size as standard fields, not optional extras.
  guestCount: z.number().int().min(1).max(20),
  guest: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(1).max(30),
    specialRequests: z.string().trim().max(2000).optional(),
  }),
  specialRequests: z.string().trim().max(2000).optional(),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
