"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { resetStaffPasswordAction, setStaffActiveAction, updateStaffRoleAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export interface StaffRowData {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  isSelf: boolean;
}

export function StaffRow({ staff }: { staff: StaffRowData }) {
  const [showReset, setShowReset] = useState(false);
  const [activePending, startActiveTransition] = useTransition();
  const [activeError, setActiveError] = useState<string | null>(null);

  const boundRoleAction = updateStaffRoleAction.bind(null, staff.id);
  const [roleState, roleFormAction, rolePending] = useActionState(boundRoleAction, initialState);

  const boundResetAction = resetStaffPasswordAction.bind(null, staff.id);
  const [resetState, resetFormAction, resetPending] = useActionState(boundResetAction, initialState);

  function handleToggleActive() {
    setActiveError(null);
    startActiveTransition(async () => {
      const result = await setStaffActiveAction(staff.id, !staff.isActive);
      if (result.error) setActiveError(result.error);
    });
  }

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-ink-900">
          {staff.name} {staff.isSelf && <span className="text-xs text-ink-700/50">(you)</span>}
        </p>
        <p className="text-xs text-ink-700/60">{staff.email}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <form action={roleFormAction} className="flex flex-col gap-1">
          <select
            name="role"
            defaultValue={staff.role}
            disabled={rolePending}
            onChange={(e) => e.target.form?.requestSubmit()}
            className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs"
          >
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="RECEPTION">Reception</option>
            <option value="HOUSEKEEPING">Housekeeping</option>
            <option value="READ_ONLY">Read Only</option>
          </select>
          {roleState.error && <p className="text-xs font-medium text-red-600">{roleState.error}</p>}
        </form>
      </td>
      <td className="px-4 py-3 align-top">
        <Badge className={staff.isActive ? "bg-emerald-100 text-emerald-800" : "bg-mist-200 text-ink-700/60"}>
          {staff.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3 align-top text-xs text-ink-700/60">
        {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString("en-ZA") : "Never"}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button size="md" variant="ghost" className="px-3 py-1.5 text-xs" onClick={handleToggleActive} disabled={activePending}>
              {staff.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button size="md" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setShowReset((s) => !s)}>
              Reset password
            </Button>
          </div>
          {activeError && <p className="text-xs font-medium text-red-600">{activeError}</p>}
          {showReset && (
            <form action={resetFormAction} className="flex flex-col gap-1.5">
              <input
                type="password"
                name="password"
                minLength={8}
                required
                placeholder="New password (8+ chars)"
                className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs"
              />
              <Button type="submit" size="md" variant="secondary" className="px-3 py-1.5 text-xs" disabled={resetPending}>
                {resetPending ? "Saving…" : "Set new password"}
              </Button>
              {resetState.error && <p className="text-xs font-medium text-red-600">{resetState.error}</p>}
              {resetState.success && <p className="text-xs font-medium text-emerald-700">{resetState.success}</p>}
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
