import Link from "next/link";
import { getAuditLog, parsePage } from "@/lib/supabase/queries/admin";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";
import {
  AdminEmptyState,
  Badge,
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

type SearchParams = { page?: string; q?: string; entity?: string };

const ENTITY_TYPES = [
  { value: "", label: "All records" },
  { value: "order", label: "Orders" },
  { value: "product_variant", label: "Inventory" },
  { value: "coupon", label: "Coupons" },
  { value: "review", label: "Reviews" },
  { value: "contact_message", label: "Messages" },
  { value: "newsletter_subscriber", label: "Newsletter" },
  { value: "store_settings", label: "Settings" },
  { value: "profile", label: "Accounts" },
];

function summarise(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return String(value);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 4)
    .map(([key, v]) => `${key}: ${String(v)}`);
  return entries.length ? entries.join(", ") : null;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { rows, total, pageSize } = await getAuditLog({
    page,
    search: params.q,
    entityType: params.entity,
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/audit-log?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Every order transition, payment change, stock adjustment, coupon edit, moderation decision, settings change and role change. Written by the database, so it cannot be skipped by any client."
      />

      <form method="get" action="/admin/audit-log">
        <Toolbar>
          <Field label="Search" htmlFor="audit-search" className="min-w-[240px] flex-1">
            <input
              id="audit-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Staff email, action or record"
              className={adminInputClass}
            />
          </Field>
          <Field label="Record type" htmlFor="audit-entity" className="min-w-[180px]">
            <select
              id="audit-entity"
              name="entity"
              defaultValue={params.entity ?? ""}
              className={adminInputClass}
            >
              {ENTITY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              href="/admin/audit-log"
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
            title="Nothing recorded yet"
            description="Sensitive administrative actions are appended here as they happen."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th>Change</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const before = summarise(entry.before_value);
                  const after = summarise(entry.after_value);
                  return (
                    <tr key={entry.id} className="align-top">
                      <Td className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(entry.created_at)}
                      </Td>
                      <Td>
                        <span className="block break-all text-sm">
                          {entry.actor_email || "System"}
                        </span>
                        <span className="block font-sans text-[11px] uppercase tracking-wide text-muted">
                          {roleLabel(entry.actor_role)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone="info">{entry.action}</Badge>
                      </Td>
                      <Td>
                        <span className="block text-sm">{entry.entity_label ?? "—"}</span>
                        <span className="block font-sans text-[11px] text-muted">
                          {entry.entity_type}
                        </span>
                      </Td>
                      <Td className="max-w-[320px]">
                        {before && (
                          <span className="block font-sans text-xs text-muted">from {before}</span>
                        )}
                        {after && (
                          <span className="block font-sans text-xs text-ink">to {after}</span>
                        )}
                        {entry.reason && (
                          <span className="mt-1 block font-sans text-xs italic text-muted">
                            “{entry.reason}”
                          </span>
                        )}
                        {!before && !after && !entry.reason && (
                          <span className="font-sans text-xs text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
