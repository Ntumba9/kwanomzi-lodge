"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { formatMoney, formatDateDisplay } from "@/lib/format";
import { resolveRoomImageSrc, sortRoomImages } from "@/lib/content/images";
import type { AvailabilityResult, AvailableRoom, RoomImageSummary, ApiError, GuestDetails } from "./types";

type Step = "dates" | "rooms" | "details" | "review";

interface SelectedRoom {
  roomTypeId: number;
  roomTypeName: string;
  roomTypeDescription: string | null;
  room: AvailableRoom;
  pricePerNightCents: number;
  capacity: number;
  // Carried through so the room preview and the pre-payment reservation
  // summary can both show the actual selected room's photo — sourced
  // directly from AvailabilityService's existing response, never a second
  // fetch or a placeholder.
  images: RoomImageSummary[];
}

interface BookingWizardProps {
  initialRoomTypeId?: number;
  // Populated when arriving from the homepage quick-reservation widget
  // (components/HomeQuickReservation.tsx), which already ran an
  // availability search and got the guest to pick a specific room type.
  // When all three are present, this component re-runs that same
  // GET /api/availability search itself (never trusting the homepage's
  // now-possibly-stale result) and, if the room type is still available,
  // skips straight to "details" instead of making the guest search and
  // select again. Falls back to the normal "dates" start if the room is
  // no longer available or any value is missing.
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuestCount?: number;
  // Display-only breakdown of initialGuestCount (adults + children) from
  // the homepage widget — used solely to show "2 Adults, 1 Child" instead
  // of a bare number in the reservation summary. guestCount itself (the
  // only value actually sent to the API — the schema has no separate
  // adults/children columns) remains the single source of truth; if the
  // guest edits the total on the details step away from this sum, the
  // summary falls back to a plain count rather than showing a stale split.
  initialAdults?: number;
  initialChildren?: number;
}

const emptyGuest: GuestDetails = { firstName: "", lastName: "", email: "", phone: "", specialRequests: "" };

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWizard({
  initialRoomTypeId,
  initialCheckIn,
  initialCheckOut,
  initialGuestCount,
  initialAdults,
  initialChildren,
}: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("dates");
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? "");
  const [results, setResults] = useState<AvailabilityResult[] | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [guest, setGuest] = useState<GuestDetails>(emptyGuest);
  const [guestCount, setGuestCount] = useState(initialGuestCount ?? 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-confirm and auto-advance past "dates"/"rooms" when arriving with a
  // full pre-fill from the homepage widget. Runs once on mount; the
  // dependency array is deliberately fixed inputs, not reactive state, so
  // this never re-fires as the guest edits the form afterward.
  useEffect(() => {
    if (!initialCheckIn || !initialCheckOut || !initialRoomTypeId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ checkIn: initialCheckIn, checkOut: initialCheckOut });
        const res = await fetch(`/api/availability?${params.toString()}`);
        const body = (await res.json()) as { data: AvailabilityResult[] } | ApiError;
        if (cancelled) return;
        if (!res.ok) throw new Error("error" in body ? body.error.message : "Could not check availability.");

        const data = "data" in body ? body.data : [];
        setResults(data);

        const match = data.find((r) => r.roomType.id === initialRoomTypeId);
        const room = match?.availableRooms[0];
        if (match && room) {
          selectRoom(
            match.roomType.id,
            match.roomType.name,
            match.roomType.description,
            room,
            match.roomType.basePriceCents,
            match.roomType.capacity,
            match.roomType.images,
          );
          // selectRoom() always resets guestCount to 1 (correct for the
          // normal manual-selection path) — override it back to what the
          // guest actually chose on the homepage widget, applied after so
          // it wins (React batches same-tick state updates in call order).
          if (initialGuestCount) setGuestCount(initialGuestCount);
        } else {
          // No longer available — fall back to a normal search on these
          // dates so the guest can pick something else, rather than a dead end.
          setStep("rooms");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ checkIn, checkOut });
      const res = await fetch(`/api/availability?${params.toString()}`);
      const body = (await res.json()) as { data: AvailabilityResult[] } | ApiError;
      if (!res.ok) throw new Error("error" in body ? body.error.message : "Could not check availability.");
      setResults("data" in body ? body.data : []);
      setStep("rooms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function selectRoom(
    roomTypeId: number,
    roomTypeName: string,
    roomTypeDescription: string | null,
    room: AvailableRoom,
    basePriceCents: number,
    capacity: number,
    images: RoomImageSummary[],
  ) {
    setSelectedRoom({
      roomTypeId,
      roomTypeName,
      roomTypeDescription,
      room,
      pricePerNightCents: room.priceOverrideCents ?? basePriceCents,
      capacity,
      images,
    });
    setGuestCount(1);
    setStep("details");
  }

  function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("review");
  }

  /**
   * This does NOT confirm the booking — it creates a PAYMENT_PENDING hold,
   * then sends the browser to Yoco's hosted checkout. The booking only ever
   * becomes CONFIRMED via the server-side webhook (app/api/webhooks/yoco),
   * never because this function ran or because Yoco redirects back here.
   */
  async function handleProceedToPayment() {
    if (!selectedRoom) return;
    setError(null);
    setLoading(true);
    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.room.id,
          checkIn,
          checkOut,
          guestCount,
          guest: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone,
            specialRequests: guest.specialRequests || undefined,
          },
        }),
      });
      const bookingBody = (await bookingRes.json()) as { data: { bookingReference: string } } | ApiError;
      if (!bookingRes.ok) {
        if ("error" in bookingBody && bookingBody.error.code === "ROOM_NOT_AVAILABLE") {
          setError("That room was just booked by someone else for these dates. Please choose another room.");
          setStep("rooms");
          return;
        }
        throw new Error("error" in bookingBody ? bookingBody.error.message : "Could not complete the booking.");
      }
      const reference = (bookingBody as { data: { bookingReference: string } }).data.bookingReference;

      const paymentRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingReference: reference, email: guest.email }),
      });
      const paymentBody = (await paymentRes.json()) as { data: { redirectUrl: string } } | ApiError;
      if (!paymentRes.ok) {
        // The booking itself was created and is safely held — only the
        // payment step failed (e.g. Yoco isn't configured in this
        // environment yet). Send the guest to the status page rather than
        // leaving them stuck with no way forward; it will honestly show
        // PAYMENT_PENDING, not a fake success.
        setError(
          "error" in paymentBody
            ? `Your booking was created but payment couldn't be started: ${paymentBody.error.message}`
            : "Your booking was created but payment couldn't be started.",
        );
        router.push(`/book/${reference}?email=${encodeURIComponent(guest.email)}`);
        return;
      }

      window.location.href = (paymentBody as { data: { redirectUrl: string } }).data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const nights =
    checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <Steps current={step} />

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      {step === "dates" && loading && initialCheckIn && initialRoomTypeId ? (
        <Card>
          <CardBody>
            <LoadingState label="Confirming your selection…" />
          </CardBody>
        </Card>
      ) : (
        step === "dates" && (
        <Card>
          <CardBody>
            <h1 className="font-display text-2xl text-ink-900">Check availability</h1>
            <form onSubmit={handleSearch} className="mt-6 grid gap-5 sm:grid-cols-2">
              <TextField
                label="Check-in"
                type="date"
                name="checkIn"
                required
                min={todayString()}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
              <TextField
                label="Check-out"
                type="date"
                name="checkOut"
                required
                min={checkIn || todayString()}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" disabled={loading} className="w-full">
                  {loading ? "Searching…" : "Search Availability"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
        )
      )}

      {step === "rooms" && (
        <div>
          <button onClick={() => setStep("dates")} className="mb-6 text-sm text-lagoon-600 hover:underline">
            ← Change dates
          </button>
          {loading ? (
            <LoadingState label="Checking availability…" />
          ) : (
            <RoomsList
              results={results ?? []}
              initialRoomTypeId={initialRoomTypeId}
              onSelect={selectRoom}
            />
          )}
        </div>
      )}

      {step === "details" && selectedRoom && (
        <Card>
          <CardBody>
            <button onClick={() => setStep("rooms")} className="mb-4 text-sm text-lagoon-600 hover:underline">
              ← Choose a different room
            </button>
            <h1 className="font-display text-2xl text-ink-900">Your details</h1>
            <form onSubmit={handleDetailsSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
              <TextField
                label="First name"
                required
                value={guest.firstName}
                onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
              />
              <TextField
                label="Last name"
                required
                value={guest.lastName}
                onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
              />
              <TextField
                label="Email"
                type="email"
                required
                className="sm:col-span-2"
                value={guest.email}
                onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              />
              <TextField
                label="Phone"
                required
                value={guest.phone}
                onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
              />
              <TextField
                label="Number of guests"
                type="number"
                required
                min={1}
                max={selectedRoom.capacity}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                hint={`This room sleeps up to ${selectedRoom.capacity}.`}
              />
              <div className="sm:col-span-2">
                <TextAreaField
                  label="Special requests (optional)"
                  value={guest.specialRequests}
                  onChange={(e) => setGuest({ ...guest, specialRequests: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" className="w-full">
                  Review Booking
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {step === "review" && selectedRoom && (
        <Card className="overflow-hidden">
          {(() => {
            const primaryImage = sortRoomImages(selectedRoom.images)[0];
            // Only shown as a breakdown when it still adds up to the current
            // guestCount — if the guest changed the total on the details
            // step, a stale "2 Adults, 1 Child" would be actively wrong, so
            // this falls back to a plain count instead.
            const breakdownValid =
              initialAdults !== undefined && initialChildren !== undefined && initialAdults + initialChildren === guestCount;
            const guestsLabel = breakdownValid
              ? [
                  `${initialAdults} ${initialAdults === 1 ? "Adult" : "Adults"}`,
                  initialChildren! > 0 ? `${initialChildren} ${initialChildren === 1 ? "Child" : "Children"}` : null,
                ]
                  .filter(Boolean)
                  .join(", ")
              : `${guestCount} ${guestCount === 1 ? "guest" : "guests"}`;
            const totalCents = selectedRoom.pricePerNightCents * nights;

            return (
              <>
                <PlaceholderImage
                  label={primaryImage?.altText ?? selectedRoom.roomTypeName}
                  src={resolveRoomImageSrc(primaryImage?.url)}
                  className="aspect-[16/9] w-full"
                />
                <CardBody>
                  <button onClick={() => setStep("details")} className="mb-4 text-sm text-lagoon-600 hover:underline">
                    ← Edit details
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Reservation summary</p>
                  <h1 className="mt-1 font-display text-2xl text-ink-900">
                    {selectedRoom.roomTypeName}
                    {selectedRoom.room.name !== selectedRoom.roomTypeName && (
                      <span className="ml-2 text-base font-normal text-ink-700/60">({selectedRoom.room.name})</span>
                    )}
                  </h1>
                  {selectedRoom.roomTypeDescription && (
                    <p className="mt-2 text-sm text-ink-700/80">{selectedRoom.roomTypeDescription}</p>
                  )}

                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <SummaryRow label="Guest" value={`${guest.firstName} ${guest.lastName}`} />
                    <SummaryRow label="Guests" value={guestsLabel} />
                    <SummaryRow label="Check-in" value={formatDateDisplay(checkIn)} />
                    <SummaryRow label="Check-out" value={formatDateDisplay(checkOut)} />
                    <SummaryRow label="Duration" value={`${nights} ${nights === 1 ? "night" : "nights"}`} />
                    <SummaryRow label="Rate" value={`${formatMoney(selectedRoom.pricePerNightCents)} / night`} />
                  </dl>

                  <div className="mt-6 rounded-lg bg-mist-100 px-4 py-4">
                    <div className="flex items-center justify-between text-sm text-ink-700/80">
                      <span>
                        {nights} {nights === 1 ? "night" : "nights"} × {formatMoney(selectedRoom.pricePerNightCents)}
                      </span>
                      <span>{formatMoney(totalCents)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-mist-200 pt-3 font-display text-lg text-ink-900">
                      <span>Total</span>
                      <span>{formatMoney(totalCents)}</span>
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg bg-lagoon-300/20 px-4 py-3 text-sm text-ink-800">
                    KwaNomzi is a prepaid lodge. Your room is held for you now, and you&rsquo;ll be taken to Yoco to
                    complete secure payment. Your reservation is only confirmed once payment is verified.
                  </div>
                  <Button size="lg" className="mt-6 w-full" disabled={loading} onClick={handleProceedToPayment}>
                    {loading ? "Preparing payment…" : "Proceed to Payment"}
                  </Button>
                </CardBody>
              </>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "dates", label: "Dates" },
    { key: "rooms", label: "Room" },
    { key: "details", label: "Details" },
    { key: "review", label: "Review" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="mb-10 flex items-center gap-2 text-xs font-medium text-ink-700/60 sm:gap-4 sm:text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className={`flex items-center gap-2 ${i <= currentIndex ? "text-lagoon-600" : ""}`}>
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              i <= currentIndex ? "bg-lagoon-600 text-mist-50" : "bg-mist-200"
            }`}
          >
            {i + 1}
          </span>
          {s.label}
          {i < steps.length - 1 && <span className="mx-1 text-ink-700/30 sm:mx-2">—</span>}
        </li>
      ))}
    </ol>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-700/60">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function RoomsList({
  results,
  initialRoomTypeId,
  onSelect,
}: {
  results: AvailabilityResult[];
  initialRoomTypeId?: number;
  onSelect: (
    roomTypeId: number,
    roomTypeName: string,
    roomTypeDescription: string | null,
    room: AvailableRoom,
    basePriceCents: number,
    capacity: number,
    images: RoomImageSummary[],
  ) => void;
}) {
  const withRooms = results.filter((r) => r.availableRooms.length > 0);
  const ordered = initialRoomTypeId
    ? [...withRooms].sort((a, b) => (a.roomType.id === initialRoomTypeId ? -1 : b.roomType.id === initialRoomTypeId ? 1 : 0))
    : withRooms;

  if (ordered.length === 0) {
    return <EmptyState title="No rooms available for these dates" description="Try a different date range." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {ordered.map(({ roomType, availableRooms }) => {
        const primaryImage = sortRoomImages(roomType.images)[0];
        return (
          <Card key={roomType.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <PlaceholderImage
                  label={roomType.name}
                  src={resolveRoomImageSrc(primaryImage?.url)}
                  showLabel={false}
                  className="h-16 w-20 shrink-0 rounded-lg"
                />
                <div>
                  <p className="font-display text-lg text-ink-900">{roomType.name}</p>
                  <p className="text-sm text-ink-700/70">
                    {formatMoney(roomType.basePriceCents)} / night · Sleeps {roomType.capacity} · {availableRooms.length}{" "}
                    {availableRooms.length === 1 ? "room" : "rooms"} available
                  </p>
                </div>
              </div>
              <Button
                onClick={() =>
                  onSelect(
                    roomType.id,
                    roomType.name,
                    roomType.description,
                    availableRooms[0]!,
                    roomType.basePriceCents,
                    roomType.capacity,
                    roomType.images,
                  )
                }
              >
                Select
              </Button>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
