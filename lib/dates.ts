const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a "YYYY-MM-DD" string as a UTC midnight Date, avoiding local-timezone shift bugs. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date string, got "${value}"`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): Date {
  return parseDateOnly(formatDateOnly(new Date()));
}

/** Every night occupied by a stay of [checkIn, checkOut) — check-out day itself is excluded. */
export function nightsBetween(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(checkIn);
  while (cursor.getTime() < checkOut.getTime()) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

export function countNights(checkIn: Date, checkOut: Date): number {
  const msPerNight = 24 * 60 * 60 * 1000;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / msPerNight);
}

/**
 * The date-range rule shared by booking creation and availability search:
 * checkOut must be after checkIn, and checkIn can't be in the past. Lives
 * here (not in BookingService) so AvailabilityService can apply the exact
 * same rule without one service importing from another.
 */
export function assertValidDateRange(checkIn: Date, checkOut: Date): void {
  if (!(checkOut.getTime() > checkIn.getTime())) {
    throw new RangeError("checkOut must be after checkIn");
  }
  if (checkIn.getTime() < todayUtc().getTime()) {
    throw new RangeError("checkIn cannot be in the past");
  }
}
