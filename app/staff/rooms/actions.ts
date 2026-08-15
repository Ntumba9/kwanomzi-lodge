"use server";

import { revalidatePath } from "next/cache";
import {
  createRoom,
  createRoomType,
  updateRoom,
  updateRoomOperationalStatus,
  updateRoomType,
} from "@/lib/services/RoomService";
import { requirePermission } from "@/lib/auth/staffAuth";
import { recordAuditLog } from "@/lib/services/AuditService";
import { createRoomSchema, createRoomTypeSchema, roomOperationalStatusSchema, updateRoomSchema, updateRoomTypeSchema } from "@/lib/validation/room";
import { DomainError } from "@/lib/errors";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function updateRoomStatusAction(roomId: number, status: string): Promise<ActionState> {
  const parsedStatus = roomOperationalStatusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid room status." };

  const session = await requirePermission("rooms:operate");

  await updateRoomOperationalStatus(roomId, parsedStatus.data);

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "ROOM_STATUS_CHANGED",
    entityType: "Room",
    entityId: String(roomId),
    metadata: { status: parsedStatus.data },
  });

  revalidatePath("/staff/rooms");
  revalidatePath("/staff");
  return { success: "Room status updated." };
}

export async function createRoomTypeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("rooms:manage");

  const parsed = createRoomTypeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    capacity: formData.get("capacity"),
    basePriceCents: formData.get("basePriceCents"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room type details." };
  }

  let roomType;
  try {
    roomType = await createRoomType(parsed.data);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not create room type." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "ROOM_TYPE_CREATED",
    entityType: "RoomType",
    entityId: String(roomType.id),
    metadata: { name: roomType.name },
  });

  revalidatePath("/staff/rooms");
  return { success: `Room type "${roomType.name}" created.` };
}

// Signature is (roomTypeId, prevState, formData) — not (roomTypeId, formData)
// — because RoomTypeEditForm calls `updateRoomTypeAction.bind(null, roomTypeId)`
// and passes the result to useActionState, which always invokes an action as
// (prevState, formData). bind() only pre-fills the first parameter, so the
// two after it must line up with what useActionState supplies.
export async function updateRoomTypeAction(roomTypeId: number, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("rooms:manage");

  const parsed = updateRoomTypeSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    capacity: formData.get("capacity") || undefined,
    basePriceCents: formData.get("basePriceCents") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room type details." };
  }

  await updateRoomType(roomTypeId, parsed.data);

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "ROOM_TYPE_UPDATED",
    entityType: "RoomType",
    entityId: String(roomTypeId),
    metadata: parsed.data,
  });

  revalidatePath("/staff/rooms");
  revalidatePath("/");
  revalidatePath("/rooms");
  return { success: "Room type updated." };
}

export async function createRoomAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("rooms:manage");

  const parsed = createRoomSchema.safeParse({
    roomTypeId: formData.get("roomTypeId"),
    name: formData.get("name"),
    capacity: formData.get("capacity") || undefined,
    priceOverrideCents: formData.get("priceOverrideCents") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room details." };
  }

  let room;
  try {
    room = await createRoom(parsed.data);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not create room." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "ROOM_CREATED",
    entityType: "Room",
    entityId: String(room.id),
    metadata: { name: room.name, roomTypeId: parsed.data.roomTypeId },
  });

  revalidatePath("/staff/rooms");
  return { success: `Room "${room.name}" created.` };
}

// Same (id, prevState, formData) shape as updateRoomTypeAction above, for the same reason.
export async function updateRoomAction(roomId: number, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("rooms:manage");

  const parsed = updateRoomSchema.safeParse({
    name: formData.get("name") || undefined,
    capacity: formData.get("capacity") || undefined,
    priceOverrideCents: formData.get("priceOverrideCents") || undefined,
    isActive: formData.get("isActive") ? formData.get("isActive") === "true" : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room details." };
  }

  await updateRoom(roomId, parsed.data);

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "ROOM_UPDATED",
    entityType: "Room",
    entityId: String(roomId),
    metadata: parsed.data,
  });

  revalidatePath("/staff/rooms");
  revalidatePath("/");
  revalidatePath("/rooms");
  return { success: "Room updated." };
}
