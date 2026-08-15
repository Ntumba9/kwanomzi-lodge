import { listStaff } from "@/lib/services/StaffService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StaffCreateForm } from "./StaffCreateForm";
import { StaffRow } from "./StaffRow";

export default async function StaffManagementPage() {
  const { allowed, session } = await checkPermission("staff:manage");
  if (!allowed) return <Forbidden />;

  const staff = await listStaff();
  const currentUserId = Number(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Staff</h1>
        <p className="mt-1 text-sm text-ink-700/60">
          Owner-only. Create accounts, change roles, and deactivate access — the last active owner account can&rsquo;t
          be deactivated or reassigned, so the lodge can never be locked out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="font-display text-lg text-ink-900">Add staff account</p>
        </CardHeader>
        <CardBody>
          <StaffCreateForm />
        </CardBody>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
            <tr>
              <th className="px-4 py-3 font-medium">Staff member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-200">
            {staff.map((s) => (
              <StaffRow
                key={s.id}
                staff={{
                  id: s.id,
                  name: s.name,
                  email: s.email,
                  role: s.role,
                  isActive: s.isActive,
                  lastLoginAt: s.lastLoginAt,
                  isSelf: s.id === currentUserId,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
