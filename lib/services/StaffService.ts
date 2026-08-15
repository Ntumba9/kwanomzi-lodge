import { prisma } from "@/lib/db/prisma";
import type { UserRole } from "@/lib/generated/prisma/client";
import { hashPassword } from "@/lib/auth/passwords";
import { DomainError } from "@/lib/errors";

export class LastOwnerError extends DomainError {
  constructor(message = "This is the only active owner account — it can't be deactivated or reassigned.") {
    super("LAST_OWNER", message);
  }
}

export class EmailInUseError extends DomainError {
  constructor(message = "A staff account with this email already exists.") {
    super("EMAIL_IN_USE", message);
  }
}

export function listStaff() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export function getStaffById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

function countActiveOwners(excludeUserId?: number) {
  return prisma.user.count({
    where: { role: "OWNER", isActive: true, id: excludeUserId ? { not: excludeUserId } : undefined },
  });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export async function createStaffAccount(input: CreateStaffInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new EmailInUseError();
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
}

/**
 * Refuses to move the last active OWNER to a non-OWNER role — the lodge
 * must never be left with zero accounts able to manage staff/settings/audit
 * log. Checked against the database at call time (not any client-supplied
 * state), counting every OTHER active owner besides this user.
 */
export async function updateStaffRole(userId: number, newRole: UserRole) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "OWNER" && newRole !== "OWNER") {
    const remainingOwners = await countActiveOwners(userId);
    if (remainingOwners === 0) {
      throw new LastOwnerError();
    }
  }
  return prisma.user.update({ where: { id: userId }, data: { role: newRole } });
}

/** Same last-owner protection as updateStaffRole, for the deactivate path. */
export async function setStaffActive(userId: number, isActive: boolean) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "OWNER" && !isActive) {
    const remainingOwners = await countActiveOwners(userId);
    if (remainingOwners === 0) {
      throw new LastOwnerError();
    }
  }
  return prisma.user.update({ where: { id: userId }, data: { isActive } });
}

export async function resetStaffPassword(userId: number, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
