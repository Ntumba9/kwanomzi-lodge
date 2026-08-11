import { Card, CardBody } from "@/components/ui/Card";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function AdminStatCard({ label, value, hint }: AdminStatCardProps) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">{label}</p>
        <p className="mt-2 font-display text-3xl text-ink-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-700/60">{hint}</p>}
      </CardBody>
    </Card>
  );
}
