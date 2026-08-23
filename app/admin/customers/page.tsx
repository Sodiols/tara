import Link from "next/link";
import { getAdminCustomers, parsePage } from "@/lib/supabase/queries/admin";
import { formatDate } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/permissions";
import {
  AdminEmptyState,
  Field,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
  Toolbar,
  adminInputClass,
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
        eyebrow="People"
        title="Customers"
        description={`${total.toLocaleString("en-US")} account${total === 1 ? "" : "s"}. Open a customer to see their orders and spend.`}
      />

      <form method="get" action="/admin/customers">
        <Toolbar>
          <Field label="Search" htmlFor="customer-search" className="min-w-[240px] flex-1">
            <input
              id="customer-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Name, email or phone"
              className={adminInputClass}
            />
          </Field>
          <Field label="Role" htmlFor="customer-role" className="min-w-[170px]">
            <select
              id="customer-role"
              name="role"
              defaultValue={params.role ?? ""}
              className={adminInputClass}
            >
              <option value="">All roles</option>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-2 pb-[1px]">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
            >
              Apply
            </button>
            <Link
              href="/admin/customers"
              className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
            >
              Reset
            </Link>
          </div>
        </Toolbar>
      </form>

      <Panel>
        {rows.length === 0 ? (
          <AdminEmptyState
            title="No customers match those filters"
            description="Accounts appear here as soon as someone registers on the storefront."
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
