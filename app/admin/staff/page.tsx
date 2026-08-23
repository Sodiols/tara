import { getStaffList } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { formatDate } from "@/lib/format";
import { ROLE_PERMISSIONS, ASSIGNABLE_ROLES, roleLabel } from "@/lib/permissions";
import {
  AdminEmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
  Badge,
} from "@/components/admin/ui";
import { ActiveBadge } from "@/components/admin/status";
import { StaffRoleForm } from "@/components/admin/StaffRoleForm";

export default async function AdminStaffPage() {
  const [staff, members] = await Promise.all([requireStaff(), getStaffList()]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Staff and roles"
        description="Roles are enforced by the database, not by hiding buttons. Changing a role is recorded in the audit log."
      />

      <Panel className="mb-5">
        <PanelHeader
          title="What each role can do"
          description="A staff member sees only the sections their role covers."
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Role</Th>
              <Th>Permissions</Th>
            </tr>
          </thead>
          <tbody>
            {ASSIGNABLE_ROLES.map((role) => (
              <tr key={role}>
                <Td className="whitespace-nowrap font-medium">{roleLabel(role)}</Td>
                <Td>
                  {ROLE_PERMISSIONS[role].length === 0 ? (
                    <span className="text-muted">Storefront only — no back-office access.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {ROLE_PERMISSIONS[role].map((permission) => (
                        <Badge key={permission} tone="neutral">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>

      <Panel>
        <PanelHeader
          title="Back-office accounts"
          description="Everyone with a role above customer. Passwords are managed entirely by Supabase Auth and are never visible here."
        />
        {members.length === 0 ? (
          <AdminEmptyState
            title="No staff accounts yet"
            description="Promote an existing customer account from the Customers list, or from the form below."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th align="right">Joined</Th>
                <Th align="right">Change role</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="align-middle">
                  <Td>
                    {member.full_name || "Unnamed"}
                    {member.id === staff.user.id && (
                      <span className="ml-2 font-sans text-[11px] uppercase tracking-wide text-muted">
                        (you)
                      </span>
                    )}
                  </Td>
                  <Td className="break-all">{member.email}</Td>
                  <Td>
                    <Badge tone="info">{roleLabel(member.role)}</Badge>
                  </Td>
                  <Td>
                    <ActiveBadge active={member.is_active} />
                  </Td>
                  <Td align="right" className="whitespace-nowrap text-xs text-muted">
                    {formatDate(member.created_at)}
                  </Td>
                  <Td align="right">
                    {member.id === staff.user.id ? (
                      <span className="font-sans text-xs text-muted">
                        You cannot change your own role
                      </span>
                    ) : (
                      <StaffRoleForm
                        profileId={member.id}
                        currentRole={member.role}
                        label={member.email}
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel className="mt-5">
        <PanelHeader
          title="Promoting someone new"
          description="There is deliberately no way to create an account from here."
        />
        <div className="px-5 py-5 font-sans text-sm leading-6 text-muted">
          <ol className="list-inside list-decimal space-y-1">
            <li>Ask the person to register on the storefront with their own email address.</li>
            <li>
              Find them in <span className="text-ink">Customers</span> and open their profile to
              confirm it is the right account.
            </li>
            <li>Return here and set their role.</li>
          </ol>
          <p className="mt-3">
            The database refuses to remove the last remaining administrator, so the store can never
            be locked out of its own admin panel.
          </p>
        </div>
      </Panel>
    </>
  );
}
