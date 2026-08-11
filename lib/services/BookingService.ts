import { prisma } from "@/lib/db/prisma";
import { Prisma, type BookingStatus } from "@/lib/generated/prisma/client";
import { assertValidDateRange, countNights, nightsBetween, parseDateOnly, todayUtc } from "@/lib/dates";
import { calculateTotalCents } from "@/lib/money";
import { generateBookingReference } from "@/lib/bookingReference";
import { getBookingHoldMinutes } from "@/lib/settings";
import { findOrCreateGuest, type GuestInput } from "@/lib/services/GuestService";
import { sendGuestBookingExpiredEmail } from "@/lib/services/EmailService";
import { toBookingEmailData } from "@/lib/email/mappers";
import {
  InvalidDateRangeError,
  InvalidStatusTransitionError,
  RoomNotAvailableError,
  RoomNotFoundError,
} from "@/lib/errors";

export interface CreateBookingInput {
  roomId: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guest: GuestInput;
  guestCount?: number;
  specialRequests?: string;
}

const MAX_TRANSACTION_RETRIES = 3;
const MAX_REFERENCE_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 25;

/**
 * Creates a PAYMENT_PENDING booking — KwaNomzi is prepaid, so the moment a
 * booking exists it's already committed to "guest must pay to keep this,"
 * not a separate PENDING-then-PAYMENT_PENDING two-step. This is the write
 * path the whole double-booking prevention strategy hinges on — see
 * prisma/schema.prisma's BookingNight comment for the mechanism, and the
 * notes on withDeadlockRetry / isBookingNightConflict below for why this is
 * safe under concurrency.
 */
export async function createBooking(input: CreateBookingInput) {
  const checkIn = parseDateOnly(input.checkIn);
  const checkOut = parseDateOnly(input.checkOut);
  validateDateRange(checkIn, checkOut);

  const nights = nightsBetween(checkIn, checkOut);
  const nightCount = countNights(checkIn, checkOut);
  const holdMinutes = await getBookingHoldMinutes();

  return withDeadlockRetry(() =>
    prisma.$transaction(
      async (tx) => {
        // Room-row lock: serializes concurrent attempts on the SAME room so
        // contention resolves as a clean queue instead of racing multi-row
        // inserts against each other. This is a concurrency-smoothing layer,
        // not the correctness guarantee — that's the UNIQUE constraint below,
        // which holds even if this lock were somehow bypassed by a bug
        // elsewhere.
        const locked = await tx.$queryRaw<
          { id: number }[]
        >`SELECT id FROM room WHERE id = ${input.roomId} FOR UPDATE`;
        if (locked.length === 0) {
          throw new RoomNotFoundError();
        }

        const room = await tx.room.findUniqueOrThrow({
          where: { id: input.roomId },
          include: { roomType: true },
        });
        const pricePerNightCents = room.priceOverrideCents ?? room.roomType.basePriceCents;
        const totalAmountCents = calculateTotalCents(pricePerNightCents, nightCount);

        const guest = await findOrCreateGuest(input.guest, tx);
        const bookingReference = await createUniqueBookingReference(tx);

        const booking = await tx.booking.create({
          data: {
            bookingReference,
            guestId: guest.id,
            roomId: input.roomId,
            checkIn,
            checkOut,
            nights: nightCount,
            pricePerNightCents,
            totalAmountCents,
            specialRequests: input.specialRequests,
            guestCount: input.guestCount,
            status: "PAYMENT_PENDING",
            holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
          },
        });

        try {
          // Chronological insertion order (nightsBetween is already sorted)
          // further reduces deadlock likelihood between concurrent
          // transactions contending for the same room.
          await tx.bookingNight.createMany({
            data: nights.map((stayDate) => ({
              bookingId: booking.id,
              roomId: input.roomId,
              stayDate,
            })),
          });
        } catch (err) {
          if (isBookingNightConflict(err)) {
            // The actual double-booking rejection. A genuine, final
            // conflict — never retried. Throwing here rolls back the whole
            // transaction (the Booking row included), so no partial record
            // survives a failed attempt.
            throw new RoomNotAvailableError();
          }
          throw err;
        }

        return booking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    ),
  );
}

const bookingListInclude = {
  guest: true,
  room: { include: { roomType: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

const bookingDetailInclude = {
  guest: true,
  room: { include: { roomType: true } },
  payments: true,
} satisfies Prisma.BookingInclude;

export interface ListBookingsFilters {
  status?: BookingStatus;
  /** Filters on checkIn >= from */
  from?: string;
  /** Filters on checkIn <= to */
  to?: string;
}

export function listBookings(filters: ListBookingsFilters = {}) {
  return prisma.booking.findMany({
    where: {
      status: filters.status,
      checkIn: {
        gte: filters.from ? parseDateOnly(filters.from) : undefined,
        lte: filters.to ? parseDateOnly(filters.to) : undefined,
      },
    },
    include: bookingListInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function getBookingById(id: number) {
  return prisma.booking.findUnique({ where: { id }, include: bookingDetailInclude });
}

function getBookingByReference(reference: string) {
  return prisma.booking.findUnique({ where: { bookingReference: reference }, include: bookingDetailInclude });
}

/**
 * The only way a guest can look up their own booking (there are no guest
 * accounts, per the approved architecture) — reference alone isn't treated
 * as sufficient proof of identity, so this also requires the email on file
 * to match. Returns null for either "no such booking" or "email mismatch"
 * so a wrong guess can't be used to probe which references exist.
 */
export async function findBookingForGuest(reference: string, email: string) {
  const booking = await getBookingByReference(reference);
  if (!booking) return null;
  if (booking.guest.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return booking;
}

export async function getDashboardStats() {
  const today = todayUtc();

  const [arrivalsToday, departuresToday, upcomingConfirmed, pendingCount, activeRoomCount] = await Promise.all([
    prisma.booking.count({ where: { checkIn: today, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
    prisma.booking.count({ where: { checkOut: today, status: "CHECKED_IN" } }),
    prisma.booking.count({ where: { status: "CONFIRMED", checkIn: { gte: today } } }),
    prisma.booking.count({ where: { status: { in: ["PENDING", "PAYMENT_PENDING"] } } }),
    prisma.room.count({ where: { isActive: true } }),
  ]);

  return { arrivalsToday, departuresToday, upcomingConfirmed, pendingCount, activeRoomCount };
}

// PAYMENT_PENDING -> CONFIRMED is deliberately NOT listed here. KwaNomzi is
// prepaid: confirmation may only happen via a verified Yoco webhook (see
// lib/services/WebhookService.ts, which updates the booking directly in
// its own transaction, bypassing this map by design). Keeping CONFIRMED
// out of this map isn't just a UI nicety — it means transitionBooking()
// itself refuses that transition if anything ever tried to call it that
// way, admin action or otherwise.
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["PAYMENT_PENDING", "CANCELLED", "EXPIRED"],
  PAYMENT_PENDING: ["CANCELLED", "EXPIRED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Only these two release BookingNight rows — a completed stay (CHECKED_OUT)
// keeps its rows as historical occupancy data, per the approved architecture.
const RELEASES_NIGHTS: ReadonlySet<BookingStatus> = new Set(["CANCELLED", "EXPIRED"]);

export async function transitionBooking(bookingId: number, toStatus: BookingStatus) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (!isTransitionAllowed(booking.status, toStatus)) {
      throw new InvalidStatusTransitionError(booking.status, toStatus);
    }

    if (RELEASES_NIGHTS.has(toStatus)) {
      await tx.bookingNight.deleteMany({ where: { bookingId } });
    }

    return tx.booking.update({ where: { id: bookingId }, data: { status: toStatus } });
  });
}

/**
 * The "minimum safe mechanism" for hold expiry (see Phase 4 plan) — no
 * scheduler infrastructure exists yet in this app, so this is exposed at
 * POST /api/internal/expire-holds for something external (cron, a manual
 * trigger, etc.) to call, rather than running itself on a timer. Each
 * expiry goes through the same transitionBooking() used everywhere else,
 * so BookingNight release stays a single code path, not duplicated here.
 */
export async function expireStaleHolds(): Promise<{ expiredCount: number; bookingReferences: string[] }> {
  const stale = await prisma.booking.findMany({
    where: { status: "PAYMENT_PENDING", holdExpiresAt: { lt: new Date() } },
    include: { guest: true, room: { include: { roomType: true } } },
  });

  const expiredReferences: string[] = [];
  for (const booking of stale) {
    try {
      await transitionBooking(booking.id, "EXPIRED");
    } catch (err) {
      // Another process (e.g. a webhook confirming payment) may have moved
      // this booking out of PAYMENT_PENDING between the query above and
      // this transition — that's not a sweep failure, just a race we lost
      // gracefully. Anything else is a real error worth surfacing.
      if (err instanceof InvalidStatusTransitionError) continue;
      throw err;
    }
    expiredReferences.push(booking.bookingReference);
    try {
      await sendGuestBookingExpiredEmail(toBookingEmailData(booking));
    } catch (err) {
      console.error(`Booking-expired email failed for ${booking.bookingReference}:`, err);
    }
  }

  return { expiredCount: expiredReferences.length, bookingReferences: expiredReferences };
}

function validateDateRange(checkIn: Date, checkOut: Date) {
  try {
    assertValidDateRange(checkIn, checkOut);
  } catch (err) {
    throw new InvalidDateRangeError(err instanceof Error ? err.message : "Invalid date range");
  }
}

async function createUniqueBookingReference(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
    const candidate = generateBookingReference();
    const existing = await tx.booking.findUnique({ where: { bookingReference: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique booking reference after several attempts");
}

function isPrismaKnownError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * True specifically for a unique-constraint violation on booking_night's
 * UNIQUE(room_id, stay_date) — i.e. an actual double-booking attempt, not
 * some other conflict.
 *
 * Verified against a real error thrown by @prisma/adapter-mariadb (not
 * assumed from Postgres/older-Prisma behavior): P2002 errors from this
 * adapter do NOT have the classic `meta.target` string-array shape. Instead
 * `meta.modelName` names the model, and the underlying constraint index
 * name is nested at `meta.driverAdapterError.cause.constraint.index`. Since
 * BookingNight has exactly one unique constraint, a P2002 on that model is
 * unambiguously this conflict; the nested index/message check is a
 * belt-and-braces fallback in case that shape changes between adapter
 * versions.
 */
function isBookingNightConflict(err: unknown): boolean {
  if (!isPrismaKnownError(err) || err.code !== "P2002") return false;
  if (err.meta?.modelName === "BookingNight") return true;

  const meta = err.meta as
    | { driverAdapterError?: { cause?: { constraint?: { index?: string }; originalMessage?: string } } }
    | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index ?? "";
  const originalMessage = meta?.driverAdapterError?.cause?.originalMessage ?? "";
  return index.includes("booking_night") || originalMessage.includes("booking_night");
}

/**
 * Retries on transient MySQL contention errors only:
 *  - deadlock (InnoDB error 1213): a wait-for cycle was detected and one
 *    transaction's whole batch was rolled back — safe and expected to retry.
 *  - lock wait timeout (1205): a transaction waited longer than
 *    innodb_lock_wait_timeout for a lock held by another transaction.
 *
 * Prisma normalizes both to error code P2034 ("write conflict or deadlock")
 * on a healthy mapping. We also fall back to matching the raw MySQL error
 * text, because at least one open Prisma issue documents a driver adapter
 * NOT mapping a database's native deadlock code to P2034 — we're not
 * assuming @prisma/adapter-mariadb's mapping is complete just because it's
 * supposed to be.
 *
 * A booking_night unique-constraint violation (the actual double-booking
 * rejection, handled above as RoomNotAvailableError) is explicitly NOT
 * retried — it's a genuine, final availability conflict, not a transient one.
 */
async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = MAX_TRANSACTION_RETRIES): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts && isRetryableContentionError(err)) {
        await sleep(attempt * RETRY_BASE_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function isRetryableContentionError(err: unknown): boolean {
  if (isPrismaKnownError(err) && err.code === "P2034") return true;
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("1213") ||
    message.includes("Deadlock") ||
    message.includes("1205") ||
    message.includes("Lock wait timeout")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
