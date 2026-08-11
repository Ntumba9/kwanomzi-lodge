import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

export interface GuestInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialRequests?: string;
}

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Guest.email is intentionally not a unique DB constraint (see schema) —
 * households/groups may share one. Reuse-by-email is therefore service-layer
 * logic, not a database guarantee.
 */
export async function findOrCreateGuest(input: GuestInput, client: Client = prisma) {
  const existing = await client.guest.findFirst({ where: { email: input.email } });
  if (existing) return existing;

  return client.guest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      specialRequests: input.specialRequests,
    },
  });
}

export function listGuests() {
  return prisma.guest.findMany({
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
  });
}
