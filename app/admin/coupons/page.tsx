import { getAdminCoupons, parsePage } from "@/lib/supabase/queries/admin";
import {
  AdminFilterBar,
  AdminQuickFilters,
  AdminSearchInput,
  PageHeader,
  Pagination,
  Panel,
} from "@/components/admin/ui";
import { CouponAdmin } from "@/components/admin/CouponAdmin";

type SearchParams = { page?: string; q?: string; state?: string };

const STATES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
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
        eyebrow="Marketing"
        title="Coupons"
        description={`${total.toLocaleString("en-US")} coupon${total === 1 ? "" : "s"}. A coupon is a code the customer types at checkout; for an automatic campaign, use the Launch offer.`}
      />

      <AdminQuickFilters
        label="Filter coupons"
        items={STATES.map((option) => ({
          label: option.label,
          href: option.value ? `/admin/coupons?state=${option.value}` : "/admin/coupons",
          active: (params.state ?? "") === option.value,
        }))}
      />

      <AdminFilterBar action="/admin/coupons" submitLabel="Search">
        {params.state && <input type="hidden" name="state" value={params.state} />}
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="Coupon code" label="Search coupons" />
      </AdminFilterBar>

      <CouponAdmin coupons={rows} />

      {total > pageSize && (
        <Panel className="mt-5">
          <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
        </Panel>
      )}
    </>
  );
}
