import { getPrisma } from "@/lib/db/prisma";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";

export interface GuestInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialRequests?: string;
}

type Client = Prisma.TransactionClient | PrismaClient;

/**
 * Guest.email is intentionally not a unique DB constraint (see schema) —
 * households/groups may share one. Reuse-by-email is therefore service-layer
 * logic, not a database guarantee.
 *
 * `client` defaults to undefined rather than the prisma singleton directly
 * (default parameter initializers can't `await`) — resolved to the real
 * singleton just inside the function body instead.
 */
export async function findOrCreateGuest(input: GuestInput, client?: Client) {
  const db = client ?? (await getPrisma());
  const existing = await db.guest.findFirst({ where: { email: input.email } });
  if (existing) return existing;

  return db.guest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      specialRequests: input.specialRequests,
    },
  });
}

export async function listGuests(search?: string) {
  const term = search?.trim();
  const prisma = await getPrisma();
  return prisma.guest.findMany({
    where: term
      ? {
          OR: [
            { firstName: { contains: term } },
            { lastName: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
          ],
        }
      : undefined,
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Full booking history for the staff guest-detail view. */
export async function getGuestById(id: number) {
  const prisma = await getPrisma();
  return prisma.guest.findUnique({
    where: { id },
    include: {
      bookings: {
        include: { room: { include: { roomType: true } }, payments: true },
        orderBy: { checkIn: "desc" },
      },
    },
  });
}
