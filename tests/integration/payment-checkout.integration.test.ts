import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { initiateCheckout } from "@/lib/services/PaymentService";
import { transitionBooking, isTransitionAllowed } from "@/lib/services/BookingService";
import { BookingNotFoundError, PaymentNotAllowedError, ServiceNotConfiguredError, InvalidStatusTransitionError } from "@/lib/errors";
import { createTestRoomWithType, createTestBooking } from "./helpers";

const ORIGINAL_ENV = { ...process.env };

let prisma: Awaited<ReturnType<typeof getPrisma>>;
beforeAll(async () => {
  prisma = await getPrisma();
});

beforeEach(() => {
  process.env.YOCO_SECRET_KEY = "sk_test_fake_key_for_mocked_requests";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("initiateCheckout — guard clauses (no network involved)", () => {
  it("rejects a nonexistent booking", async () => {
    await expect(initiateCheckout(999_999_999)).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it("rejects a booking that is not PAYMENT_PENDING", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });

    await expect(initiateCheckout(booking.id)).rejects.toBeInstanceOf(PaymentNotAllowedError);
  });

  it("fails clearly when YOCO_SECRET_KEY is not configured, rather than silently faking a checkout", async () => {
    delete process.env.YOCO_SECRET_KEY;
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    await expect(initiateCheckout(booking.id)).rejects.toBeInstanceOf(ServiceNotConfiguredError);
  });
});

describe("initiateCheckout — against a mocked Yoco response", () => {
  // No real Yoco credentials exist in this environment. This tests OUR
  // handling of a Yoco-shaped response, not live connectivity to Yoco —
  // see the Phase 4 report for the honest distinction between this and
  // real sandbox/production verification.
  it("creates a Payment row and returns the checkout's redirectUrl on a successful response", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "checkout_abc123", redirectUrl: "https://pay.yoco.com/r/abc123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await initiateCheckout(booking.id);

    expect(result.redirectUrl).toBe("https://pay.yoco.com/r/abc123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://payments.yoco.com/api/checkouts");
    const sentBody = JSON.parse((options as RequestInit).body as string);
    // The amount sent to Yoco must come from the database, not be
    // reconstructable/overridable by any caller.
    expect(sentBody.amount).toBe(booking.totalAmountCents);
    expect(sentBody.metadata.bookingId).toBe(String(booking.id));

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.providerReference).toBe("checkout_abc123");
    expect(payment.amountCents).toBe(booking.totalAmountCents);
  });

  it("marks the Payment row FAILED if Yoco responds with an error", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    vi.spyOn(global, "fetch").mockResolvedValue(new Response("bad request", { status: 400 }));

    await expect(initiateCheckout(booking.id)).rejects.toBeInstanceOf(ServiceNotConfiguredError);

    const payments = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.status).toBe("FAILED");
  });
});

describe("admin cannot manually confirm an unpaid booking", () => {
  it("CONFIRMED is not in the allow-list for PAYMENT_PENDING", () => {
    expect(isTransitionAllowed("PAYMENT_PENDING", "CONFIRMED")).toBe(false);
  });

  it("transitionBooking rejects an attempt to force CONFIRMED directly", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id });

    await expect(transitionBooking(booking.id, "CONFIRMED")).rejects.toBeInstanceOf(InvalidStatusTransitionError);

    const unchanged = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(unchanged.status).toBe("PAYMENT_PENDING");
  });
});

describe("admin-created booking can initiate payment", () => {
  it("a manually created booking (same createBooking path admin uses) accepts a checkout the same way a guest booking does", async () => {
    const { room } = await createTestRoomWithType();
    const booking = await createTestBooking({ roomId: room.id, specialRequests: "Created by admin over the phone" });
    expect(booking.status).toBe("PAYMENT_PENDING");

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "checkout_admin1", redirectUrl: "https://pay.yoco.com/r/admin1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await initiateCheckout(booking.id);
    expect(result.redirectUrl).toBe("https://pay.yoco.com/r/admin1");
  });
});
