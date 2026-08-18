import { getPrisma } from "@/lib/db/prisma";
import type { BookingStatus, RoomOperationalStatus } from "@/lib/generated/prisma/client";
import { todayUtc } from "@/lib/dates";

export async function listActiveRooms() {
  const prisma = await getPrisma();
  return prisma.room.findMany({
    where: { isActive: true, roomType: { isActive: true } },
    include: { roomType: { include: { amenities: true, images: true } } },
    orderBy: { id: "asc" },
  });
}

/** Admin view — includes inactive rooms/room types, unlike listActiveRooms. */
export async function listAllRooms() {
  const prisma = await getPrisma();
  return prisma.room.findMany({
    include: { roomType: { include: { amenities: true, images: true } } },
    orderBy: { id: "asc" },
  });
}

export async function listActiveRoomTypes() {
  const prisma = await getPrisma();
  return prisma.roomType.findMany({
    where: { isActive: true },
    include: { amenities: true, images: true, rooms: { where: { isActive: true } } },
    orderBy: { basePriceCents: "asc" },
  });
}

export async function getRoomTypeById(id: number) {
  const prisma = await getPrisma();
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

export async function createRoomType(input: CreateRoomTypeInput) {
  const prisma = await getPrisma();
  return prisma.roomType.create({ data: input });
}

export interface CreateRoomInput {
  roomTypeId: number;
  name: string;
  capacity?: number;
  priceOverrideCents?: number;
}

export async function createRoom(input: CreateRoomInput) {
  const prisma = await getPrisma();
  return prisma.room.create({ data: input });
}

/** The rate this room actually bills at: its own override if set, otherwise its RoomType's base price. */
export function effectivePriceCents(room: { priceOverrideCents: number | null }, roomType: { basePriceCents: number }): number {
  return room.priceOverrideCents ?? roomType.basePriceCents;
}

export interface UpdateRoomTypeInput {
  name?: string;
  description?: string;
  capacity?: number;
  basePriceCents?: number;
  isActive?: boolean;
}

export async function updateRoomType(id: number, input: UpdateRoomTypeInput) {
  const prisma = await getPrisma();
  return prisma.roomType.update({ where: { id }, data: input });
}

export interface UpdateRoomInput {
  name?: string;
  capacity?: number | null;
  priceOverrideCents?: number | null;
  isActive?: boolean;
}

export async function updateRoom(id: number, input: UpdateRoomInput) {
  const prisma = await getPrisma();
  return prisma.room.update({ where: { id }, data: input });
}

/** Housekeeping/front-desk operational status — see schema.prisma's RoomOperationalStatus doc. */
export async function updateRoomOperationalStatus(roomId: number, status: RoomOperationalStatus) {
  const prisma = await getPrisma();
  return prisma.room.update({ where: { id: roomId }, data: { operationalStatus: status } });
}

export type RoomDashboardStatus = "MAINTENANCE" | "CLEANING" | "OCCUPIED" | "RESERVED" | "AVAILABLE";

/**
 * Combines each room's manually-set operational status with its live
 * booking state to produce one dashboard-facing status per room, in
 * priority order: an out-of-service or being-cleaned room is that,
 * regardless of bookings; otherwise a room with a guest checked in (or
 * manually marked occupied) is OCCUPIED; otherwise a room with an upcoming
 * CONFIRMED stay is RESERVED; otherwise AVAILABLE.
 */
function deriveRoomDashboardStatus(
  operationalStatus: RoomOperationalStatus,
  bookings: { status: BookingStatus }[],
): RoomDashboardStatus {
  if (operationalStatus === "MAINTENANCE") return "MAINTENANCE";
  if (operationalStatus === "CLEANING") return "CLEANING";

  const checkedIn = bookings.some((b) => b.status === "CHECKED_IN");
  if (operationalStatus === "OCCUPIED" || checkedIn) return "OCCUPIED";

  const reserved = bookings.some((b) => b.status === "CONFIRMED");
  if (reserved) return "RESERVED";

  return "AVAILABLE";
}

export interface RoomWithDashboardStatus {
  id: number;
  name: string;
  roomTypeName: string;
  operationalStatus: RoomOperationalStatus;
  dashboardStatus: RoomDashboardStatus;
}

/** Every active room with its combined dashboard status — for /staff/rooms and the dashboard's room breakdown. */
export async function listRoomsWithStatus(): Promise<RoomWithDashboardStatus[]> {
  const today = todayUtc();
  const prisma = await getPrisma();
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    include: {
      roomType: { select: { name: true } },
      bookings: {
        where: { status: { in: ["CHECKED_IN", "CONFIRMED"] }, checkOut: { gt: today } },
        select: { status: true },
      },
    },
    orderBy: { id: "asc" },
  });

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    roomTypeName: room.roomType.name,
    operationalStatus: room.operationalStatus,
    dashboardStatus: deriveRoomDashboardStatus(room.operationalStatus, room.bookings),
  }));
}

export async function getRoomStatusBreakdown() {
  const rooms = await listRoomsWithStatus();
  const counts: Record<RoomDashboardStatus, number> = {
    AVAILABLE: 0,
    OCCUPIED: 0,
    RESERVED: 0,
    CLEANING: 0,
    MAINTENANCE: 0,
  };
  for (const room of rooms) counts[room.dashboardStatus]++;
  return { counts, total: rooms.length };
}
