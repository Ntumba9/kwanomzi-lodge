import { createHmac } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import type { GuestInput } from "@/lib/services/GuestService";
import { createBooking, type CreateBookingInput } from "@/lib/services/BookingService";

// These tests run against whatever DATABASE_URL points to and create real
// rows. Every fixture uses a per-call random suffix so concurrent/repeated
// test runs never collide with each other or with pre-existing (e.g. seed)
// data — no destructive cleanup step is required between runs.
function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTestRoomType(basePriceCents = 100000) {
  const prisma = await getPrisma();
  return prisma.roomType.create({
    data: {
      name: `Integration Test Room Type ${uniqueSuffix()}`,
      capacity: 2,
      basePriceCents,
    },
  });
}

export async function createTestRoom(roomTypeId: number, overrides: { priceOverrideCents?: number } = {}) {
  const prisma = await getPrisma();
  return prisma.room.create({
    data: {
      roomTypeId,
      name: `Test Room ${uniqueSuffix()}`,
      priceOverrideCents: overrides.priceOverrideCents,
    },
  });
}

/** Convenience: a fresh RoomType + one Room under it, ready to book against. */
export async function createTestRoomWithType(basePriceCents = 100000) {
  const roomType = await createTestRoomType(basePriceCents);
  const room = await createTestRoom(roomType.id);
  return { roomType, room };
}

export function testGuestInput(overrides: Partial<GuestInput> = {}): GuestInput {
  return {
    firstName: "Test",
    lastName: "Guest",
    email: `test-guest-${uniqueSuffix()}@example.com`,
    phone: "+27 71 555 0100",
    ...overrides,
  };
}

/** Creates a real PAYMENT_PENDING booking (+ BookingNight rows) via the actual service, ready to attach a Payment to. */
export async function createTestBooking(overrides: Partial<CreateBookingInput> & { roomId: number }) {
  function daysFromNow(days: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  return createBooking({
    checkIn: daysFromNow(50),
    checkOut: daysFromNow(53),
    guestCount: 2,
    guest: testGuestInput(),
    ...overrides,
  });
}

/** A Payment row in INITIATED/PENDING state, as PaymentService.initiateCheckout would leave it after a real Yoco call. */
export async function createTestPayment(bookingId: number, overrides: { amountCents?: number; providerReference?: string } = {}) {
  const prisma = await getPrisma();
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return prisma.payment.create({
    data: {
      bookingId,
      provider: "yoco",
      amountCents: overrides.amountCents ?? booking.totalAmountCents,
      currency: booking.currency,
      status: "PENDING",
      providerReference: overrides.providerReference ?? `checkout_${uniqueSuffix()}`,
    },
  });
}

const TEST_WEBHOOK_SECRET_ENV = "YOCO_WEBHOOK_SECRET";

/** Builds a real, correctly-signed Yoco webhook request (headers + raw body) using the test env's YOCO_WEBHOOK_SECRET — exactly like Yoco would send one, not a mock. */
export function buildSignedWebhookRequest(body: unknown) {
  const secret = process.env[TEST_WEBHOOK_SECRET_ENV];
  if (!secret) {
    throw new Error(`${TEST_WEBHOOK_SECRET_ENV} must be set in the test environment to sign webhook test payloads.`);
  }
  const rawBody = JSON.stringify(body);
  const webhookId = `msg_${uniqueSuffix()}`;
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signature = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  return {
    rawBody,
    headers: { webhookId, webhookTimestamp, webhookSignature: `v1,${signature}` },
  };
}

export function yocoPaymentSucceededPayload(params: { eventId: string; paymentId: string; amountCents: number; bookingId: number; internalPaymentId: number }) {
  return {
    id: params.eventId,
    type: "payment.succeeded",
    payload: {
      id: params.paymentId,
      amount: params.amountCents,
      currency: "ZAR",
      status: "succeeded",
      metadata: { bookingId: String(params.bookingId), paymentId: String(params.internalPaymentId) },
    },
  };
}

export function yocoPaymentFailedPayload(params: { eventId: string; paymentId: string; amountCents: number; bookingId: number; internalPaymentId: number }) {
  return {
    id: params.eventId,
    type: "payment.failed",
    payload: {
      id: params.paymentId,
      amount: params.amountCents,
      currency: "ZAR",
      status: "failed",
      metadata: { bookingId: String(params.bookingId), paymentId: String(params.internalPaymentId) },
    },
  };
}
