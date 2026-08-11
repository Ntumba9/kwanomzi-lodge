import { NextResponse } from "next/server";
import { listActiveRooms } from "@/lib/services/RoomService";
import { errorResponse } from "@/lib/api/respond";

export async function GET() {
  try {
    const rooms = await listActiveRooms();
    return NextResponse.json({ data: rooms });
  } catch (err) {
    return errorResponse(err);
  }
}
