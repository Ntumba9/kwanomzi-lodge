import { BookingWizard } from "./BookingWizard";
import { MEAL_CATALOG, type MealKey } from "@/lib/content/meals";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  const n = value ? Number(value) : undefined;
  return n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const params = await searchParams;

  const roomTypeIdParam = firstValue(params.roomTypeId);
  const initialRoomTypeId = roomTypeIdParam ? Number(roomTypeIdParam) : undefined;

  // Populated when arriving from the homepage quick-reservation widget
  // (components/HomeQuickReservation.tsx) — see BookingWizard's own props
  // doc comment for how these are used (re-verified, never trusted as-is).
  const initialCheckIn = firstValue(params.checkIn);
  const initialCheckOut = firstValue(params.checkOut);
  const initialGuestCount = parsePositiveInt(firstValue(params.guestCount));
  // Display-only breakdown of the above — see BookingWizard's doc comment.
  const initialAdults = parsePositiveInt(firstValue(params.adults));
  const initialChildren = firstValue(params.children) !== undefined ? Number(firstValue(params.children)) : undefined;

  // Meal picks carried through from the homepage widget (meal_breakfast=2
  // etc — see HomeQuickReservation's continueToReserve). Editable in the
  // wizard itself, same as every other "initial" value here.
  const initialMeals: Partial<Record<MealKey, number>> = {};
  for (const item of MEAL_CATALOG) {
    const quantity = parsePositiveInt(firstValue(params[`meal_${item.key}`]));
    if (quantity !== undefined) initialMeals[item.key] = quantity;
  }

  return (
    <BookingWizard
      initialRoomTypeId={Number.isFinite(initialRoomTypeId) ? initialRoomTypeId : undefined}
      initialCheckIn={initialCheckIn}
      initialCheckOut={initialCheckOut}
      initialGuestCount={initialGuestCount}
      initialAdults={initialAdults}
      initialChildren={
        initialChildren !== undefined && Number.isFinite(initialChildren) && initialChildren >= 0
          ? initialChildren
          : undefined
      }
      initialMeals={initialMeals}
    />
  );
}
