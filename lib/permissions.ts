/**
 * Role → permission mapping.
 *
 * This mirrors `public.role_permissions()` in
 * supabase/migrations/0002_production_hardening.sql exactly. The database is
 * the authority — every sensitive mutation re-checks the permission inside a
 * SECURITY DEFINER function — and this copy exists only so the admin UI can
 * hide controls the user could not use anyway.
 *
 * Never treat a check made with this module as an authorisation decision.
 */

export const PERMISSIONS = [
  "catalogue.manage",
  "inventory.adjust",
  "orders.view",
  "orders.fulfil",
  "orders.cancel",
  "orders.payment",
  "orders.note",
  "customers.view",
  "customers.manage",
  "coupons.manage",
  "reviews.moderate",
  "messages.manage",
  "newsletter.manage",
  "settings.manage",
  "staff.manage",
  "audit.view",
  "analytics.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole =
  | "admin"
  | "manager"
  | "staff"
  | "fulfilment"
  | "support";

export type AppRole = StaffRole | "customer";

const MANAGER_PERMISSIONS: Permission[] = [
  "catalogue.manage",
  "inventory.adjust",
  "orders.view",
  "orders.fulfil",
  "orders.cancel",
  "orders.payment",
  "orders.note",
  "customers.view",
  "coupons.manage",
  "reviews.moderate",
  "messages.manage",
  "newsletter.manage",
  "analytics.view",
];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  // Legacy role kept so pre-migration staff accounts keep working unchanged.
  staff: MANAGER_PERMISSIONS,
  fulfilment: ["orders.view", "orders.fulfil", "orders.note", "inventory.adjust"],
  support: ["orders.view", "orders.note", "customers.view", "messages.manage"],
  customer: [],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  manager: "Manager",
  staff: "Staff (legacy)",
  fulfilment: "Fulfilment",
  support: "Customer support",
  customer: "Customer",
};

/** Roles an administrator may assign from /admin/staff. */
export const ASSIGNABLE_ROLES: AppRole[] = [
  "customer",
  "support",
  "fulfilment",
  "manager",
  "admin",
];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && value in ROLE_PERMISSIONS;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return isAppRole(value) && value !== "customer";
}

export function permissionsForRole(role: unknown): readonly Permission[] {
  return isAppRole(role) ? ROLE_PERMISSIONS[role] : [];
}

export function roleHasPermission(role: unknown, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function roleLabel(role: unknown): string {
  return isAppRole(role) ? ROLE_LABELS[role] : "Unknown";
}
