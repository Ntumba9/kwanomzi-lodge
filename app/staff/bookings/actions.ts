"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { createBookingSchema } from "@/lib/validation/booking";
import { createBooking, transitionBooking } from "@/lib/services/BookingService";
import { initiateCheckout } from "@/lib/services/PaymentService";
import { requirePermission } from "@/lib/auth/staffAuth";
import { recordAuditLog } from "@/lib/services/AuditService";
import { DomainError } from "@/lib/errors";

export interface ActionState {
  error?: string;
}

const transitionSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  toStatus: z.string().min(1),
});

const CHECKINOUT_STATUSES: BookingStatus[] = ["CHECKED_IN", "CHECKED_OUT"];

export async function transitionBookingAction(bookingId: number, toStatus: BookingStatus): Promise<ActionState> {
  const parsed = transitionSchema.safeParse({ bookingId, toStatus });
  if (!parsed.success) return { error: "Invalid request." };

  // Checking a guest in/out is a distinct, narrower permission than general
  // booking management (e.g. cancelling) — RECEPTION has both, but a future
  // role could have one without the other.
  const permission = CHECKINOUT_STATUSES.includes(parsed.data.toStatus as BookingStatus) ? "bookings:checkinout" : "bookings:manage";
  const session = await requirePermission(permission);

  try {
    // transitionBooking itself enforces isTransitionAllowed and throws
    // InvalidStatusTransitionError (a DomainError) for anything not on the
    // allow-list — caught below and returned as a clean message.
    await transitionBooking(parsed.data.bookingId, parsed.data.toStatus as BookingStatus);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not update this booking." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: `BOOKING_${parsed.data.toStatus}`,
    entityType: "Booking",
    entityId: String(bookingId),
  });

  revalidatePath(`/staff/bookings/${bookingId}`);
  revalidatePath("/staff/bookings");
  revalidatePath("/staff");
  return {};
}

export async function createManualBookingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("bookings:manage");

  const raw = {
    roomId: Number(formData.get("roomId")),
    checkIn: String(formData.get("checkIn") ?? ""),
    checkOut: String(formData.get("checkOut") ?? ""),
    guestCount: Number(formData.get("guestCount")),
    guest: {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    },
    specialRequests: String(formData.get("specialRequests") ?? "") || undefined,
  };

  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid booking details." };
  }

  let bookingId: number;
  try {
    const booking = await createBooking(parsed.data);
    bookingId = booking.id;
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not create this booking." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "BOOKING_CREATED",
    entityType: "Booking",
    entityId: String(bookingId),
    metadata: { roomId: parsed.data.roomId, checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut },
  });

  revalidatePath("/staff/bookings");
  revalidatePath("/staff");
  redirect(`/staff/bookings/${bookingId}`);
}

export interface GeneratePaymentLinkState {
  error?: string;
  redirectUrl?: string;
}

/**
 * Staff-side equivalent of the guest wizard's checkout-initiation call.
 * Deliberately calls PaymentService.initiateCheckout(bookingId) directly
 * with the raw id rather than going through the public reference+email
 * ownership check (app/api/payments/initiate) — this route is already
 * gated by the staff session (proxy.ts protects the whole /staff/** tree,
 * and requirePermission() re-checks here as defense-in-depth), so that
 * check would be redundant, not an extra safeguard.
 */
export async function generatePaymentLinkAction(bookingId: number): Promise<GeneratePaymentLinkState> {
  await requirePermission("bookings:manage");

  try {
    const checkout = await initiateCheckout(bookingId);
    revalidatePath(`/staff/bookings/${bookingId}`);
    return { redirectUrl: checkout.redirectUrl };
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not generate a payment link." };
  }
}
