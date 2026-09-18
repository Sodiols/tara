import Link from "next/link";
import { getAdminCustomers, parsePage } from "@/lib/supabase/queries/admin";
import { formatDate } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/permissions";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminSearchInput,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ActiveBadge, Badge } from "@/components/admin/status";

type SearchParams = { page?: string; q?: string; role?: string };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { rows, total, pageSize } = await getAdminCustomers({
    page,
    search: params.q,
    role: params.role,
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/customers?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Customers"
        description={`${total.toLocaleString("en-US")} account${total === 1 ? "" : "s"}. Open a customer to see their orders and spend.`}
      />

      <AdminFilterBar
        action="/admin/customers"
        resetHref="/admin/customers"
        hasActiveFilters={Boolean(params.q || params.role)}
      >
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="Name, email or phone" />
        <AdminFilterSelect
          name="role"
          label="Role"
          defaultValue={params.role ?? ""}
          options={[
            { value: "", label: "All roles" },
            ...ASSIGNABLE_ROLES.map((role) => ({ value: role, label: roleLabel(role) })),
          ]}
        />
      </AdminFilterBar>

      <Panel>
        {rows.length === 0 ? (
          <AdminEmptyState
            title={params.q || params.role ? "No customers match these filters" : "No customers yet"}
            description={
              params.q || params.role
                ? "Try a different search, or clear the filters."
                : "Accounts appear here as soon as someone registers on the storefront."
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th align="right">Joined</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((profile) => (
                  <tr key={profile.id} className="transition-colors hover:bg-taraIvory/40">
                    <Td>
                      <Link
                        href={`/admin/customers/${profile.id}`}
                        className="font-medium text-taraWine underline-offset-4 hover:underline"
                      >
                        {profile.full_name || "Unnamed customer"}
                      </Link>
                    </Td>
                    <Td className="break-all">{profile.email || "—"}</Td>
                    <Td>{profile.phone ? formatBdPhone(profile.phone) : "—"}</Td>
                    <Td>
                      <Badge tone={profile.role === "customer" ? "neutral" : "info"}>
                        {roleLabel(profile.role)}
                      </Badge>
                    </Td>
                    <Td>
                      <ActiveBadge active={profile.is_active} />
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {formatDate(profile.created_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
