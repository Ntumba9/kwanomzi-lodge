import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Deliberately lives at the Server Action layer, not inside BookingService /
 * RoomService / StaffService — those stay focused on their own domain logic
 * and untouched by this feature. Every staff-facing mutation calls this
 * itself, right after its underlying service call succeeds, using the
 * authenticated session's user id for attribution. Never pass a password,
 * secret, or credential in `metadata`.
 */
export async function recordAuditLog(params: {
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export function listAuditLog(limit = 100) {
  return prisma.auditLog.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
