import { z } from "zod";

export const bookingHoldMinutesSchema = z.coerce.number().int().min(1).max(1440);

const rateCardEntrySchema = z.object({
  label: z.string().trim().min(1).max(100),
  cents: z.number().int().min(0),
  note: z.string().trim().max(200).optional(),
});

export const rateCardSchema = z.object({
  accommodation: z.array(rateCardEntrySchema),
  meals: z.array(rateCardEntrySchema),
  packages: z.array(rateCardEntrySchema),
});
