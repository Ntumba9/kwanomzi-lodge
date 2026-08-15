import { listAuditLog } from "@/lib/services/AuditService";
import { checkPermission } from "@/lib/auth/staffAuth";
import { Forbidden } from "@/components/staff/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function StaffAuditLogPage() {
  const { allowed } = await checkPermission("auditlog:view");
  if (!allowed) return <Forbidden />;

  const entries = await listAuditLog(200);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Audit Log</h1>
        <p className="mt-1 text-sm text-ink-700/60">The most recent 200 recorded actions, newest first.</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No audit entries yet" description="Staff actions like booking changes, role changes, and settings updates will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-mist-100 text-xs uppercase tracking-wide text-ink-700/70">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Staff member</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-xs text-ink-700/70">{new Date(entry.createdAt).toLocaleString("en-ZA")}</td>
                  <td className="px-4 py-3 text-ink-900">{entry.user ? entry.user.name : <span className="text-ink-700/50">System</span>}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{entry.action}</td>
                  <td className="px-4 py-3 text-ink-700/70">
                    {entry.entityType} #{entry.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
