import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoomTypeById } from "@/lib/services/RoomService";
import { resolveRoomImageSrc } from "@/lib/content/images";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

export default async function RoomTypeDetailPage({ params }: PageProps<"/rooms/[roomTypeId]">) {
  const { roomTypeId } = await params;
  const id = Number(roomTypeId);
  const roomType = Number.isFinite(id) ? await getRoomTypeById(id) : null;

  if (!roomType || !roomType.isActive) {
    notFound();
  }

  const isSoldOut = roomType.rooms.length === 0;
  const primaryImage = roomType.images.find((image) => image.isPrimary) ?? roomType.images[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <PlaceholderImage
          label={primaryImage?.altText ?? roomType.name}
          src={resolveRoomImageSrc(primaryImage?.url)}
          className="aspect-[4/3] rounded-2xl sm:col-span-2 sm:aspect-[16/9]"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <PlaceholderImage label={`${roomType.name} detail`} className="aspect-square rounded-2xl" />
          <PlaceholderImage label={`${roomType.name} detail`} className="aspect-square rounded-2xl" />
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-3">
        <div className="md:col-span-2">
          <h1 className="font-display text-4xl text-ink-900">{roomType.name}</h1>
          <p className="mt-2 text-sm text-ink-700/70">Sleeps up to {roomType.capacity} guests</p>
          {roomType.description && <p className="mt-6 text-ink-700/80">{roomType.description}</p>}

          {roomType.amenities.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Amenities</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roomType.amenities.map((amenity) => (
                  <span key={amenity.id} className="rounded-full bg-mist-100 px-3.5 py-1.5 text-sm text-ink-700">
                    {amenity.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-mist-200 bg-mist-50 p-5">
            <p className="text-sm text-ink-700/80">
              Looking to add meals to your stay? See our{" "}
              <Link href="/#dining" className="font-medium text-lagoon-600 hover:underline">
                dining rates and packages
              </Link>
              . Meals aren&rsquo;t automatically included with this room unless booked as part of a package.
            </p>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-mist-200 bg-white p-6">
          <p className="font-display text-2xl text-ink-900">
            From {formatMoney(roomType.basePriceCents)}{" "}
            <span className="text-sm font-sans text-ink-700/60">/ night</span>
          </p>
          {isSoldOut ? (
            <p className="mt-4 text-sm text-ink-700/70">
              No rooms of this type are currently active. Check back soon or browse other rooms.
            </p>
          ) : (
            <Button href={`/book?roomTypeId=${roomType.id}`} size="lg" className="mt-5 w-full">
              Check Availability
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
