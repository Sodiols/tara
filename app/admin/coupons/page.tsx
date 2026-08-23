import Link from "next/link";
import { getAdminCoupons, parsePage } from "@/lib/supabase/queries/admin";
import { PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { CouponAdmin } from "@/components/admin/CouponAdmin";

type SearchParams = { page?: string; q?: string; state?: string };

const STATES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { rows, total, pageSize } = await getAdminCoupons({
    page,
    search: params.q,
    state: params.state,
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/coupons?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Coupons"
        description={`${total.toLocaleString("en-US")} coupon${total === 1 ? "" : "s"}.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATES.map((option) => {
          const isActive = (params.state ?? "") === option.value;
          return (
            <Link
              key={option.label}
              href={option.value ? `/admin/coupons?state=${option.value}` : "/admin/coupons"}
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
        <form method="get" action="/admin/coupons" className="ml-auto flex items-center gap-2">
          {params.state && <input type="hidden" name="state" value={params.state} />}
          <label htmlFor="coupon-search" className="sr-only">
            Search coupons
          </label>
          <input
            id="coupon-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search by code"
            className="h-9 w-48 rounded-control border border-border bg-taraWhite px-3 font-sans text-sm outline-none focus:border-taraWine"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
          >
            Search
          </button>
        </form>
      </div>

      <CouponAdmin coupons={rows} />

      {total > pageSize && (
        <Panel className="mt-5">
          <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
        </Panel>
      )}
    </>
  );
}
