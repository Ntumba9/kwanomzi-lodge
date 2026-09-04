import { describe, it, expect } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import {
  createRoomType,
  createRoom,
  updateRoomType,
  updateRoom,
  getRoomTypeById,
  addRoomImage,
  deleteRoomImage,
  setRoomImagePrimary,
} from "@/lib/services/RoomService";
import { createTestRoomType, createTestRoom } from "./helpers";

/**
 * Covers the staff portal's room-management chain at the service layer
 * (the same functions app/staff/rooms/actions.ts calls) — real Prisma
 * writes against the test database, not mocks. See tests/setup.ts for why
 * this needs TEST_DATABASE_URL rather than the dev/demo database.
 */
describe("room management", () => {
  it("creates a room type and a room under it, both persisted and retrievable", async () => {
    const roomType = await createRoomType({
      name: `RM Test Type ${Date.now()}`,
      description: "A test room type",
      capacity: 3,
      basePriceCents: 150_000,
    });
    const room = await createRoom({ roomTypeId: roomType.id, name: `RM Test Room ${Date.now()}` });

    const fetched = await getRoomTypeById(roomType.id);
    expect(fetched?.name).toBe(roomType.name);
    expect(fetched?.capacity).toBe(3);
    expect(fetched?.basePriceCents).toBe(150_000);
    expect(fetched?.rooms.some((r) => r.id === room.id)).toBe(true);
  });

  it("edits a room type's price and it's reflected immediately on re-fetch", async () => {
    const roomType = await createTestRoomType(90_000);
    expect((await getRoomTypeById(roomType.id))!.basePriceCents).toBe(90_000);

    await updateRoomType(roomType.id, { basePriceCents: 110_000 });

    const updated = await getRoomTypeById(roomType.id);
    expect(updated!.basePriceCents).toBe(110_000);
  });

  it("deactivating a room removes it from the active listing without deleting the row", async () => {
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.id);

    await updateRoom(room.id, { isActive: false });

    const prisma = await getPrisma();
    const stillExists = await prisma.room.findUnique({ where: { id: room.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists!.isActive).toBe(false);

    const active = await getRoomTypeById(roomType.id);
    expect(active!.rooms.some((r) => r.id === room.id)).toBe(false);
  });

  it("reactivating a room brings it back into the active listing", async () => {
    const roomType = await createTestRoomType();
    const room = await createTestRoom(roomType.id);
    await updateRoom(room.id, { isActive: false });

    await updateRoom(room.id, { isActive: true });

    const active = await getRoomTypeById(roomType.id);
    expect(active!.rooms.some((r) => r.id === room.id)).toBe(true);
  });

  it("a room's priceOverrideCents, once set, wins over the room type's base price for that specific room", async () => {
    const roomType = await createTestRoomType(100_000);
    const room = await createTestRoom(roomType.id);

    await updateRoom(room.id, { priceOverrideCents: 250_000 });

    const prisma = await getPrisma();
    const updated = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    expect(updated.priceOverrideCents).toBe(250_000);
  });

  describe("room images", () => {
    it("the first image added to a room type becomes primary automatically", async () => {
      const roomType = await createTestRoomType();
      const image = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/a.jpg" });
      expect(image.isPrimary).toBe(true);
      expect(image.displayOrder).toBe(0);
    });

    it("a second image does not become primary, and displayOrder increments", async () => {
      const roomType = await createTestRoomType();
      const first = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/a.jpg" });
      const second = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/b.jpg" });

      expect(first.isPrimary).toBe(true);
      expect(second.isPrimary).toBe(false);
      expect(second.displayOrder).toBe(1);
    });

    it("setRoomImagePrimary demotes the previous primary and promotes the chosen one", async () => {
      const roomType = await createTestRoomType();
      const first = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/a.jpg" });
      const second = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/b.jpg" });

      await setRoomImagePrimary(second.id);

      const prisma = await getPrisma();
      const [refetchedFirst, refetchedSecond] = await Promise.all([
        prisma.roomImage.findUniqueOrThrow({ where: { id: first.id } }),
        prisma.roomImage.findUniqueOrThrow({ where: { id: second.id } }),
      ]);
      expect(refetchedFirst.isPrimary).toBe(false);
      expect(refetchedSecond.isPrimary).toBe(true);
    });

    it("deleting the primary image promotes the next one by displayOrder, and never leaves a room type with images but no primary", async () => {
      const roomType = await createTestRoomType();
      const first = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/a.jpg" });
      const second = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/b.jpg" });

      await deleteRoomImage(first.id);

      const prisma = await getPrisma();
      const remaining = await prisma.roomImage.findMany({ where: { roomTypeId: roomType.id } });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.id).toBe(second.id);
      expect(remaining[0]!.isPrimary).toBe(true);
    });

    it("deleting a non-primary image leaves the existing primary untouched", async () => {
      const roomType = await createTestRoomType();
      const first = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/a.jpg" });
      const second = await addRoomImage({ roomTypeId: roomType.id, url: "https://example.com/b.jpg" });

      await deleteRoomImage(second.id);

      const prisma = await getPrisma();
      const refetchedFirst = await prisma.roomImage.findUniqueOrThrow({ where: { id: first.id } });
      expect(refetchedFirst.isPrimary).toBe(true);
    });
  });
});
