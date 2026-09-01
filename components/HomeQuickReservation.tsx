"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { resolveRoomImageSrc, sortRoomImages } from "@/lib/content/images";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import type { AvailabilityResult, AvailableRoom, ApiError } from "@/app/(guest)/book/types";

type Step = "form" | "results";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Homepage quick-reservation widget. Deliberately reuses the exact same
 * GET /api/availability endpoint (and therefore AvailabilityService) that
 * the full /book wizard uses — no separate availability logic, no fake or
 * hardcoded room data. Selecting a room here doesn't create a booking; it
 * hands the guest's choice off to the existing /book flow (BookingWizard),
 * which remains the sole place a Booking row is ever created. See
 * BookingWizard's initialCheckIn/initialCheckOut/initialGuestCount/
 * initialRoomTypeId props for how that hand-off is consumed.
 */
export function HomeQuickReservation() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [results, setResults] = useState<AvailabilityResult[] | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights =
    checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000) : 0;
  const guestCount = adults + children;

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSelectedRoomTypeId(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ checkIn, checkOut });
      const res = await fetch(`/api/availability?${params.toString()}`);
      const body = (await res.json()) as { data: AvailabilityResult[] } | ApiError;
      if (!res.ok) throw new Error("error" in body ? body.error.message : "Could not check availability.");
      setResults("data" in body ? body.data : []);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function continueToReserve(roomTypeId: number) {
    const params = new URLSearchParams({
      roomTypeId: String(roomTypeId),
      checkIn,
      checkOut,
      guestCount: String(guestCount),
      // adults/children are display-only on /book (see BookingWizard's doc
      // comment) — guestCount above remains the one value actually used
      // for the booking itself.
      adults: String(adults),
      children: String(children),
    });
    router.push(`/book?${params.toString()}`);
  }

  const selectedResult = results?.find((r) => r.roomType.id === selectedRoomTypeId) ?? null;
  const withRooms = results?.filter((r) => r.availableRooms.length > 0) ?? [];

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur sm:p-6 md:p-7">
      <form onSubmit={handleReserve} className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 md:items-end">
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label htmlFor="qr-checkin" className="text-xs font-semibold uppercase tracking-wide text-ink-700/70">
            Check-in
          </label>
          <input
            id="qr-checkin"
            type="date"
            required
            min={todayString()}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="rounded-lg border border-mist-200 px-3 py-2.5 text-sm text-ink-900 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600"
          />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label htmlFor="qr-checkout" className="text-xs font-semibold uppercase tracking-wide text-ink-700/70">
            Check-out
          </label>
          <input
            id="qr-checkout"
            type="date"
            required
            min={checkIn || todayString()}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="rounded-lg border border-mist-200 px-3 py-2.5 text-sm text-ink-900 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600"
          />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label htmlFor="qr-adults" className="text-xs font-semibold uppercase tracking-wide text-ink-700/70">
            Adults
          </label>
          <input
            id="qr-adults"
            type="number"
            min={1}
            max={20}
            required
            value={adults}
            onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
            className="rounded-lg border border-mist-200 px-3 py-2.5 text-sm text-ink-900 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600"
          />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label htmlFor="qr-children" className="text-xs font-semibold uppercase tracking-wide text-ink-700/70">
            Children
          </label>
          <input
            id="qr-children"
            type="number"
            min={0}
            max={20}
            value={children}
            onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
            className="rounded-lg border border-mist-200 px-3 py-2.5 text-sm text-ink-900 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600"
          />
        </div>
        <div className="md:col-span-1">
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "Checking…" : "Reserve"}
          </Button>
        </div>
      </form>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

      {step === "results" && (
        <div className="mt-6 border-t border-mist-200 pt-6">
          {loading ? (
            <LoadingState label="Checking availability…" />
          ) : withRooms.length === 0 ? (
            <p className="rounded-lg bg-mist-100 px-4 py-4 text-center text-sm text-ink-700/80">
              No rooms available for these dates. Try a different date range.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Available rooms */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Available rooms</p>
                {withRooms.map(({ roomType, availableRooms }) => {
                  const isSelected = roomType.id === selectedRoomTypeId;
                  const primaryImage = sortRoomImages(roomType.images ?? [])[0];
                  return (
                    <button
                      key={roomType.id}
                      type="button"
                      onClick={() => setSelectedRoomTypeId(roomType.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        isSelected ? "border-lagoon-600 bg-lagoon-500/5" : "border-mist-200 hover:border-lagoon-300"
                      }`}
                    >
                      <PlaceholderImage
                        label={roomType.name}
                        src={resolveRoomImageSrc(primaryImage?.url)}
                        className="h-16 w-20 shrink-0 rounded-lg"
                        showLabel={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base text-ink-900">{roomType.name}</p>
                        <p className="text-xs text-ink-700/70">
                          {formatMoney(roomType.basePriceCents)} / night · Sleeps {roomType.capacity} ·{" "}
                          {availableRooms.length} {availableRooms.length === 1 ? "room" : "rooms"} available
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected room detail */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-700/60">Your selection</p>
                {selectedResult ? (
                  <SelectedRoomDetail
                    result={selectedResult}
                    nights={nights}
                    onReserve={() => continueToReserve(selectedResult.roomType.id)}
                  />
                ) : (
                  <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-8 text-center text-sm text-ink-700/60">
                    Select a room to see photos, rate and total price.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectedRoomDetail({
  result,
  nights,
  onReserve,
}: {
  result: AvailabilityResult;
  nights: number;
  onReserve: () => void;
}) {
  const { roomType, availableRooms } = result;
  const room: AvailableRoom | undefined = availableRooms[0];
  // Room-level override takes precedence over the room type's base rate,
  // same precedence BookingWizard already uses for the room it selects.
  const pricePerNightCents = room?.priceOverrideCents ?? roomType.basePriceCents;
  const totalCents = pricePerNightCents * Math.max(nights, 0);
  const primaryImage = sortRoomImages(roomType.images ?? [])[0];

  return (
    <div className="overflow-hidden rounded-xl border border-mist-200 bg-white">
      <PlaceholderImage
        label={primaryImage?.altText ?? roomType.name}
        src={resolveRoomImageSrc(primaryImage?.url)}
        className="aspect-[16/10] w-full"
      />
      <div className="p-4">
        <p className="font-display text-lg text-ink-900">{roomType.name}</p>
        {room && room.name !== roomType.name && <p className="text-xs text-ink-700/60">Room: {room.name}</p>}
        {roomType.description && <p className="mt-2 line-clamp-3 text-sm text-ink-700/80">{roomType.description}</p>}

        <div className="mt-4 rounded-lg bg-mist-100 px-3 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-700/80">{formatMoney(pricePerNightCents)}</span>
            <span className="text-xs text-ink-700/60">per night</span>
          </div>
          {nights > 0 && (
            <>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-700/70">
                <span>
                  {nights} {nights === 1 ? "night" : "nights"} × {formatMoney(pricePerNightCents)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-mist-200 pt-2 font-display text-base text-ink-900">
                <span>Total</span>
                <span>{formatMoney(totalCents)}</span>
              </div>
            </>
          )}
        </div>

        <Button onClick={onReserve} size="lg" className="mt-4 w-full">
          Reserve This Room
        </Button>
      </div>
    </div>
  );
}
