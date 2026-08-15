"use server";

import { revalidatePath } from "next/cache";
import { setBookingHoldMinutes, setRateCard } from "@/lib/settings";
import { requirePermission } from "@/lib/auth/staffAuth";
import { recordAuditLog } from "@/lib/services/AuditService";
import { bookingHoldMinutesSchema, rateCardSchema } from "@/lib/validation/settings";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

export async function updateHoldMinutesAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("settings:manage");

  const parsed = bookingHoldMinutesSchema.safeParse(formData.get("holdMinutes"));
  if (!parsed.success) {
    return { error: "Enter a whole number of minutes between 1 and 1440." };
  }

  await setBookingHoldMinutes(parsed.data);
  await recordAuditLog({
    userId: Number(session.user.id),
    action: "SETTINGS_HOLD_MINUTES_CHANGED",
    entityType: "Setting",
    entityId: "BOOKING_HOLD_MINUTES",
    metadata: { minutes: parsed.data },
  });
  revalidatePath("/staff/settings");
  return { success: "Booking hold duration updated." };
}

export async function updateRateCardAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("settings:manage");

  const raw = String(formData.get("rateCard") ?? "");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "That isn't valid JSON — check for a missing comma or bracket." };
  }

  const parsed = rateCardSchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Rate card doesn't match the expected shape." };
  }

  await setRateCard(parsed.data);
  await recordAuditLog({
    userId: Number(session.user.id),
    action: "SETTINGS_RATE_CARD_CHANGED",
    entityType: "Setting",
    entityId: "RATE_CARD",
  });
  revalidatePath("/staff/settings");
  revalidatePath("/");
  return { success: "Rate card updated." };
}
