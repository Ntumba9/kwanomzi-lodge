import { listAllRooms } from "@/lib/services/RoomService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { hasPermission } from "@/lib/auth/permissions";
import { Forbidden } from "@/components/staff/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";
import { RoomStatusActions } from "./RoomStatusActions";
import { RoomTypeForm } from "./RoomTypeForm";
import { RoomTypeEditForm } from "./RoomTypeEditForm";
import { RoomForm } from "./RoomForm";
import { RoomEditForm } from "./RoomEditForm";
import { RoomImageManager } from "./RoomImageManager";

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OCCUPIED: "bg-sky-100 text-sky-800",
  CLEANING: "bg-amber-100 text-amber-800",
  MAINTENANCE: "bg-red-100 text-red-700",
};

export default async function StaffRoomsPage() {
  const { allowed, session } = await checkPermission("rooms:view");
  if (!allowed) return <Forbidden />;

  const role = session.user.role;
  const canManage = hasPermission(role, "rooms:manage");
  const canOperate = hasPermission(role, "rooms:operate");

  const rooms = await listAllRooms();
  const roomTypeMap = new Map<
    number,
    {
      id: number;
      name: string;
      description: string | null;
      capacity: number;
      basePriceCents: number;
      isActive: boolean;
      images: { id: number; url: string; altText: string | null; isPrimary: boolean }[];
      rooms: typeof rooms;
    }
  >();
  for (const room of rooms) {
    const rt = room.roomType;
    if (!roomTypeMap.has(rt.id)) {
      roomTypeMap.set(rt.id, {
        id: rt.id,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        basePriceCents: rt.basePriceCents,
        isActive: rt.isActive,
        images: [...rt.images]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((img) => ({ id: img.id, url: img.url, altText: img.altText, isPrimary: img.isPrimary })),
        rooms: [],
      });
    }
    roomTypeMap.get(rt.id)!.rooms.push(room);
  }
  const roomTypes = Array.from(roomTypeMap.values());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Rooms</h1>
        <p className="mt-1 text-sm text-ink-700/60">
          {canOperate
            ? "Update a room's status as it's cleaned, occupied, or taken out of service."
            : "Room availability across the lodge."}
        </p>
      </div>

      {roomTypes.length === 0 ? (
        <EmptyState title="No rooms yet" />
      ) : (
        roomTypes.map((rt) => (
          <Card key={rt.id}>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg text-ink-900">{rt.name}</p>
                <p className="text-xs text-ink-700/60">
                  Base {formatMoney(rt.basePriceCents)} / night · Sleeps {rt.capacity}
                  {!rt.isActive && " · Inactive"}
                </p>
              </div>
              {canManage && <RoomTypeEditForm roomTypeId={rt.id} capacity={rt.capacity} basePriceCents={rt.basePriceCents} />}
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {canManage && <RoomImageManager roomTypeId={rt.id} images={rt.images} />}
              <div className="overflow-x-auto rounded-2xl border border-mist-200">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
                    <tr>
                      <th className="px-4 py-3 font-medium">Room</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      {canManage && <th className="px-4 py-3 font-medium">Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mist-200">
                    {rt.rooms.map((room) => (
                      <tr key={room.id}>
                        <td className="px-4 py-3 align-top text-ink-900">
                          <p className="font-medium">{room.name}</p>
                          <p className="text-xs text-ink-700/60">
                            {room.capacity ?? rt.capacity} guests ·{" "}
                            {formatMoney(room.priceOverrideCents ?? rt.basePriceCents)} / night
                          </p>
                          {!room.isActive && <Badge className="mt-1 bg-mist-200 text-ink-700/60">Inactive</Badge>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {canOperate ? (
                            <RoomStatusActions roomId={room.id} currentStatus={room.operationalStatus} />
                          ) : (
                            <Badge className={STATUS_BADGE[room.operationalStatus]}>{room.operationalStatus}</Badge>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 align-top">
                            <RoomEditForm
                              roomId={room.id}
                              capacity={room.capacity}
                              priceOverrideCents={room.priceOverrideCents}
                              isActive={room.isActive}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canManage && <RoomForm roomTypeId={rt.id} />}
            </CardBody>
          </Card>
        ))
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <p className="font-display text-lg text-ink-900">Add a room type</p>
          </CardHeader>
          <CardBody>
            <RoomTypeForm />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
