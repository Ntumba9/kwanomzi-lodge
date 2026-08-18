/**
 * DIAGNOSTIC ONLY — Phase 3 write-path verification through the mTLS relay.
 *
 * Exercises the REAL service-layer code (BookingService.createBooking,
 * .transitionBooking — not reimplemented logic) against the real production
 * database, reached through the same lib/db/prisma.ts / lib/db/mtlsRelay.ts
 * path Vercel uses when DB_RELAY_* env vars are set. Every fixture is
 * clearly marked and deleted in a finally block — no residue is left
 * behind even if a test step fails partway through.
 *
 * Run through the relay (same as Preview would use):
 *   DB_RELAY_HOST=13.63.60.102 DB_RELAY_PORT=8443 \
 *   DB_RELAY_CLIENT_CERT="$(cat infra/mtls-relay/certs/client.crt)" \
 *   DB_RELAY_CLIENT_KEY="$(cat infra/mtls-relay/certs/client.key)" \
 *   DB_RELAY_CA_CERT="$(cat infra/mtls-relay/certs/ca.crt)" \
 *   npx tsx scripts/diag-write-path-test.ts
 *
 * Run direct (no relay, for comparison): just omit the DB_RELAY_* vars.
 *
 * Delete this file once Phase 3 is either adopted for production or
 * abandoned.
 */
import "dotenv/config";
import { getPrisma } from "@/lib/db/prisma";
import { createBooking, transitionBooking } from "@/lib/services/BookingService";
import { RoomNotAvailableError } from "@/lib/errors";

const MARKER = `PHASE3-WRITE-TEST-${Date.now()}`;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cleanup must not itself get lost to the pool-timeout flakiness observed
 *  in this local test environment (see the Phase 3 write-path report) — a
 *  few retries here is the difference between "test failed" and "test
 *  failed AND left real data behind in production". */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`[write-test] cleanup step failed (attempt ${i}/${attempts}): ${err instanceof Error ? err.message : err}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 1_000 * i));
    }
  }
  throw lastError;
}

function testGuest(suffix: string) {
  return {
    firstName: "Phase3",
    lastName: "WriteTest",
    email: `phase3-write-test-${Date.now()}-${suffix}@example.invalid`,
  };
}

async function main() {
  console.log(`[write-test] relay mode: ${process.env.DB_RELAY_HOST ? `ACTIVE (${process.env.DB_RELAY_HOST}:${process.env.DB_RELAY_PORT})` : "DIRECT (no relay)"}`);
  console.log(`[write-test] marker: ${MARKER}`);

  const prisma = await getPrisma();

  const roomType = await prisma.roomType.create({
    data: { name: MARKER, capacity: 1, basePriceCents: 100 },
  });
  const roomA = await prisma.room.create({ data: { roomTypeId: roomType.id, name: `${MARKER}-A` } });
  const roomB = await prisma.room.create({ data: { roomTypeId: roomType.id, name: `${MARKER}-B` } });

  try {
    // 1. Basic write + transaction: createBooking's real $transaction,
    //    row lock, BookingNight insert.
    const checkIn = daysFromNow(500);
    const checkOut = daysFromNow(502);
    const booking = await createBooking({ roomId: roomA.id, checkIn, checkOut, guest: testGuest("main") });
    console.log(`[write-test] OK — booking created: ${booking.bookingReference}, status=${booking.status}`);

    const nights = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    if (nights !== 2) throw new Error(`Expected 2 BookingNight rows, got ${nights}`);
    console.log(`[write-test] OK — BookingNight rows: ${nights}`);

    // 2. Payment DB writes (no real Yoco call — DB layer only).
    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, provider: "yoco", amountCents: booking.totalAmountCents, currency: booking.currency, status: "INITIATED" },
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING", providerReference: `test_${MARKER}` } });
    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (updatedPayment.status !== "PENDING") throw new Error("Payment status update did not persist");
    console.log("[write-test] OK — payment row created and updated");

    // 3. Real state-transition chain via transitionBooking (each step a
    //    separate $transaction).
    for (const to of ["CANCELLED"] as const) {
      await transitionBooking(booking.id, to);
    }
    const bookingAfterCancel = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    if (bookingAfterCancel.status !== "CANCELLED") throw new Error("transitionBooking did not persist CANCELLED");
    const nightsAfterCancel = await prisma.bookingNight.count({ where: { bookingId: booking.id } });
    if (nightsAfterCancel !== 0) throw new Error(`Expected 0 BookingNight rows after cancel, got ${nightsAfterCancel}`);
    console.log("[write-test] OK — transitionBooking(CANCELLED) persisted status + released nights");

    // 4. Rollback/concurrency proof: two genuinely concurrent createBooking
    //    calls for the SAME room+dates — exactly one must win, the loser's
    //    whole transaction (Booking row included) must roll back cleanly,
    //    proving transaction rollback actually works through the relay.
    const dupCheckIn = daysFromNow(510);
    const dupCheckOut = daysFromNow(512);
    const results = await Promise.allSettled([
      createBooking({ roomId: roomB.id, checkIn: dupCheckIn, checkOut: dupCheckOut, guest: testGuest("race1") }),
      createBooking({ roomId: roomB.id, checkIn: dupCheckIn, checkOut: dupCheckOut, guest: testGuest("race2") }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    console.log(`[write-test] race outcome: ${fulfilled.length} fulfilled, ${rejected.length} rejected`);
    if (rejected[0]?.status === "rejected") {
      console.log(`[write-test] rejection reason: ${rejected[0].reason instanceof Error ? rejected[0].reason.constructor.name : rejected[0].reason}`);
    }
    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(`Expected exactly 1 win / 1 rejection, got ${fulfilled.length} wins / ${rejected.length} rejections`);
    }
    if (rejected[0]!.status === "rejected" && !(rejected[0]!.reason instanceof RoomNotAvailableError)) {
      throw new Error(`Loser rejected with unexpected error: ${rejected[0]!.reason}`);
    }
    const bookingsForRoomB = await prisma.booking.findMany({ where: { roomId: roomB.id } });
    if (bookingsForRoomB.length !== 1) {
      throw new Error(`Expected exactly 1 persisted booking for roomB, found ${bookingsForRoomB.length} — rollback did not fully clean up the loser`);
    }
    console.log("[write-test] OK — concurrent race: 1 winner persisted, 1 loser's transaction fully rolled back (no orphaned row)");

    console.log("[write-test] ALL WRITE-PATH CHECKS PASSED");
  } finally {
    // Keyed off the fixture rooms themselves (queried fresh), not a
    // tracked-ID array — robust even if an assertion threw before a
    // booking's id was ever recorded. This is exactly the bug that left
    // orphaned data behind on the first run of this script; fixed here by
    // always re-querying what actually exists under these two rooms.
    console.log("[write-test] cleaning up all fixtures...");
    const roomIds = [roomA.id, roomB.id];
    const bookingsToClean = await withRetry(() => prisma.booking.findMany({ where: { roomId: { in: roomIds } } }));
    const bookingIds = bookingsToClean.map((b) => b.id);
    const guestIds = [...new Set(bookingsToClean.map((b) => b.guestId))];

    await withRetry(() => prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }));
    await withRetry(() => prisma.bookingNight.deleteMany({ where: { bookingId: { in: bookingIds } } }));
    await withRetry(() => prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }));
    await withRetry(() => prisma.guest.deleteMany({ where: { id: { in: guestIds } } }));
    await withRetry(() => prisma.room.deleteMany({ where: { roomTypeId: roomType.id } }));
    await withRetry(() => prisma.roomType.delete({ where: { id: roomType.id } }));
    console.log("[write-test] cleanup complete — zero residue left");
  }
}

main()
  .catch((err) => {
    console.error("[write-test] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closeRelay } = await import("@/lib/db/mtlsRelay");
    await closeRelay();
    process.exit(process.exitCode ?? 0);
  });
