import { timingSafeEqual } from "node:crypto";

/**
 * Plain `===` on a secret leaks timing information an attacker can use to
 * recover it byte-by-byte. Used by every shared-secret-guarded internal
 * route (app/api/internal/*, app/api/diag/*) instead of a direct string
 * comparison. Returns false (not a throw) for any shape mismatch, so a
 * missing/empty env var or header never accidentally reads as "equal".
 */
export function timingSafeSecretEquals(expected: string | undefined, provided: string | null): boolean {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
