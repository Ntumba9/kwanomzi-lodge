import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-6 py-16 text-center">
      <p className="font-display text-lg text-ink-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-700/70">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
