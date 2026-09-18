"use client";

import { useState } from "react";
import { setStaffRoleAction } from "@/lib/supabase/actions/admin";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  roleLabel,
  type AppRole,
} from "@/lib/permissions";
import { ActionForm, SubmitButton } from "./AdminForm";
import { adminInputClass } from "./ui";

/**
 * Role change control.
 *
 * The confirmation spells out who is being changed and to what, because a
 * mis-click here hands someone the keys to the whole store. The database
 * additionally refuses to demote the last administrator and refuses to let
 * anyone change their own role.
 */
export function StaffRoleForm({
  profileId,
  currentRole,
  label,
}: {
  profileId: string;
  currentRole: AppRole;
  label: string;
}) {
  const [role, setRole] = useState<AppRole>(currentRole);
  const changed = role !== currentRole;

  return (
    <ActionForm action={setStaffRoleAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor={`role-${profileId}`} className="sr-only">
        Role for {label}
      </label>
      <select
        id={`role-${profileId}`}
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value as AppRole)}
        className={`${adminInputClass} h-10 w-auto min-w-[150px]`}
        title={ROLE_DESCRIPTIONS[role]}
      >
        {ASSIGNABLE_ROLES.map((option) => (
          <option key={option} value={option}>
            {roleLabel(option)}
          </option>
        ))}
        {!ASSIGNABLE_ROLES.includes(currentRole) && (
          <option value={currentRole}>{roleLabel(currentRole)}</option>
        )}
      </select>
      <SubmitButton
        variant={role === "admin" || role === "customer" ? "danger" : "secondary"}
        className="h-10 px-3 text-xs"
        disabled={!changed}
        confirmTitle={
          role === "admin"
            ? `Make ${label} an administrator?`
            : role === "customer"
              ? `Remove back-office access for ${label}?`
              : `Change ${label} to ${roleLabel(role)}?`
        }
        confirmLabel={role === "customer" ? "Remove access" : `Make ${roleLabel(role)}`}
        confirm={
          role === "admin"
            ? `${ROLE_DESCRIPTIONS.admin} This is the most trusted role in the shop.`
            : role === "customer"
              ? `They will lose access to the back office immediately. ${roleLabel(currentRole)} → Customer.`
              : `${roleLabel(currentRole)} → ${roleLabel(role)}. ${ROLE_DESCRIPTIONS[role]}`
        }
      >
        Save
      </SubmitButton>
    </ActionForm>
  );
}
