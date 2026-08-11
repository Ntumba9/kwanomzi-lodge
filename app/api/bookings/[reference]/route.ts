import { NextResponse } from "next/server";
import { bookingLookupSchema } from "@/lib/validation/bookingLookup";
import { findBookingForGuest } from "@/lib/services/BookingService";
import { errorResponse } from "@/lib/api/respond";

export async function GET(request: Request, { params }: RouteContext<"/api/bookings/[reference]">) {
  try {
    const { reference } = await params;
    const { searchParams } = new URL(request.url);
    const input = bookingLookupSchema.parse({ reference, email: searchParams.get("email") });

    const booking = await findBookingForGuest(input.reference, input.email);
    if (!booking) {
      return NextResponse.json(
        { error: { code: "BOOKING_NOT_FOUND", message: "No matching booking found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: booking });
  } catch (err) {
    return errorResponse(err);
  }
}
