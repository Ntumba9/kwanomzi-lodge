import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingEmailData } from "@/lib/email/templates";

export type BookingForEmail = Prisma.BookingGetPayload<{
  include: { guest: true; room: { include: { roomType: true } } };
}>;

export function toBookingEmailData(booking: BookingForEmail): BookingEmailData {
  return {
    bookingReference: booking.bookingReference,
    guestFirstName: booking.guest.firstName,
    guestLastName: booking.guest.lastName,
    guestEmail: booking.guest.email,
    guestPhone: booking.guest.phone,
    guestCount: booking.guestCount,
    roomTypeName: booking.room.roomType.name,
    roomName: booking.room.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: booking.nights,
    totalAmountCents: booking.totalAmountCents,
    currency: booking.currency,
  };
}
