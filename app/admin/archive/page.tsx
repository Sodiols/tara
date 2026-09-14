import Link from "next/link";
import type { Metadata } from "next";
import { getArchivedItems, parsePage } from "@/lib/supabase/queries/admin";
import { ARCHIVE_FILTERS, isArchiveType } from "@/lib/archive";
import {
  Field,
  PageHeader,
  Pagination,
  Panel,
  Toolbar,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/ui";
import { ArchiveTable } from "@/components/admin/ArchiveTable";

export const metadata: Metadata = { title: "Archive & Trash" };

type SearchParams = { page?: string; q?: string; type?: string; sort?: string };

/**
 * Archive & Trash. Administrators only.
 *
 * `getArchivedItems()` calls requirePermission("archive.manage"), which sends a
 * manager or member of staff who types this URL back to the dashboard, and the
 * archived_items policy returns nothing to them even if they query the table
 * directly.
 */
export default async function AdminArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const type = isArchiveType(params.type) ? params.type : "";
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const { rows, total, pageSize } = await getArchivedItems({
    page,
    search: params.q,
    type,
    sort,
  });

  const hrefWith = (changes: Partial<SearchParams>) => {
    const query = new URLSearchParams();
    const next = { q: params.q, type, sort: sort === "newest" ? "" : sort, ...changes };
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/admin/archive?${qs}` : "/admin/archive";
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Archive & Trash"
        description="Everything archived by staff, managers and administrators. Restore an item to put it back where it was, or permanently delete it. Items linked to order history are kept for the records and cannot be permanently deleted."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ARCHIVE_FILTERS.map((option) => {
          const isActive = type === option.value;
          return (
            <Link
              key={option.label}
              href={hrefWith({ type: option.value, page: "" })}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "inline-flex h-9 items-center rounded-control border border-taraWine bg-taraWine px-3 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory"
                  : "inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <form method="get" action="/admin/archive">
        {type && <input type="hidden" name="type" value={type} />}
        <Toolbar>
          <Field label="Search" htmlFor="archive-search" className="min-w-[240px] flex-1">
            <input
              id="archive-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Name, ID, type or archived by"
              className={adminInputClass}
            />
          </Field>
          <Field label="Sort" htmlFor="archive-sort" className="min-w-[170px]">
            <select id="archive-sort" name="sort" defaultValue={sort} className={adminSelectClass}>
              <option value="newest">Newest archived first</option>
              <option value="oldest">Oldest archived first</option>
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
              href="/admin/archive"
              className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
            >
              Reset
            </Link>
          </div>
        </Toolbar>
      </form>

      <Panel>
        <ArchiveTable
          items={rows.map((row) => ({
            type: row.entity_type,
            id: row.entity_id,
            label: row.label,
            detail: row.detail,
            archivedAt: row.archived_at,
            archivedByEmail: row.archived_by_email,
            archivedByRole: row.archived_by_role,
          }))}
          filtered={Boolean(params.q || type)}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          buildHref={(nextPage) => hrefWith({ page: String(nextPage) })}
        />
      </Panel>
    </>
  );
}
