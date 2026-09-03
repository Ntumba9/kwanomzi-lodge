import { z } from "zod";
import { MEAL_CATALOG } from "@/lib/content/meals";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

// Only the key + quantity travel from the client — label/unitPriceCents are
// always looked up server-side from lib/content/meals.ts's catalog
// (BookingService.createBooking), so a tampered request body can never
// change what a guest is actually charged for meals.
const mealKeys = MEAL_CATALOG.map((item) => item.key) as [string, ...string[]];
const selectedMealSchema = z.object({
  key: z.enum(mealKeys),
  quantity: z.number().int().min(1).max(50),
});

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
  // Optional meal add-ons (Breakfast/Lunch/Dinner), selected right when the
  // guest picks a room — see components/MealSelector.tsx.
  selectedMeals: z.array(selectedMealSchema).max(MEAL_CATALOG.length).optional(),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
