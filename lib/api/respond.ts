import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  INVALID_DATE_RANGE: 400,
  INVALID_STATUS_TRANSITION: 409,
  ROOM_NOT_FOUND: 404,
  ROOM_NOT_AVAILABLE: 409,
  BOOKING_NOT_FOUND: 404,
  PAYMENT_NOT_ALLOWED: 409,
  SERVICE_NOT_CONFIGURED: 503,
};

/**
 * Maps a caught error to a consistent { error: { code, message } } JSON
 * response. Unexpected errors are logged server-side with full detail but
 * never leak internals (stack traces, SQL, Prisma error text) to the client.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: err.issues[0]?.message ?? "Invalid request" } },
      { status: 400 },
    );
  }

  if (err instanceof DomainError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: DOMAIN_ERROR_STATUS[err.code] ?? 400 },
    );
  }

  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
