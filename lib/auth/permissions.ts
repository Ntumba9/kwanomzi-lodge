/**
 * Single source of truth for what each staff role may do. Every server-side
 * check (page guards in lib/auth/staffAuth.ts, Server Actions, and the
 * client-side nav filter in components/staff/StaffSidebar.tsx) reads from
 * this table — there is deliberately no second copy of this logic anywhere.
 * The nav filter is a convenience (don't show a link you can't use); the
 * page/action guards are the actual enforcement. See lib/auth/staffAuth.ts.
 */
export type Role = "OWNER" | "MANAGER" | "RECEPTION" | "HOUSEKEEPING" | "READ_ONLY";

export const ALL_ROLES: Role[] = ["OWNER", "MANAGER", "RECEPTION", "HOUSEKEEPING", "READ_ONLY"];

export type Permission =
  | "dashboard:view"
  | "bookings:view"
  | "bookings:manage" // create, edit, cancel
  | "bookings:checkinout"
  | "calendar:view"
  | "rooms:view"
  | "rooms:manage" // room type/room CRUD, pricing
  | "rooms:operate" // operational status only (clean/dirty/maintenance/available)
  | "housekeeping:view" // today's checkouts + room status, without full booking/guest access
  | "guests:view"
  | "payments:view"
  | "financial:view" // revenue figures on the dashboard
  | "reports:view"
  | "staff:manage"
  | "settings:manage"
  | "auditlog:view";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "dashboard:view",
    "bookings:view",
    "bookings:manage",
    "bookings:checkinout",
    "calendar:view",
    "rooms:view",
    "rooms:manage",
    "rooms:operate",
    "guests:view",
    "payments:view",
    "financial:view",
    "reports:view",
    "staff:manage",
    "settings:manage",
    "auditlog:view",
  ],
  MANAGER: [
    "dashboard:view",
    "bookings:view",
    "bookings:manage",
    "bookings:checkinout",
    "calendar:view",
    "rooms:view",
    "rooms:manage",
    "rooms:operate",
    "guests:view",
    "payments:view",
    "financial:view",
    "reports:view",
    "settings:manage",
  ],
  RECEPTION: [
    "dashboard:view",
    "bookings:view",
    "bookings:manage",
    "bookings:checkinout",
    "calendar:view",
    "rooms:view",
    "guests:view",
  ],
  HOUSEKEEPING: ["dashboard:view", "housekeeping:view", "rooms:view", "rooms:operate"],
  READ_ONLY: ["dashboard:view", "bookings:view", "calendar:view", "rooms:view", "reports:view"],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role as Role] ?? []).includes(permission);
}

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}
