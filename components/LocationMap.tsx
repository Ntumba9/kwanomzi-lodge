import { business } from "@/lib/content/business";

/**
 * A plain Google Maps embed URL (the `?output=embed` form) needs no API key
 * and no billing account — distinct from the Maps JavaScript/Embed API,
 * which would. Points at the lodge's confirmed address (lib/content/business.ts).
 */
export function LocationMap() {
  const query = encodeURIComponent(business.address.full);
  const src = `https://www.google.com/maps?q=${query}&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-mist-200 md:aspect-[16/9]">
        <iframe
          src={src}
          title={`Map showing the location of ${business.name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-sm font-medium text-lagoon-600 hover:underline"
      >
        Get directions →
      </a>
    </div>
  );
}
