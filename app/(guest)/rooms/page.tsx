import type { Metadata } from "next";
import { listActiveRoomTypes } from "@/lib/services/RoomService";
import { RoomCard } from "@/components/RoomCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Rooms & Suites — KwaNomzi Boutique Lodge",
};

export default async function RoomsPage() {
  const roomTypes = await listActiveRoomTypes();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Accommodation</p>
      <h1 className="mt-3 font-display text-4xl text-ink-900">Rooms &amp; Suites</h1>
      <p className="mt-4 max-w-2xl text-ink-700/80">
        Each room at KwaNomzi is considered on its own terms — browse what&rsquo;s available and check dates when you&rsquo;re ready.
      </p>

      {roomTypes.length === 0 ? (
        <div className="mt-12">
          <EmptyState title="No rooms published yet" description="Room types will appear here once they're added in the admin dashboard." />
        </div>
      ) : (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((roomType) => (
            <RoomCard key={roomType.id} roomType={roomType} href={`/rooms/${roomType.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
