import { formatMoney } from "@/lib/format";
import type { RateCardEntry } from "@/lib/settings";

/**
 * Renders one section of the official rate card (accommodation, meals, or
 * packages). The numbers always come from the database via getRateCard()
 * (Setting table) — never hardcoded here — so a future price change only
 * requires updating that row, not this component.
 */
export function RateTable({ title, entries }: { title: string; entries: RateCardEntry[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      <ul className="mt-3 divide-y divide-mist-200 overflow-hidden rounded-2xl border border-mist-200 bg-white">
        {entries.map((entry) => (
          <li key={entry.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-sm text-ink-900">
              {entry.label}
              {entry.note && <span className="block text-xs text-ink-700/60">{entry.note}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold text-lagoon-600">{formatMoney(entry.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
