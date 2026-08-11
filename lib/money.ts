/**
 * All money is integer ZAR cents — see schema.prisma header for why. Never
 * introduce floating-point arithmetic for money anywhere in this codebase.
 */
export function calculateTotalCents(pricePerNightCents: number, nightCount: number): number {
  if (!Number.isInteger(pricePerNightCents) || pricePerNightCents < 0) {
    throw new RangeError("pricePerNightCents must be a non-negative integer");
  }
  if (!Number.isInteger(nightCount) || nightCount < 1) {
    throw new RangeError("nightCount must be a positive integer");
  }
  return pricePerNightCents * nightCount;
}
