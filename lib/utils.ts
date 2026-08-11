import { twMerge } from "tailwind-merge";

/** Joins class names and resolves conflicting Tailwind utilities (e.g. two different `px-*`) in favor of the later one. Generic UI helper — not business logic. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
