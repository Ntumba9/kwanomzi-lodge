import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatMoney } from "@/lib/format";
import { resolveRoomImageSrc } from "@/lib/content/images";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { Button } from "@/components/ui/Button";

export type RoomTypeWithDetails = Prisma.RoomTypeGetPayload<{
  include: { amenities: true; images: true };
}>;

interface RoomCardProps {
  roomType: RoomTypeWithDetails;
  href: string;
}

export function RoomCard({ roomType, href }: RoomCardProps) {
  const primaryImage = roomType.images.find((image) => image.isPrimary) ?? roomType.images[0];

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-mist-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <PlaceholderImage
        label={primaryImage?.altText ?? roomType.name}
        src={resolveRoomImageSrc(primaryImage?.url)}
        className="aspect-[4/3] w-full"
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-ink-900">{roomType.name}</h3>
          <span className="shrink-0 text-sm font-medium text-lagoon-600">
            From {formatMoney(roomType.basePriceCents)}
            <span className="block text-right text-xs font-normal text-ink-700/60">per night</span>
          </span>
        </div>
        {roomType.description && <p className="line-clamp-2 text-sm text-ink-700/80">{roomType.description}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="rounded-full bg-mist-100 px-3 py-1 text-xs text-ink-700">
            Sleeps {roomType.capacity}
          </span>
          {roomType.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity.id} className="rounded-full bg-mist-100 px-3 py-1 text-xs text-ink-700">
              {amenity.name}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <Button variant="secondary" className="w-full group-hover:bg-lagoon-600 group-hover:text-mist-50">
            View room
          </Button>
        </div>
      </div>
    </Link>
  );
}
