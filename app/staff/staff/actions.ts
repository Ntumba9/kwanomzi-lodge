"use server";

import { revalidatePath } from "next/cache";
import { createStaffAccount, resetStaffPassword, setStaffActive, updateStaffRole } from "@/lib/services/StaffService";
import { requirePermission } from "@/lib/auth/staffAuth";
import { recordAuditLog } from "@/lib/services/AuditService";
import { createStaffSchema, resetPasswordSchema, staffRoleSchema } from "@/lib/validation/staff";
import { DomainError } from "@/lib/errors";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createStaffAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("staff:manage");

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid staff account details." };
  }

  let created;
  try {
    created = await createStaffAccount(parsed.data);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not create staff account." };
  }

  // Never log the password itself — only which account was created and by whom.
  await recordAuditLog({
    userId: Number(session.user.id),
    action: "STAFF_CREATED",
    entityType: "User",
    entityId: String(created.id),
    metadata: { email: created.email, role: created.role },
  });

  revalidatePath("/staff/staff");
  return { success: `Staff account created for ${created.email}.` };
}

// Signature is (userId, prevState, formData), not (userId, formData) — see
// app/staff/rooms/actions.ts's updateRoomTypeAction for why: StaffRow calls
// `.bind(null, userId)` and hands the result to useActionState, which always
// invokes an action as (prevState, formData).
export async function updateStaffRoleAction(userId: number, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("staff:manage");

  const parsed = staffRoleSchema.safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Invalid role." };

  try {
    await updateStaffRole(userId, parsed.data);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not update role." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: "STAFF_ROLE_CHANGED",
    entityType: "User",
    entityId: String(userId),
    metadata: { newRole: parsed.data },
  });

  revalidatePath("/staff/staff");
  return { success: "Role updated." };
}

export async function setStaffActiveAction(userId: number, isActive: boolean): Promise<ActionState> {
  const session = await requirePermission("staff:manage");

  try {
    await setStaffActive(userId, isActive);
  } catch (err) {
    return { error: err instanceof DomainError ? err.message : "Could not update account status." };
  }

  await recordAuditLog({
    userId: Number(session.user.id),
    action: isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
    entityType: "User",
    entityId: String(userId),
  });

  revalidatePath("/staff/staff");
  return { success: isActive ? "Account activated." : "Account deactivated." };
}

// Same (id, prevState, formData) shape as updateStaffRoleAction above.
export async function resetStaffPasswordAction(userId: number, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("staff:manage");

  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Password must be at least 8 characters." };
  }

  await resetStaffPassword(userId, parsed.data.password);

  // Confirms only that a reset happened — never the new password.
  await recordAuditLog({
    userId: Number(session.user.id),
    action: "STAFF_PASSWORD_RESET",
    entityType: "User",
    entityId: String(userId),
  });

  return { success: "Password reset." };
}
