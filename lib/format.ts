/**
 * Formats integer cents as a display string, e.g. 180000 -> "R1,800".
 * Deliberately not locale-currency-formatted (en-ZA's Intl output is
 * "R 1 800,00" — space thousands, comma decimals) — the client explicitly
 * asked for comma-thousands, no-space, no-decimals-unless-genuinely-
 * fractional formatting ("R1,100", not "R1,100.00" or "R 1 100,00").
 * Every amount in this system is currently a whole rand value, so decimals
 * only appear if that ever changes.
 */
export function formatMoney(cents: number, currency = "ZAR"): string {
  const amount = cents / 100;
  const hasFractionalCents = !Number.isInteger(amount);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: hasFractionalCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "ZAR" ? "R" : currency;
  return `${symbol}${formatted}`;
}

export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
