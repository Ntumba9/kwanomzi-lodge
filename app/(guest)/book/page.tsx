import { BookingWizard } from "./BookingWizard";

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const params = await searchParams;
  const roomTypeIdParam = Array.isArray(params.roomTypeId) ? params.roomTypeId[0] : params.roomTypeId;
  const initialRoomTypeId = roomTypeIdParam ? Number(roomTypeIdParam) : undefined;

  return <BookingWizard initialRoomTypeId={Number.isFinite(initialRoomTypeId) ? initialRoomTypeId : undefined} />;
}
