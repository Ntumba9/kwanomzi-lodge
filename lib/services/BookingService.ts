import { getPrisma } from "@/lib/db/prisma";
import { Prisma, type BookingStatus } from "@/lib/generated/prisma/client";
import { assertValidDateRange, countNights, nightsBetween, parseDateOnly, todayUtc } from "@/lib/dates";
import { calculateTotalCents } from "@/lib/money";
import { computeRoomTypePriceCents } from "@/lib/pricing";
import { getMealCatalogItem, calculateMealsTotalCents, type SelectedMeal } from "@/lib/content/meals";
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
  // Only key + quantity are trusted from the caller — see resolveSelectedMeals
  // below for why label/unitPriceCents always come from the server-side catalog.
  selectedMeals?: { key: string; quantity: number }[];
}

/**
 * Maps client-supplied {key, quantity} pairs to full SelectedMeal snapshots
 * using lib/content/meals.ts's catalog for label/unitPriceCents — never the
 * client's own numbers, so a tampered request body can't change what a
 * guest is actually charged. An unknown key is dropped rather than
 * rejecting the whole booking (defensive against a stale client sending a
 * since-removed meal key), since the room reservation itself is the part
 * that must not fail here.
 */
function resolveSelectedMeals(input: { key: string; quantity: number }[] | undefined): SelectedMeal[] {
  if (!input) return [];
  const resolved: SelectedMeal[] = [];
  for (const { key, quantity } of input) {
    const item = getMealCatalogItem(key);
    if (!item || quantity <= 0) continue;
    resolved.push({ key: item.key, label: item.label, unitPriceCents: item.priceCents, quantity });
  }
  return resolved;
}

const MAX_TRANSACTION_RETRIES = 3;
const MAX_REFERENCE_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 25;

// See the comment at the createBooking() $transaction call for why these
// are raised above Prisma's defaults (maxWait=2000ms, timeout=5000ms).
const TRANSACTION_MAX_WAIT_MS = 8_000;
const TRANSACTION_TIMEOUT_MS = 15_000;

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
  const prisma = await getPrisma();

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
        // Room-level priceOverrideCents always wins (unchanged precedent);
        // otherwise the room type's own pricing model decides the rate for
        // this party size — see lib/pricing.ts. guestCount defaults to 1
        // (the same default the OCCUPANCY_TIERED/PER_GUEST models already
        // treat "no guest count" as) so an omitted guestCount never
        // silently prices as a larger party than stated.
        const pricePerNightCents =
          room.priceOverrideCents ?? computeRoomTypePriceCents(room.roomType, input.guestCount ?? 1);
        const accommodationTotalCents = calculateTotalCents(pricePerNightCents, nightCount);

        const selectedMeals = resolveSelectedMeals(input.selectedMeals);
        const mealsTotalCents = calculateMealsTotalCents(selectedMeals);
        const totalAmountCents = accommodationTotalCents + mealsTotalCents;

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
            // Prisma's Json input type wants InputJsonValue, which has no
            // room for a typed array-of-interfaces like SelectedMeal[] —
            // this is genuinely JSON-serializable data (string/number
            // fields only), so the cast is safe, not a type-safety escape
            // hatch for anything else in this function.
            selectedMeals: selectedMeals.length > 0 ? (selectedMeals as unknown as Prisma.InputJsonValue) : undefined,
            mealsTotalCents,
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
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        // Prisma's defaults (maxWait=2000ms, timeout=5000ms) assume a
        // low-latency connection to the database. Phase 3's mTLS relay adds
        // real round-trip latency (Vercel -> EC2 -> RDS) on top of normal
        // row-lock contention between concurrent booking attempts on the
        // same room — under that combined latency, a losing transaction can
        // fail to even ACQUIRE a transaction slot within the 2s default,
        // surfacing as a raw "Unable to start a transaction in the given
        // time" error instead of the intended RoomNotAvailableError.
        // Verified directly: reproduced against the real relay+RDS path
        // during Phase 3 write-path testing, not assumed from documentation.
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      },
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
  /** Matches booking reference or guest name/email (contains, case-insensitive on MySQL's default collation). */
  search?: string;
}

export async function listBookings(filters: ListBookingsFilters = {}) {
  const search = filters.search?.trim();
  const prisma = await getPrisma();
  return prisma.booking.findMany({
    where: {
      status: filters.status,
      checkIn: {
        gte: filters.from ? parseDateOnly(filters.from) : undefined,
        lte: filters.to ? parseDateOnly(filters.to) : undefined,
      },
      OR: search
        ? [
            { bookingReference: { contains: search } },
            { guest: { firstName: { contains: search } } },
            { guest: { lastName: { contains: search } } },
            { guest: { email: { contains: search } } },
          ]
        : undefined,
    },
    include: bookingListInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getBookingById(id: number) {
  const prisma = await getPrisma();
  return prisma.booking.findUnique({ where: { id }, include: bookingDetailInclude });
}

async function getBookingByReference(reference: string) {
  const prisma = await getPrisma();
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
  const prisma = await getPrisma();

  const [arrivalsToday, departuresToday, upcomingConfirmed, pendingCount, activeRoomCount, occupiedRoomsCount, pendingPaymentCount] =
    await Promise.all([
      prisma.booking.count({ where: { checkIn: today, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
      prisma.booking.count({ where: { checkOut: today, status: "CHECKED_IN" } }),
      prisma.booking.count({ where: { status: "CONFIRMED", checkIn: { gte: today } } }),
      prisma.booking.count({ where: { status: { in: ["PENDING", "PAYMENT_PENDING"] } } }),
      prisma.room.count({ where: { isActive: true } }),
      // A CHECKED_IN booking's room is occupied for the duration of that
      // stay — one row per currently-occupied room, by construction (the
      // BookingNight uniqueness constraint rules out two bookings claiming
      // the same room on an overlapping night).
      prisma.booking.count({ where: { status: "CHECKED_IN" } }),
      prisma.booking.count({ where: { status: "PAYMENT_PENDING" } }),
    ]);

  return {
    arrivalsToday,
    departuresToday,
    upcomingConfirmed,
    pendingCount,
    activeRoomCount,
    occupiedRoomsCount,
    pendingPaymentCount,
  };
}

/** Bookings checking out today — what housekeeping needs to turn over, regardless of financial detail. */
export async function getTodaysCheckouts() {
  const today = todayUtc();
  const prisma = await getPrisma();
  return prisma.booking.findMany({
    where: { checkOut: today, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } },
    include: bookingListInclude,
    orderBy: { checkOut: "asc" },
  });
}

/** CONFIRMED bookings not yet arrived, soonest check-in first — for a staff "what's coming up" view. */
export async function getUpcomingBookings(limit = 5) {
  const today = todayUtc();
  const prisma = await getPrisma();
  return prisma.booking.findMany({
    where: { status: "CONFIRMED", checkIn: { gte: today } },
    include: bookingListInclude,
    orderBy: { checkIn: "asc" },
    take: limit,
  });
}

/** PAYMENT_PENDING bookings, soonest-expiring hold first — what staff should chase or expect to lapse next. */
export async function getPendingPaymentBookings(limit = 5) {
  const prisma = await getPrisma();
  return prisma.booking.findMany({
    where: { status: "PAYMENT_PENDING" },
    include: bookingListInclude,
    orderBy: { holdExpiresAt: "asc" },
    take: limit,
  });
}

/**
 * Every booking whose stay overlaps the given UTC month, for the calendar
 * view — standard range-overlap test (checkIn before month end AND checkOut
 * after month start), not just bookings that start within the month.
 * Excludes CANCELLED/EXPIRED (no longer occupy anything) and the rare
 * pre-payment PENDING state, which isn't yet a real hold on the calendar.
 */
export async function getBookingsForMonth(year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  const prisma = await getPrisma();

  return prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN", "PAYMENT_PENDING", "CHECKED_OUT"] },
      checkIn: { lt: monthEnd },
      checkOut: { gt: monthStart },
    },
    include: bookingListInclude,
    orderBy: { checkIn: "asc" },
  });
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
  const prisma = await getPrisma();
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
  const prisma = await getPrisma();
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
 * Retries on transient contention errors only:
 *  - deadlock (InnoDB error 1213): a wait-for cycle was detected and one
 *    transaction's whole batch was rolled back — safe and expected to retry.
 *  - lock wait timeout (1205): a transaction waited longer than
 *    innodb_lock_wait_timeout for a lock held by another transaction.
 *  - P2028 ("Unable to start a transaction in the given time"): Prisma's own
 *    transaction-acquisition timeout (maxWait), distinct from the two MySQL
 *    errors above — reproduced directly against the real relay+RDS path
 *    during Phase 3 write-path testing (two genuinely concurrent
 *    createBooking calls; the loser hit this before ever reaching MySQL's
 *    own lock-wait/deadlock detection). Retrying is correct here for the
 *    same reason as the MySQL contention errors: this is transient
 *    contention, not a final availability conflict.
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
  if (isPrismaKnownError(err) && (err.code === "P2034" || err.code === "P2028")) return true;
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
