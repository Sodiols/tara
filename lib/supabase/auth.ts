import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { safeReturnPath } from "@/lib/safe-redirect";
// Re-exported so existing callers keep importing it from here, while the
// implementation lives in a pure, unit-testable module.
export { safeReturnPath };

import {
  isStaffRole,
  permissionsForRole,
  type AppRole,
  type Permission,
} from "@/lib/permissions";

/**
 * De-duplicated within a single render pass. Several server components ask for
 * the current user; without this each one issues its own network round trip to
 * Supabase Auth.
 */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export interface StaffContext {
  user: User;
  role: AppRole;
  permissions: readonly Permission[];
  name: string;
  email: string;
}

/**
 * Reads the caller's role from the database on every request.
 *
 * Never trusts the JWT payload or a client-supplied value: a role stored in a
 * token would keep working after an administrator revoked it.
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role,full_name,email,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.is_active || !isStaffRole(data.role)) return null;

  return {
    user,
    role: data.role,
    permissions: permissionsForRole(data.role),
    name: data.full_name || data.email || "TARA staff",
    email: data.email || user.email || "",
  };
});

export async function requireUser(returnTo = "/account") {
  const user = await getUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  }
  return user;
}

/**
 * Gate for every /admin route.
 *
 * A signed-out visitor is sent to the login page; a signed-in customer is sent
 * home rather than to a 404, because a 404 on /admin still confirms that the
 * path exists and merely needs a different account.
 */
export async function requireStaff(): Promise<StaffContext> {
  const user = await getUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent("/admin")}`);
  }
  const context = await getStaffContext();
  if (!context) redirect("/");
  return context;
}

/**
 * Gate for a specific admin capability. Used by pages and server actions.
 *
 * This is a convenience for the UI layer — the database re-checks the same
 * permission inside every SECURITY DEFINER function, so a request that somehow
 * reached the RPC without passing here still fails.
 */
export async function requirePermission(permission: Permission): Promise<StaffContext> {
  const context = await requireStaff();
  if (!context.permissions.includes(permission)) {
    redirect("/admin?denied=" + encodeURIComponent(permission));
  }
  return context;
}

