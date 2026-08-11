import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const availabilitySearchSchema = z.object({
  checkIn: dateOnly,
  checkOut: dateOnly,
});

export type AvailabilitySearchRequest = z.infer<typeof availabilitySearchSchema>;
