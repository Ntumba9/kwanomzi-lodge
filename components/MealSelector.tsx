"use client";

import { MEAL_CATALOG, type MealKey } from "@/lib/content/meals";
import { formatMoney } from "@/lib/format";

/**
 * Shared quantity-stepper UI for the meal add-ons (Breakfast/Lunch/Dinner)
 * — used by both HomeQuickReservation and BookingWizard so "add meals when
 * a room is selected" is one implementation, not two. Fully controlled:
 * the parent owns the {key: quantity} state and passes it back down, same
 * pattern as every other field in both booking flows.
 */
export function MealSelector({
  quantities,
  onChange,
}: {
  quantities: Partial<Record<MealKey, number>>;
  onChange: (key: MealKey, quantity: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Add meals (optional)</p>
      {MEAL_CATALOG.map((item) => {
        const quantity = quantities[item.key] ?? 0;
        return (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-mist-200 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">{item.label}</p>
              <p className="text-xs text-ink-700/60">{formatMoney(item.priceCents)} each</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`Decrease ${item.label}`}
                onClick={() => onChange(item.key, Math.max(0, quantity - 1))}
                disabled={quantity === 0}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-100 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-4 text-center text-sm text-ink-900">{quantity}</span>
              <button
                type="button"
                aria-label={`Increase ${item.label}`}
                onClick={() => onChange(item.key, Math.min(50, quantity + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-100"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
