import { formatDateDisplay, formatMoney } from "@/lib/format";
import { business } from "@/lib/content/business";

/**
 * Minimal shape each template needs — deliberately not the full Prisma
 * payload type, so templates stay easy to unit test with plain objects and
 * don't accidentally depend on relations a caller forgot to include.
 */
export interface BookingEmailData {
  bookingReference: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestCount: number | null;
  roomTypeName: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  totalAmountCents: number;
  currency: string;
}

export interface PaymentEmailData {
  amountCents: number;
  currency: string;
  providerReference: string | null;
  paidAt: Date;
}

interface EmailContent {
  subject: string;
  html: string;
}

const BRAND_COLOR = "#427cae";
const INK = "#0b0c0e";

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f9fa;font-family:Georgia,'Times New Roman',serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e5e8;">
            <tr>
              <td style="background:${INK};padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;">KwaNomzi</span><span style="color:${BRAND_COLOR};font-size:20px;font-weight:bold;"></span>
                <div style="color:#9aa0a6;font-size:12px;font-style:italic;margin-top:2px;">Boutique Lodge</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#eef0f2;font-size:12px;color:#5f656b;">
                <strong>${business.name}</strong><br />
                ${business.address.full}<br />
                ${business.phone} &middot; ${business.email}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#5f656b;font-size:13px;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:bold;font-size:13px;">${value}</td>
  </tr>`;
}

function bookingDetailRows(booking: BookingEmailData): string {
  return [
    detailRow("Booking reference", booking.bookingReference),
    detailRow("Accommodation", `${booking.roomTypeName} — ${booking.roomName}`),
    detailRow("Check-in", formatDateDisplay(booking.checkIn)),
    detailRow("Check-out", formatDateDisplay(booking.checkOut)),
    detailRow("Nights", String(booking.nights)),
    booking.guestCount ? detailRow("Guests", String(booking.guestCount)) : "",
    detailRow("Amount", formatMoney(booking.totalAmountCents, booking.currency)),
  ].join("");
}

export function guestConfirmationEmail(booking: BookingEmailData, payment: PaymentEmailData): EmailContent {
  return {
    subject: `Reservation Confirmed — ${booking.bookingReference}`,
    html: layout(`
      <h1 style="font-size:22px;margin:0 0 4px;">Reservation confirmed</h1>
      <p style="font-size:14px;color:#3a3d42;margin:0 0 20px;">
        Thank you, ${booking.guestFirstName}. Your payment has been verified and your stay at KwaNomzi is confirmed.
      </p>
      <table role="presentation" width="100%" style="border-top:1px solid #e2e5e8;border-bottom:1px solid #e2e5e8;padding:8px 0;">
        ${bookingDetailRows(booking)}
        ${detailRow("Amount paid", formatMoney(payment.amountCents, payment.currency))}
        ${detailRow("Status", "Confirmed")}
      </table>
      <p style="font-size:13px;color:#5f656b;margin:20px 0 0;">
        Keep your booking reference and this email safe — you'll need your reference and email to look up this booking later.
      </p>
    `),
  };
}

export function guestPaymentFailedEmail(booking: BookingEmailData): EmailContent {
  return {
    subject: `Payment Unsuccessful — ${booking.bookingReference}`,
    html: layout(`
      <h1 style="font-size:22px;margin:0 0 4px;">We couldn't process your payment</h1>
      <p style="font-size:14px;color:#3a3d42;margin:0 0 20px;">
        Hi ${booking.guestFirstName}, your recent payment attempt for booking ${booking.bookingReference} was not successful.
        Your room is still held — you can try again before the hold expires.
      </p>
      <table role="presentation" width="100%" style="border-top:1px solid #e2e5e8;border-bottom:1px solid #e2e5e8;padding:8px 0;">
        ${bookingDetailRows(booking)}
      </table>
      <p style="font-size:13px;color:#5f656b;margin:20px 0 0;">
        If you'd like help completing your booking, contact us at ${business.phone} or ${business.email}.
      </p>
    `),
  };
}

export function guestBookingExpiredEmail(booking: BookingEmailData): EmailContent {
  return {
    subject: `Booking Hold Expired — ${booking.bookingReference}`,
    html: layout(`
      <h1 style="font-size:22px;margin:0 0 4px;">Your room hold has expired</h1>
      <p style="font-size:14px;color:#3a3d42;margin:0 0 20px;">
        Hi ${booking.guestFirstName}, the temporary hold on your selected room for booking ${booking.bookingReference}
        expired before payment was completed, so the room has been released.
      </p>
      <table role="presentation" width="100%" style="border-top:1px solid #e2e5e8;border-bottom:1px solid #e2e5e8;padding:8px 0;">
        ${bookingDetailRows(booking)}
      </table>
      <p style="font-size:13px;color:#5f656b;margin:20px 0 0;">
        You're welcome to make a new booking at any time. Contact us at ${business.phone} or ${business.email} if you need help.
      </p>
    `),
  };
}

export function staffPaidReservationEmail(booking: BookingEmailData, payment: PaymentEmailData): EmailContent {
  return {
    subject: `PAID RESERVATION — ${booking.bookingReference} — ${booking.guestFirstName} ${booking.guestLastName}`,
    html: layout(`
      <h1 style="font-size:22px;margin:0 0 4px;color:#0f5132;">New paid reservation</h1>
      <p style="font-size:14px;color:#3a3d42;margin:0 0 20px;">
        Payment has been verified and this booking is now <strong>CONFIRMED</strong>.
      </p>
      <table role="presentation" width="100%" style="border-top:1px solid #e2e5e8;border-bottom:1px solid #e2e5e8;padding:8px 0;">
        ${bookingDetailRows(booking)}
        ${detailRow("Guest name", `${booking.guestFirstName} ${booking.guestLastName}`)}
        ${detailRow("Guest email", booking.guestEmail)}
        ${detailRow("Guest phone", booking.guestPhone ?? "Not provided")}
        ${detailRow("Amount paid", formatMoney(payment.amountCents, payment.currency))}
        ${detailRow("Payment reference", payment.providerReference ?? "—")}
        ${detailRow("Payment status", "PAID")}
        ${detailRow("Booking status", "CONFIRMED")}
        ${detailRow("Paid at", formatDateDisplay(payment.paidAt))}
      </table>
    `),
  };
}
