import { beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { createTestRoomWithType, createTestRoomType, testGuestInput } from "./helpers";
import { findOrCreateGuest } from "@/lib/services/GuestService";
import { parseDateOnly } from "@/lib/dates";

let prisma: Awaited<ReturnType<typeof getPrisma>>;
beforeAll(async () => {
  prisma = await getPrisma();
});

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

describe("BookingNight UNIQUE(room_id, stay_date) — the double-booking constraint itself", () => {
  it("rejects a direct duplicate insert at the database level, independent of any service logic", async () => {
    const { room } = await createTestRoomWithType();
    const guest = await findOrCreateGuest(testGuestInput());
    const stayDate = parseDateOnly("2027-01-10");

    const booking1 = await prisma.booking.create({
      data: {
        bookingReference: `TEST-${Date.now()}-A`,
        guestId: guest.id,
        roomId: room.id,
        checkIn: stayDate,
        checkOut: parseDateOnly("2027-01-11"),
        nights: 1,
        pricePerNightCents: 100000,
        totalAmountCents: 100000,
      },
    });
    await prisma.bookingNight.create({ data: { bookingId: booking1.id, roomId: room.id, stayDate } });

    const booking2 = await prisma.booking.create({
      data: {
        bookingReference: `TEST-${Date.now()}-B`,
        guestId: guest.id,
        roomId: room.id,
        checkIn: stayDate,
        checkOut: parseDateOnly("2027-01-11"),
        nights: 1,
        pricePerNightCents: 100000,
        totalAmountCents: 100000,
      },
    });

    // Same room, same night, different booking — the raw constraint must
    // reject this on its own, with zero application logic involved.
    await expect(
      prisma.bookingNight.create({ data: { bookingId: booking2.id, roomId: room.id, stayDate } }),
    ).rejects.toSatisfy(isUniqueConstraintError);
  });

  it("allows the same night on two DIFFERENT rooms (constraint is scoped per room)", async () => {
    const roomType = await createTestRoomType();
    const roomA = await prisma.room.create({ data: { roomTypeId: roomType.id, name: `A-${Date.now()}` } });
    const roomB = await prisma.room.create({ data: { roomTypeId: roomType.id, name: `B-${Date.now()}` } });
    const guest = await findOrCreateGuest(testGuestInput());
    const stayDate = parseDateOnly("2027-02-01");

    for (const room of [roomA, roomB]) {
      const booking = await prisma.booking.create({
        data: {
          bookingReference: `TEST-${Date.now()}-${room.id}`,
          guestId: guest.id,
          roomId: room.id,
          checkIn: stayDate,
          checkOut: parseDateOnly("2027-02-02"),
          nights: 1,
          pricePerNightCents: 100000,
          totalAmountCents: 100000,
        },
      });
      await expect(
        prisma.bookingNight.create({ data: { bookingId: booking.id, roomId: room.id, stayDate } }),
      ).resolves.toBeDefined();
    }
  });
});

describe("WebhookEvent idempotency — UNIQUE(provider, event_id)", () => {
  it("dedupes a repeated delivery of the same provider event id at the database level", async () => {
    const eventId = `evt_${Date.now()}`;

    await prisma.webhookEvent.create({
      data: {
        provider: "yoco",
        eventId,
        eventType: "payment.succeeded",
        payload: { test: true },
      },
    });

    // A second delivery of the exact same event must be rejected by the
    // unique constraint — this is the actual dedup mechanism (see
    // schema.prisma), not something a handler has to remember to check.
    await expect(
      prisma.webhookEvent.create({
        data: {
          provider: "yoco",
          eventId,
          eventType: "payment.succeeded",
          payload: { test: true, redelivered: true },
        },
      }),
    ).rejects.toSatisfy(isUniqueConstraintError);
  });

  it("is recordable and dedupable without ever being linked to a Payment", async () => {
    // paymentId is nullable specifically so an event can be recorded before
    // it's matched to a Payment row — verify that actually works.
    const event = await prisma.webhookEvent.create({
      data: {
        provider: "yoco",
        eventId: `evt_unmatched_${Date.now()}`,
        eventType: "payment.succeeded",
        payload: { test: true },
      },
    });
    expect(event.paymentId).toBeNull();
  });

  it("allows the same event id from a different provider (constraint is scoped per provider)", async () => {
    const eventId = `evt_shared_${Date.now()}`;
    await prisma.webhookEvent.create({
      data: { provider: "yoco", eventId, eventType: "payment.succeeded", payload: {} },
    });
    await expect(
      prisma.webhookEvent.create({
        data: { provider: "other-provider", eventId, eventType: "payment.succeeded", payload: {} },
      }),
    ).resolves.toBeDefined();
  });
});
