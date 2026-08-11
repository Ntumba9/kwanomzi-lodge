import { NextResponse } from "next/server";
import { availabilitySearchSchema } from "@/lib/validation/availability";
import { searchAvailableRoomTypes } from "@/lib/services/AvailabilityService";
import { parseDateOnly } from "@/lib/dates";
import { errorResponse } from "@/lib/api/respond";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = availabilitySearchSchema.parse({
      checkIn: searchParams.get("checkIn"),
      checkOut: searchParams.get("checkOut"),
    });

    const results = await searchAvailableRoomTypes(parseDateOnly(input.checkIn), parseDateOnly(input.checkOut));
    return NextResponse.json({ data: results });
  } catch (err) {
    return errorResponse(err);
  }
}
