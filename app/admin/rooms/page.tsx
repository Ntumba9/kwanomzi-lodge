import { listAllRooms } from "@/lib/services/RoomService";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";

export default async function AdminRoomsPage() {
  const rooms = await listAllRooms();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Rooms</h1>
        <p className="mt-1 text-sm text-ink-700/60">
          Read-only for now — adding and editing rooms/room types arrives in a later phase, once image storage is
          wired up.
        </p>
      </div>

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <Th>Room</Th>
              <Th>Room Type</Th>
              <Th>Capacity</Th>
              <Th>Price / night</Th>
              <Th>Status</Th>
            </tr>
          </TableHead>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <Td className="font-medium">{room.name}</Td>
                <Td>{room.roomType.name}</Td>
                <Td>{room.capacity ?? room.roomType.capacity}</Td>
                <Td>{formatMoney(room.priceOverrideCents ?? room.roomType.basePriceCents)}</Td>
                <Td>
                  <Badge className={room.isActive ? "bg-emerald-100 text-emerald-800" : "bg-mist-200 text-ink-700/60"}>
                    {room.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
