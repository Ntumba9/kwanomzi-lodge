import { listActiveRooms } from "@/lib/services/RoomService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { NewBookingForm } from "./NewBookingForm";

export default async function NewBookingPage() {
  const { allowed } = await checkPermission("bookings:manage");
  if (!allowed) return <Forbidden />;

  const rooms = await listActiveRooms();
  const roomOptions = rooms.map((room) => ({
    id: room.id,
    label: `${room.roomType.name} — ${room.name}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-ink-900">New Booking</h1>
      <div className="max-w-2xl rounded-2xl border border-mist-200 bg-white p-6">
        <NewBookingForm rooms={roomOptions} />
      </div>
    </div>
  );
}
