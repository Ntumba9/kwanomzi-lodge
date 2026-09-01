import Image from "next/image";
import { listActiveRoomTypes } from "@/lib/services/RoomService";
import { getRateCard } from "@/lib/settings";
import { business, whatsappUrl, mapsDirectionsUrl } from "@/lib/content/business";
import { siteImages } from "@/lib/content/images";
import { RoomCard } from "@/components/RoomCard";
import { RateTable } from "@/components/RateTable";
import { LocationMap } from "@/components/LocationMap";
import { HomeQuickReservation } from "@/components/HomeQuickReservation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const trustSignals = [
  "Instant email confirmation",
  "Secure payment via Yoco",
  "Book direct — no third-party fees",
  "No account needed to book",
];

// A genuine photograph of one of KwaNomzi's rooms — used here purely to
// break up the page with real imagery while full exterior/grounds
// photography hasn't been supplied yet. Never implied to be anything other
// than what it is (see alt text).
const introImage = { src: "/images/rooms/Deluxe king Room.png", alt: "One of the rooms at KwaNomzi Boutique Lodge" };

// Reads live room/rate data from the database on every request. Without
// this, Next.js's default behavior is to statically prerender this page at
// `next build` time — which means querying the database during the Vercel
// build itself, before any production DATABASE_URL/database necessarily
// exists. Forcing dynamic rendering defers that query to real request time,
// same as every other DB-backed route in this app already does.
export const dynamic = "force-dynamic";

export default async function GuestHomePage() {
  const [roomTypes, rateCard] = await Promise.all([listActiveRoomTypes(), getRateCard()]);
  const featured = roomTypes.slice(0, 3);

  const amenities = Array.from(
    new Map(roomTypes.flatMap((rt) => rt.amenities).map((a) => [a.id, a])).values(),
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: business.name,
    description: business.tagline,
    telephone: business.phone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.line1,
      addressLocality: "Lusikisiki",
      addressRegion: "Eastern Cape",
      addressCountry: "ZA",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data has no user-facing rendering of its own, so
        // dangerouslySetInnerHTML is the standard/only way to emit it — the
        // content is our own serialized object above, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero — static background image (see lib/content/images.ts's
          siteImages.hero). Previously a looping background video
          (components/HeroMedia.tsx, public/videos/lodge-hero.mp4); both
          removed, no longer referenced anywhere. */}
      <section className="relative flex min-h-[85vh] flex-col justify-end overflow-hidden bg-ink-950 pb-10 md:pb-14">
        <Image
          src={siteImages.hero.src!}
          alt={siteImages.hero.alt}
          fill
          priority
          sizes="100vw"
          // Biased toward the upper-middle of the frame so the cliff face
          // (the most striking part of the photo) stays in view even on
          // tall/narrow mobile crops, rather than the default center crop
          // pushing it out of frame.
          className="object-cover object-[center_38%]"
        />
        {/* Uniform cinematic tint across the whole image, plus a stronger
            gradient toward the bottom where the hero text/widget sit, so
            text stays highly readable regardless of the photo's own
            brightness at any given point. */}
        <div className="absolute inset-0 bg-ink-950/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/40 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-4 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lagoon-300">{business.tagline}</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight text-mist-50 sm:text-5xl md:text-6xl">
            {business.name}
          </h1>
          <p className="mt-5 max-w-xl text-base text-mist-100/85 md:text-lg">
            Considered comfort and genuine South African hospitality in KwaBushula, Lusikisiki — a quiet retreat,
            done properly.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button
              href="/rooms"
              size="md"
              variant="secondary"
              className="border-mist-50 text-mist-50 hover:bg-mist-50 hover:text-ink-950"
            >
              Explore Rooms
            </Button>
            {/* Subtle secondary utility link, not a competing CTA — see
                lib/content/business.ts's mapsDirectionsUrl for how this is
                built from the lodge's own confirmed address. */}
            <a
              href={mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-mist-100/85 transition-colors hover:text-mist-50"
            >
              <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-lagoon-300" />
              <span>{business.name} · View Location</span>
            </a>
          </div>
        </div>

        <div className="relative mt-8 px-4 md:mt-10 md:px-8">
          <HomeQuickReservation />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-mist-200 bg-mist-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-4 px-4 py-6 md:flex md:items-center md:justify-center md:gap-10 md:px-8">
          {trustSignals.map((signal) => (
            <div key={signal} className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0 text-lagoon-600" />
              <span className="text-xs font-medium text-ink-700 md:text-sm">{signal}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Lodge introduction */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl md:aspect-[16/11]">
            <Image
              src={introImage.src}
              alt={introImage.alt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Welcome</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">The KwaNomzi story</h2>
            <p className="mt-5 text-ink-700/80">
              Lodge introduction copy has not been supplied yet — this is a placeholder for KwaNomzi&rsquo;s real
              story, history and philosophy, easy to replace once that content is provided.
            </p>
            <Button href="/rooms" variant="secondary" className="mt-6">
              Explore Rooms
            </Button>
          </div>
        </div>
      </section>

      {/* Accommodation */}
      <section id="rooms" className="bg-mist-100 py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Accommodation</p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">Rooms &amp; suites</h2>
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
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">Everything you need, quietly provided</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {amenities.map((amenity) => (
              <div
                key={amenity.id}
                className="flex items-center gap-4 rounded-2xl border border-mist-200 bg-white p-6 transition-shadow hover:shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lagoon-500/10">
                  <CheckIcon className="h-5 w-5 text-lagoon-600" />
                </span>
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
              <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">General rates &amp; dining</h2>
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
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Ready for a stay at KwaNomzi?</h2>
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
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">Find us</h2>
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
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-ink-900"
                >
                  Chat on WhatsApp →
                </a>
              </li>
            </ul>
          </div>
          <LocationMap />
        </div>
      </section>
    </>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LocationPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
