import { NextResponse } from "next/server";
import { createBookingSchema } from "@/lib/validation/booking";
import { createBooking } from "@/lib/services/BookingService";
import { errorResponse } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createBookingSchema.parse(body);
    const booking = await createBooking(input);
    return NextResponse.json({ data: booking }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
