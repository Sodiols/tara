import Link from "next/link";
import { getNewsletterSubscribers, parsePage } from "@/lib/supabase/queries/admin";
import { setNewsletterActiveAction } from "@/lib/supabase/actions/admin";
import { formatDate } from "@/lib/format";
import {
  AdminEmptyState,
  PageHeader,
  Pagination,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ActiveBadge } from "@/components/admin/status";
import { RowActionButton } from "@/components/admin/AdminForm";
import { NewsletterExport } from "@/components/admin/NewsletterExport";

type SearchParams = { page?: string; q?: string; state?: string };

const STATES = [
  { value: "", label: "All" },
  { value: "active", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const state = (params.state as "all" | "active" | "unsubscribed") || "all";

  const { rows, total, pageSize } = await getNewsletterSubscribers({
    page,
    search: params.q,
    state,
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/newsletter?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Newsletter"
        description={`${total.toLocaleString("en-US")} record${total === 1 ? "" : "s"}. Unsubscribing keeps the row so the address is never re-added by mistake.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATES.map((option) => {
          const isActive = (params.state ?? "") === option.value;
          return (
            <Link
              key={option.label}
              href={option.value ? `/admin/newsletter?state=${option.value}` : "/admin/newsletter"}
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
        <form method="get" action="/admin/newsletter" className="ml-auto flex items-center gap-2">
          {params.state && <input type="hidden" name="state" value={params.state} />}
          <label htmlFor="newsletter-search" className="sr-only">
            Search subscribers
          </label>
          <input
            id="newsletter-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search by email"
            className="h-9 w-52 rounded-control border border-border bg-taraWhite px-3 font-sans text-sm outline-none focus:border-taraWine"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
          >
            Search
          </button>
        </form>
      </div>

      <Panel>
        <PanelHeader
          title="Subscribers"
          actions={<NewsletterExport activeOnly={state === "active"} />}
        />
        {rows.length === 0 ? (
          <AdminEmptyState
            title="No subscribers here"
            description="Sign-ups from the storefront footer appear in this list."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th align="right">Subscribed</Th>
                  <Th align="right">Unsubscribed</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((subscriber) => (
                  <tr key={subscriber.id} className="transition-colors hover:bg-taraIvory/40">
                    <Td className="break-all">{subscriber.email}</Td>
                    <Td>
                      <ActiveBadge active={subscriber.is_active} />
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {formatDate(subscriber.created_at)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {subscriber.unsubscribed_at ? formatDate(subscriber.unsubscribed_at) : "—"}
                    </Td>
                    <Td align="right">
                      {subscriber.is_active ? (
                        <RowActionButton
                          tone="danger"
                          confirm={`Unsubscribe ${subscriber.email}? Only do this if they asked.`}
                          action={async () => {
                            "use server";
                            return setNewsletterActiveAction(subscriber.id, false);
                          }}
                        >
                          Unsubscribe
                        </RowActionButton>
                      ) : (
                        <RowActionButton
                          confirm={`Resubscribe ${subscriber.email}? Only do this with their consent.`}
                          action={async () => {
                            "use server";
                            return setNewsletterActiveAction(subscriber.id, true);
                          }}
                        >
                          Resubscribe
                        </RowActionButton>
                      )}
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
