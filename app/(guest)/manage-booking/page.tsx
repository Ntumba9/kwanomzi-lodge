import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/Card";
import { ManageBookingForm } from "./ManageBookingForm";

export const metadata: Metadata = {
  title: "Manage My Booking — KwaNomzi Boutique Lodge",
};

export default function ManageBookingPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lagoon-600">Existing Booking</p>
      <h1 className="mt-3 font-display text-3xl text-ink-900">Manage my booking</h1>
      <p className="mt-3 text-sm text-ink-700/70">
        Enter your booking reference and the email address you used when booking.
      </p>
      <Card className="mt-8">
        <CardBody>
          <ManageBookingForm />
        </CardBody>
      </Card>
    </div>
  );
}
