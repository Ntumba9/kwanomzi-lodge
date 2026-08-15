import { getBookingHoldMinutes, getRateCard } from "@/lib/settings";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { HoldMinutesForm, RateCardForm } from "./SettingsForm";

const EMPTY_RATE_CARD = { accommodation: [], meals: [], packages: [] };

export default async function StaffSettingsPage() {
  const { allowed } = await checkPermission("settings:manage");
  if (!allowed) return <Forbidden />;

  const [holdMinutes, rateCard] = await Promise.all([getBookingHoldMinutes(), getRateCard()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-700/60">Lodge-wide configuration, shared across the guest site and staff portal.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Booking holds</p>
        </CardHeader>
        <CardBody>
          <HoldMinutesForm currentValue={holdMinutes} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Rate card</p>
        </CardHeader>
        <CardBody>
          <RateCardForm currentValue={JSON.stringify(rateCard ?? EMPTY_RATE_CARD, null, 2)} />
        </CardBody>
      </Card>
    </div>
  );
}
