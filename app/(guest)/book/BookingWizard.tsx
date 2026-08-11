"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { formatMoney } from "@/lib/format";
import type { AvailabilityResult, AvailableRoom, ApiError, GuestDetails } from "./types";

type Step = "dates" | "rooms" | "details" | "review";

interface SelectedRoom {
  roomTypeId: number;
  roomTypeName: string;
  room: AvailableRoom;
  pricePerNightCents: number;
  capacity: number;
}

interface BookingWizardProps {
  initialRoomTypeId?: number;
}

const emptyGuest: GuestDetails = { firstName: "", lastName: "", email: "", phone: "", specialRequests: "" };

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWizard({ initialRoomTypeId }: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("dates");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [results, setResults] = useState<AvailabilityResult[] | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [guest, setGuest] = useState<GuestDetails>(emptyGuest);
  const [guestCount, setGuestCount] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function selectRoom(roomTypeId: number, roomTypeName: string, room: AvailableRoom, basePriceCents: number, capacity: number) {
    setSelectedRoom({
      roomTypeId,
      roomTypeName,
      room,
      pricePerNightCents: room.priceOverrideCents ?? basePriceCents,
      capacity,
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

      {step === "dates" && (
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
        <Card>
          <CardBody>
            <button onClick={() => setStep("details")} className="mb-4 text-sm text-lagoon-600 hover:underline">
              ← Edit details
            </button>
            <h1 className="font-display text-2xl text-ink-900">Review &amp; pay</h1>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <SummaryRow label="Room" value={`${selectedRoom.roomTypeName} — ${selectedRoom.room.name}`} />
              <SummaryRow label="Guest" value={`${guest.firstName} ${guest.lastName}`} />
              <SummaryRow label="Guests" value={String(guestCount)} />
              <SummaryRow label="Check-in" value={checkIn} />
              <SummaryRow label="Check-out" value={checkOut} />
              <SummaryRow label="Nights" value={String(nights)} />
              <SummaryRow label="Total due" value={formatMoney(selectedRoom.pricePerNightCents * nights)} />
            </dl>
            <div className="mt-8 rounded-lg bg-lagoon-300/20 px-4 py-3 text-sm text-ink-800">
              KwaNomzi is a prepaid lodge. Your room is held for you now, and you&rsquo;ll be taken to Yoco to
              complete secure payment. Your reservation is only confirmed once payment is verified.
            </div>
            <Button size="lg" className="mt-6 w-full" disabled={loading} onClick={handleProceedToPayment}>
              {loading ? "Preparing payment…" : "Proceed to Payment"}
            </Button>
          </CardBody>
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
  onSelect: (roomTypeId: number, roomTypeName: string, room: AvailableRoom, basePriceCents: number, capacity: number) => void;
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
      {ordered.map(({ roomType, availableRooms }) => (
        <Card key={roomType.id}>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg text-ink-900">{roomType.name}</p>
              <p className="text-sm text-ink-700/70">
                {formatMoney(roomType.basePriceCents)} / night · Sleeps {roomType.capacity} · {availableRooms.length}{" "}
                {availableRooms.length === 1 ? "room" : "rooms"} available
              </p>
            </div>
            <Button
              onClick={() => onSelect(roomType.id, roomType.name, availableRooms[0]!, roomType.basePriceCents, roomType.capacity)}
            >
              Select
            </Button>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
