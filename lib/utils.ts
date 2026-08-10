/** Joins class names, skipping falsy values. Generic UI helper — not business logic. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
