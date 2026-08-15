/**
 * Development-only seed data. Never run against production.
 *
 * Every guest/user record here uses an @example.com address specifically so
 * it's unambiguous in logs, admin screens, or exports that this is test
 * data, not a real person.
 */
import { prisma } from "../lib/db/prisma";
import { nightsBetween } from "../lib/dates";
import { calculateTotalCents } from "../lib/money";
import { generateBookingReference } from "../lib/bookingReference";
import { hashPassword } from "../lib/auth/passwords";
import type { Prisma } from "../lib/generated/prisma/client";

// Dev-only login for the seeded admin account — never used outside a local
// environment. Printed to the console so it's easy to find without reading
// this file.
const DEV_ADMIN_PASSWORD = "kwanomzi-dev-admin-2026";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run seed data against a production environment.");
}

// RoomType/Guest have no natural unique business key in the schema (see
// schema.prisma's note on why Guest.email is deliberately not unique), so
// idempotent re-runs are handled here by name/email lookup rather than a
// hardcoded id.
async function findOrCreateRoomType(name: string, create: Prisma.RoomTypeCreateInput) {
  const existing = await prisma.roomType.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.roomType.create({ data: create });
}

async function findOrCreateGuest(email: string, create: Prisma.GuestCreateInput) {
  const existing = await prisma.guest.findFirst({ where: { email } });
  if (existing) return existing;
  return prisma.guest.create({ data: create });
}

/**
 * Seed-only booking constructor. Unlike BookingService.createBooking, this
 * intentionally allows past dates and an arbitrary target status, so we can
 * build historical demo data (e.g. a CHECKED_OUT stay). It still goes
 * through the same room+nights insert shape as the real service, so it's
 * still subject to the BookingNight UNIQUE(room_id, stay_date) constraint —
 * if the seed data below ever accidentally overlapped, this would fail loud
 * rather than silently create bad data.
 */
async function seedBooking(params: {
  roomId: number;
  guestId: number;
  checkIn: Date;
  checkOut: Date;
  pricePerNightCents: number;
  status: "PENDING" | "PAYMENT_PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  releaseNights?: boolean;
}) {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const nightCount = nights.length;
  const totalAmountCents = calculateTotalCents(params.pricePerNightCents, nightCount);

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        bookingReference: generateBookingReference(),
        guestId: params.guestId,
        roomId: params.roomId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        nights: nightCount,
        pricePerNightCents: params.pricePerNightCents,
        totalAmountCents,
        status: params.status,
      },
    });

    if (!params.releaseNights) {
      await tx.bookingNight.createMany({
        data: nights.map((stayDate) => ({ bookingId: booking.id, roomId: params.roomId, stayDate })),
      });
    }

    return booking;
  });
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  console.log("Seeding development data...");

  await prisma.setting.upsert({
    where: { key: "BOOKING_HOLD_MINUTES" },
    update: {},
    create: {
      key: "BOOKING_HOLD_MINUTES",
      value: "15",
      description:
        "Minutes a PENDING/PAYMENT_PENDING booking holds a room before it may expire. Placeholder pending the client's final policy decision.",
    },
  });

  // The lodge's official rate sheet, as supplied by the client (Phase 3.5).
  // Re-applied on every seed run so a future price change made here is
  // never silently stale — see lib/settings.ts's getRateCard() for how the
  // UI consumes this instead of hardcoding prices.
  const rateCard: Prisma.JsonObject = {
    accommodation: [
      { label: "Single", cents: 110000 },
      { label: "Double", cents: 180000 },
      { label: "Sharing", cents: 120000 },
    ],
    meals: [
      { label: "Breakfast", cents: 18000 },
      { label: "Lunch", cents: 16000 },
      { label: "Dinner", cents: 28000 },
    ],
    packages: [
      {
        label: "Single accommodation + food package",
        cents: 156000,
        note: "Excludes lunch",
      },
    ],
  };
  await prisma.setting.upsert({
    where: { key: "RATE_CARD" },
    update: { value: JSON.stringify(rateCard) },
    create: {
      key: "RATE_CARD",
      value: JSON.stringify(rateCard),
      description: "Official KwaNomzi accommodation/meal/package rates, supplied by the client.",
    },
  });

  // One dev login per role, so every role can actually be exercised locally
  // without first needing an OWNER logged in to create the others through
  // /staff/staff. All share DEV_ADMIN_PASSWORD for simplicity — dev-only,
  // this whole script refuses to run in production (see the guard above).
  const devStaffAccounts: { email: string; name: string; role: "OWNER" | "MANAGER" | "RECEPTION" | "HOUSEKEEPING" | "READ_ONLY" }[] = [
    { email: "admin@example.com", name: "Dev Owner", role: "OWNER" },
    { email: "manager@example.com", name: "Dev Manager", role: "MANAGER" },
    { email: "reception@example.com", name: "Dev Reception", role: "RECEPTION" },
    { email: "housekeeping@example.com", name: "Dev Housekeeping", role: "HOUSEKEEPING" },
    { email: "readonly@example.com", name: "Dev Read Only", role: "READ_ONLY" },
  ];
  const devAdminPasswordHash = await hashPassword(DEV_ADMIN_PASSWORD);
  for (const account of devStaffAccounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      // Re-applied on every seed run so the dev login keeps working even if
      // an earlier run created this row with a different/placeholder hash.
      update: { passwordHash: devAdminPasswordHash, role: account.role },
      create: {
        email: account.email,
        name: account.name,
        passwordHash: devAdminPasswordHash,
        role: account.role,
      },
    });
  }

  const wifi = await prisma.amenity.upsert({
    where: { name: "Wi-Fi" },
    update: {},
    create: { name: "Wi-Fi" },
  });
  const ac = await prisma.amenity.upsert({
    where: { name: "Air Conditioning" },
    update: {},
    create: { name: "Air Conditioning" },
  });
  const breakfast = await prisma.amenity.upsert({
    where: { name: "Breakfast Included" },
    update: {},
    create: { name: "Breakfast Included" },
  });
  const parking = await prisma.amenity.upsert({
    where: { name: "Parking" },
    update: {},
    create: { name: "Parking" },
  });

  const gardenSuite = await findOrCreateRoomType("Garden Suite", {
    name: "Garden Suite",
    description: "A cosy suite overlooking the garden, ideal for couples.",
    capacity: 2,
    basePriceCents: 180000, // R1,800.00 / night
    amenities: { connect: [{ id: wifi.id }, { id: ac.id }, { id: breakfast.id }] },
    images: {
      create: [
        {
          url: "https://example.com/kwanomzi/garden-suite-1.jpg",
          altText: "Garden Suite interior",
          displayOrder: 0,
          isPrimary: true,
        },
      ],
    },
  });

  const familyCottage = await findOrCreateRoomType("Family Cottage", {
    name: "Family Cottage",
    description: "A spacious self-catering cottage for families.",
    capacity: 4,
    basePriceCents: 280000, // R2,800.00 / night
    amenities: { connect: [{ id: wifi.id }, { id: parking.id }] },
    images: {
      create: [
        {
          url: "https://example.com/kwanomzi/family-cottage-1.jpg",
          altText: "Family Cottage exterior",
          displayOrder: 0,
          isPrimary: true,
        },
      ],
    },
  });

  const gardenRooms = await Promise.all(
    ["Garden 1", "Garden 2", "Garden 3"].map((name) =>
      prisma.room.upsert({
        where: { roomTypeId_name: { roomTypeId: gardenSuite.id, name } },
        update: {},
        create: { roomTypeId: gardenSuite.id, name },
      }),
    ),
  );

  const cottageRooms = await Promise.all(
    ["Cottage 1", "Cottage 2"].map((name) =>
      prisma.room.upsert({
        where: { roomTypeId_name: { roomTypeId: familyCottage.id, name } },
        update: {},
        create: { roomTypeId: familyCottage.id, name },
      }),
    ),
  );

  const guestA = await findOrCreateGuest("thandiwe.nkosi@example.com", {
    firstName: "Thandiwe",
    lastName: "Nkosi",
    email: "thandiwe.nkosi@example.com",
    phone: "+27 71 555 0101",
  });
  const guestB = await findOrCreateGuest("james.botha@example.com", {
    firstName: "James",
    lastName: "Botha",
    email: "james.botha@example.com",
    phone: "+27 82 555 0202",
  });
  const guestC = await findOrCreateGuest("aisha.patel@example.com", {
    firstName: "Aisha",
    lastName: "Patel",
    email: "aisha.patel@example.com",
  });

  // Only seed demo bookings once (avoids re-inserting BookingNight rows /
  // hitting the unique constraint on repeated `prisma db seed` runs).
  const existingBookingCount = await prisma.booking.count();
  if (existingBookingCount === 0) {
    await seedBooking({
      roomId: gardenRooms[0]!.id,
      guestId: guestA.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(14),
      pricePerNightCents: gardenSuite.basePriceCents,
      status: "CONFIRMED",
    });

    await seedBooking({
      roomId: gardenRooms[1]!.id,
      guestId: guestB.id,
      checkIn: daysFromNow(20),
      checkOut: daysFromNow(22),
      pricePerNightCents: gardenSuite.basePriceCents,
      status: "PENDING",
    });

    // Historical, completed stay — keeps its BookingNight rows per the
    // approved architecture (only CANCELLED/EXPIRED release nights).
    await seedBooking({
      roomId: cottageRooms[0]!.id,
      guestId: guestC.id,
      checkIn: daysFromNow(-10),
      checkOut: daysFromNow(-7),
      pricePerNightCents: familyCottage.basePriceCents,
      status: "CHECKED_OUT",
    });

    // Cancelled — its nights are already released (not inserted at all here,
    // demonstrating the same end-state a real CANCELLED transition leaves).
    await seedBooking({
      roomId: cottageRooms[1]!.id,
      guestId: guestA.id,
      checkIn: daysFromNow(30),
      checkOut: daysFromNow(33),
      pricePerNightCents: familyCottage.basePriceCents,
      status: "CANCELLED",
      releaseNights: true,
    });
  }

  console.log("Seed complete.");
  console.log(`Dev staff logins (all roles), password: ${DEV_ADMIN_PASSWORD}`);
  for (const account of devStaffAccounts) {
    console.log(`  ${account.role.padEnd(12)} ${account.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
