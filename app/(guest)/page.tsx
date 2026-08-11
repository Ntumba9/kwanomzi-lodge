import { listActiveRoomTypes } from "@/lib/services/RoomService";
import { getRateCard } from "@/lib/settings";
import { business } from "@/lib/content/business";
import { siteImages } from "@/lib/content/images";
import { RoomCard } from "@/components/RoomCard";
import { RateTable } from "@/components/RateTable";
import { LocationMapPlaceholder } from "@/components/LocationMapPlaceholder";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function GuestHomePage() {
  const [roomTypes, rateCard] = await Promise.all([listActiveRoomTypes(), getRateCard()]);
  const featured = roomTypes.slice(0, 3);

  const amenities = Array.from(
    new Map(roomTypes.flatMap((rt) => rt.amenities).map((a) => [a.id, a])).values(),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-end overflow-hidden bg-ink-950">
        <PlaceholderImage
          label={siteImages.hero.alt}
          src={siteImages.hero.src}
          showLabel={false}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 md:px-8 md:pb-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-lagoon-300">{business.tagline}</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-mist-50 sm:text-5xl md:text-6xl">
            {business.name}
          </h1>
          <p className="mt-5 max-w-xl text-base text-mist-100/85 md:text-lg">
            Considered comfort and genuine South African hospitality in KwaBushula, Lusikisiki — a quiet retreat,
            done properly.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="/book" size="lg">
              Book Now
            </Button>
            <Button
              href="/rooms"
              size="lg"
              variant="secondary"
              className="border-mist-50 text-mist-50 hover:bg-mist-50 hover:text-ink-950"
            >
              Explore Rooms
            </Button>
          </div>
        </div>
      </section>

      {/* Lodge introduction */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Welcome</p>
        <h2 className="mt-3 font-display text-3xl text-ink-900 md:text-4xl">The KwaNomzi story</h2>
        <p className="mt-5 text-ink-700/80">
          Lodge introduction copy has not been supplied yet — this is a placeholder for KwaNomzi&rsquo;s real story,
          history and philosophy, easy to replace once that content is provided.
        </p>
      </section>

      {/* Accommodation */}
      <section id="rooms" className="bg-mist-100 py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Accommodation</p>
              <h2 className="mt-3 font-display text-3xl text-ink-900 md:text-4xl">Rooms &amp; suites</h2>
            </div>
            <Button href="/rooms" variant="ghost" className="hidden md:inline-flex">
              View all rooms →
            </Button>
          </div>

          {featured.length === 0 ? (
            <EmptyState
              title="No rooms published yet"
              description="Room types will appear here once they're added in the admin dashboard."
            />
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((roomType) => (
                <RoomCard key={roomType.id} roomType={roomType} href={`/rooms/${roomType.id}`} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Amenities */}
      {amenities.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Amenities</p>
          <h2 className="mt-3 font-display text-3xl text-ink-900 md:text-4xl">Everything you need, quietly provided</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {amenities.map((amenity) => (
              <div key={amenity.id} className="rounded-2xl border border-mist-200 bg-white p-6">
                <p className="font-display text-lg text-ink-900">{amenity.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rates + dining */}
      {rateCard && (
        <section id="dining" className="bg-mist-100 py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Rates</p>
              <h2 className="mt-3 font-display text-3xl text-ink-900 md:text-4xl">General rates &amp; dining</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-ink-700/70">
                KwaNomzi&rsquo;s standard accommodation rate categories are listed below. For the rate on a
                specific room shown above, see that room&rsquo;s own listed nightly price. Meals are available
                separately and are not automatically included with every booking, unless part of a package.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <RateTable title="Accommodation rate categories" entries={rateCard.accommodation} />
              <RateTable title="Meals" entries={rateCard.meals} />
            </div>

            {rateCard.packages.length > 0 && (
              <div className="mt-8">
                <RateTable title="Packages" entries={rateCard.packages} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Booking CTA */}
      <section className="bg-ink-950 py-20 text-center text-mist-50">
        <div className="mx-auto max-w-2xl px-4 md:px-8">
          <h2 className="font-display text-3xl md:text-4xl">Ready for a stay at KwaNomzi?</h2>
          <p className="mt-4 text-mist-100/80">Check availability for your dates and reserve your room in a few minutes.</p>
          <Button href="/book" size="lg" className="mt-8">
            Book Now
          </Button>
        </div>
      </section>

      {/* Location / contact */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Location</p>
            <h2 className="mt-3 font-display text-3xl text-ink-900 md:text-4xl">Find us</h2>
            <ul className="mt-6 space-y-3 text-sm text-ink-700/80">
              <li>{business.address.full}</li>
              <li>
                <a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="hover:text-ink-900">
                  {business.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${business.email}`} className="hover:text-ink-900">
                  {business.email}
                </a>
              </li>
            </ul>
          </div>
          <LocationMapPlaceholder />
        </div>
      </section>
    </>
  );
}
