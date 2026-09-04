import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { addRoomImage, deleteRoomImage, setRoomImagePrimary } from "@/lib/services/RoomService";
import { recordAuditLog } from "@/lib/services/AuditService";
import { getPrisma } from "@/lib/db/prisma";

/**
 * Real staff room-photo upload, backed by Vercel Blob — not a fake
 * frontend-only upload. A staff member with rooms:manage POSTs a file
 * here; it's stored durably in Blob storage and the resulting public URL
 * is recorded as a RoomImage row (lib/services/RoomService.ts's
 * addRoomImage), which is exactly what the guest-facing site and staff
 * portal already read from (RoomImage.url — see lib/content/images.ts's
 * resolveRoomImageSrc). No separate "pending upload" state exists in the
 * browser; once this returns 200 the photo is live everywhere that reads
 * RoomType.images.
 *
 * Requires the BLOB_READ_WRITE_TOKEN env var, which Vercel sets
 * automatically once a Blob store is connected to this project (Vercel
 * dashboard -> Storage -> Blob -> Connect to Project). Locally, set the
 * same variable in .env from `vercel env pull` to test uploads.
 */
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, small enough to reject accidental video uploads
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireRoomsManage() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, message: "Not authenticated." };
  if (!hasPermission(session.user.role, "rooms:manage")) {
    return { ok: false as const, status: 403, message: "Insufficient permissions." };
  }
  return { ok: true as const, session };
}

export async function POST(request: Request) {
  const authCheck = await requireRoomsManage();
  if (!authCheck.ok) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: authCheck.message } }, { status: authCheck.status });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Expected multipart form data." } }, { status: 400 });
  }

  const roomTypeId = Number(formData.get("roomTypeId"));
  const file = formData.get("file");
  if (!Number.isInteger(roomTypeId) || roomTypeId <= 0) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing or invalid roomTypeId." } }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing file." } }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Only JPEG, PNG, or WEBP images are allowed." } },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Image must be 8MB or smaller." } }, { status: 400 });
  }

  const prisma = await getPrisma();
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId }, select: { id: true, name: true } });
  if (!roomType) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Room type not found." } }, { status: 404 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `rooms/${roomTypeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  let blob;
  try {
    blob = await put(pathname, file, { access: "public" });
  } catch (err) {
    console.error("Room image upload to Blob failed:", err);
    return NextResponse.json(
      { error: { code: "UPLOAD_FAILED", message: "Could not upload the image. Please try again." } },
      { status: 502 },
    );
  }

  const image = await addRoomImage({
    roomTypeId,
    url: blob.url,
    altText: `${roomType.name} at KwaNomzi Boutique Lodge`,
    source: "LODGE",
  });

  await recordAuditLog({
    userId: Number(authCheck.session.user.id),
    action: "ROOM_IMAGE_UPLOADED",
    entityType: "RoomType",
    entityId: String(roomTypeId),
    metadata: { imageId: image.id, url: image.url },
  });

  return NextResponse.json({ data: image }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authCheck = await requireRoomsManage();
  if (!authCheck.ok) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: authCheck.message } }, { status: authCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const imageId = Number(searchParams.get("imageId"));
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing or invalid imageId." } }, { status: 400 });
  }

  const prisma = await getPrisma();
  const image = await prisma.roomImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Image not found." } }, { status: 404 });
  }

  // Best-effort blob delete — a Blob URL that's no longer referenced by any
  // RoomImage row is harmless clutter, but a RoomImage row pointing at a
  // deleted-but-still-referenced blob would be a broken image, so the DB
  // row is only removed after (or regardless of) the blob delete attempt,
  // never the other way around.
  if (image.source === "LODGE") {
    try {
      await del(image.url);
    } catch (err) {
      console.error("Room image blob delete failed (continuing to remove the DB row):", err);
    }
  }

  await deleteRoomImage(imageId);

  await recordAuditLog({
    userId: Number(authCheck.session.user.id),
    action: "ROOM_IMAGE_DELETED",
    entityType: "RoomType",
    entityId: String(image.roomTypeId),
    metadata: { imageId },
  });

  return NextResponse.json({ data: { deleted: true } });
}

export async function PATCH(request: Request) {
  const authCheck = await requireRoomsManage();
  if (!authCheck.ok) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: authCheck.message } }, { status: authCheck.status });
  }

  const body = (await request.json().catch(() => null)) as { imageId?: number } | null;
  const imageId = Number(body?.imageId);
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing or invalid imageId." } }, { status: 400 });
  }

  try {
    await setRoomImagePrimary(imageId);
  } catch (err) {
    console.error("setRoomImagePrimary failed:", err);
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Image not found." } }, { status: 404 });
  }

  await recordAuditLog({
    userId: Number(authCheck.session.user.id),
    action: "ROOM_IMAGE_SET_PRIMARY",
    entityType: "RoomImage",
    entityId: String(imageId),
  });

  return NextResponse.json({ data: { ok: true } });
}
