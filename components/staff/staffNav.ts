import type { Permission } from "@/lib/auth/permissions";

/**
 * A nav entry only appears for a role that has its `permission`. This is a
 * convenience so nobody sees a link to a page they can't use — it is NOT
 * the access control. Every page and Server Action re-checks the same
 * permission server-side (see lib/auth/staffAuth.ts); a hidden link here
 * enforces nothing on its own.
 */
export const staffNavLinks: { href: string; label: string; permission: Permission }[] = [
  { href: "/staff", label: "Dashboard", permission: "dashboard:view" },
  { href: "/staff/bookings", label: "Bookings", permission: "bookings:view" },
  { href: "/staff/calendar", label: "Calendar", permission: "calendar:view" },
  { href: "/staff/rooms", label: "Rooms", permission: "rooms:view" },
  { href: "/staff/guests", label: "Guests", permission: "guests:view" },
  { href: "/staff/payments", label: "Payments", permission: "payments:view" },
  { href: "/staff/reports", label: "Reports", permission: "reports:view" },
  { href: "/staff/staff", label: "Staff", permission: "staff:manage" },
  { href: "/staff/settings", label: "Settings", permission: "settings:manage" },
  { href: "/staff/audit-log", label: "Audit Log", permission: "auditlog:view" },
] as const;
