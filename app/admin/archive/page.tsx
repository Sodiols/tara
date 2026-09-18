import type { Metadata } from "next";
import { getArchivedItems, parsePage } from "@/lib/supabase/queries/admin";
import { ARCHIVE_FILTERS, isArchiveType } from "@/lib/archive";
import {
  AdminFilterBar,
  AdminFilterSelect,
  AdminQuickFilters,
  AdminSearchInput,
  PageHeader,
  Pagination,
  Panel,
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

      <AdminQuickFilters
        label="Archived item types"
        items={ARCHIVE_FILTERS.map((option) => ({
          label: option.label,
          href: hrefWith({ type: option.value, page: "" }),
          active: type === option.value,
        }))}
      />

      <AdminFilterBar
        action="/admin/archive"
        resetHref="/admin/archive"
        hasActiveFilters={Boolean(params.q || type)}
      >
        {type && <input type="hidden" name="type" value={type} />}
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="Name, ID, type or archived by" />
        <AdminFilterSelect
          name="sort"
          label="Sort"
          defaultValue={sort}
          options={[
            { value: "newest", label: "Newest archived first" },
            { value: "oldest", label: "Oldest archived first" },
          ]}
        />
      </AdminFilterBar>

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
