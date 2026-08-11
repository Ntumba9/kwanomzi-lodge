import { NextResponse } from "next/server";
import { initiateCheckoutSchema } from "@/lib/validation/payment";
import { findBookingForGuest } from "@/lib/services/BookingService";
import { initiateCheckout } from "@/lib/services/PaymentService";
import { BookingNotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = initiateCheckoutSchema.parse(body);

    // Reference + email is this app's only proof of booking ownership
    // (no guest accounts) — same check used for the manage-booking lookup.
    const booking = await findBookingForGuest(input.bookingReference, input.email);
    if (!booking) {
      throw new BookingNotFoundError("No matching booking found.");
    }

    const checkout = await initiateCheckout(booking.id);
    return NextResponse.json({ data: { redirectUrl: checkout.redirectUrl } });
  } catch (err) {
    return errorResponse(err);
  }
}
