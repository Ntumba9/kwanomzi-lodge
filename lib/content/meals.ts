/**
 * KwaNomzi's official meal add-on prices, as supplied by the client
 * (matches the existing RATE_CARD meals entries in prisma/seed.ts and
 * lib/settings.ts — same figures, now also wired into the actual booking
 * total rather than only shown as a reference rate sheet).
 *
 * This is the single source of truth for meal keys/labels/prices — the
 * server (BookingService.createBooking) always reads unit prices from
 * here, never trusts a price the client sends, so a tampered request body
 * can't change what a guest is actually charged.
 */
export type MealKey = "breakfast" | "lunch" | "dinner";

export interface MealCatalogItem {
  key: MealKey;
  label: string;
  priceCents: number;
}

export const MEAL_CATALOG: readonly MealCatalogItem[] = [
  { key: "breakfast", label: "Breakfast", priceCents: 18_000 },
  { key: "lunch", label: "Lunch", priceCents: 16_000 },
  { key: "dinner", label: "Dinner", priceCents: 28_000 },
];

export function getMealCatalogItem(key: string): MealCatalogItem | undefined {
  return MEAL_CATALOG.find((item) => item.key === key);
}

/** A guest's chosen quantity of one catalog item, with its price snapshotted at selection time. */
export interface SelectedMeal {
  key: MealKey;
  label: string;
  unitPriceCents: number;
  quantity: number;
}

export function calculateMealsTotalCents(selected: SelectedMeal[]): number {
  return selected.reduce((sum, meal) => sum + meal.unitPriceCents * meal.quantity, 0);
}

/**
 * Builds SelectedMeal[] from a plain {key: quantity} map (the shape both
 * HomeQuickReservation and BookingWizard hold as UI state), looking up
 * label/price from the catalog and dropping any zero-quantity or unknown
 * keys. Shared so both call sites — and BookingService server-side — build
 * this the exact same way.
 */
export function selectedMealsFromQuantities(quantities: Partial<Record<MealKey, number>>): SelectedMeal[] {
  const result: SelectedMeal[] = [];
  for (const item of MEAL_CATALOG) {
    const quantity = quantities[item.key] ?? 0;
    if (quantity > 0) {
      result.push({ key: item.key, label: item.label, unitPriceCents: item.priceCents, quantity });
    }
  }
  return result;
}
