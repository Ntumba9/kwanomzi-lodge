import { prisma } from "@/lib/db/prisma";

export function listActiveRooms() {
  return prisma.room.findMany({
    where: { isActive: true, roomType: { isActive: true } },
    include: { roomType: { include: { amenities: true, images: true } } },
    orderBy: { id: "asc" },
  });
}

/** Admin view — includes inactive rooms/room types, unlike listActiveRooms. */
export function listAllRooms() {
  return prisma.room.findMany({
    include: { roomType: { include: { amenities: true, images: true } } },
    orderBy: { id: "asc" },
  });
}

export function listActiveRoomTypes() {
  return prisma.roomType.findMany({
    where: { isActive: true },
    include: { amenities: true, images: true, rooms: { where: { isActive: true } } },
    orderBy: { basePriceCents: "asc" },
  });
}

export function getRoomTypeById(id: number) {
  return prisma.roomType.findUnique({
    where: { id },
    include: { amenities: true, images: true, rooms: { where: { isActive: true } } },
  });
}

export interface CreateRoomTypeInput {
  name: string;
  description?: string;
  capacity: number;
  basePriceCents: number;
}

export function createRoomType(input: CreateRoomTypeInput) {
  return prisma.roomType.create({ data: input });
}

export interface CreateRoomInput {
  roomTypeId: number;
  name: string;
  capacity?: number;
  priceOverrideCents?: number;
}

export function createRoom(input: CreateRoomInput) {
  return prisma.room.create({ data: input });
}

/** The rate this room actually bills at: its own override if set, otherwise its RoomType's base price. */
export function effectivePriceCents(room: { priceOverrideCents: number | null }, roomType: { basePriceCents: number }): number {
  return room.priceOverrideCents ?? roomType.basePriceCents;
}
