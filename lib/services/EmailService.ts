import { getResendClient, getEmailFrom } from "@/lib/email/resend";
import { business } from "@/lib/content/business";
import {
  guestBookingExpiredEmail,
  guestConfirmationEmail,
  guestPaymentFailedEmail,
  staffPaidReservationEmail,
  type BookingEmailData,
  type PaymentEmailData,
} from "@/lib/email/templates";

/**
 * Each function here is called exactly once per event, from inside the
 * webhook handler's one-time-per-eventId path (see app/api/webhooks/yoco) —
 * that's what makes "duplicate webhook -> duplicate email" impossible, not
 * anything in this file. These are thin wrappers around Resend so the
 * webhook handler doesn't need to know template/recipient details, and so
 * tests can mock this module directly instead of hitting the network.
 */

export async function sendGuestConfirmationEmail(booking: BookingEmailData, payment: PaymentEmailData) {
  const { subject, html } = guestConfirmationEmail(booking, payment);
  await getResendClient().emails.send({ from: getEmailFrom(), to: booking.guestEmail, subject, html });
}

export async function sendGuestPaymentFailedEmail(booking: BookingEmailData) {
  const { subject, html } = guestPaymentFailedEmail(booking);
  await getResendClient().emails.send({ from: getEmailFrom(), to: booking.guestEmail, subject, html });
}

export async function sendGuestBookingExpiredEmail(booking: BookingEmailData) {
  const { subject, html } = guestBookingExpiredEmail(booking);
  await getResendClient().emails.send({ from: getEmailFrom(), to: booking.guestEmail, subject, html });
}

export async function sendStaffPaidReservationEmail(booking: BookingEmailData, payment: PaymentEmailData) {
  const { subject, html } = staffPaidReservationEmail(booking, payment);
  await getResendClient().emails.send({ from: getEmailFrom(), to: business.email, subject, html });
}
