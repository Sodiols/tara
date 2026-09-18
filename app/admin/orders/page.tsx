import { getAdminOrders, parsePage } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { storeDateInputValue } from "@/lib/format";
import { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminQuickFilters,
  AdminSearchInput,
  Field,
  PageHeader,
  Pagination,
  Panel,
  adminInputClass,
} from "@/components/admin/ui";
import { OrdersTable } from "@/components/admin/OrdersTable";
import type { OrderStatus, PaymentStatus } from "@/types/database";

type SearchParams = {
  page?: string;
  q?: string;
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  sort?: string;
};

const QUICK_FILTERS: { label: string; href: string }[] = [
  { label: "All", href: "/admin/orders" },
  { label: "Pending", href: "/admin/orders?status=pending" },
  { label: "Confirmed", href: "/admin/orders?status=confirmed" },
  { label: "Processing", href: "/admin/orders?status=processing" },
  { label: "Packed", href: "/admin/orders?status=packed" },
  { label: "Shipped", href: "/admin/orders?status=shipped" },
  { label: "Delivered", href: "/admin/orders?status=delivered" },
  { label: "Unpaid", href: "/admin/orders?payment=unpaid" },
  { label: "Cancelled", href: "/admin/orders?status=cancelled" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);

  const [staff, { rows, total, pageSize }] = await Promise.all([
    requireStaff(),
    getAdminOrders({
      page,
      search: params.q,
      status: (params.status as OrderStatus) || "all",
      paymentStatus: (params.payment as PaymentStatus) || "all",
      from: params.from,
      to: params.to,
      sort: (params.sort as "newest" | "oldest" | "highest" | "lowest") || "newest",
    }),
  ]);
  // Controls only; every delete path re-checks archive.manage on the server.
  const canDelete = staff.permissions.includes("archive.manage");

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/orders?${query.toString()}`;
  };

  const activeFilter = params.status ?? params.payment ?? "";
  const filtered = Boolean(
    params.q || params.status || params.payment || params.from || params.to,
  );

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description={`${total.toLocaleString("en-US")} order${total === 1 ? "" : "s"}${filtered ? " match these filters" : ""}. Open one to confirm, pack, ship or print it.${canDelete ? " Archived orders are in Archive & Trash." : ""}`}
      />

      <AdminQuickFilters
        label="Quick filters"
        items={QUICK_FILTERS.map((filter) => {
          const value = new URL(filter.href, "http://x").searchParams;
          return {
            label: filter.label,
            href: filter.href,
            active: (value.get("status") ?? value.get("payment") ?? "") === activeFilter,
          };
        })}
      />

      <AdminFilterBar action="/admin/orders" resetHref="/admin/orders" hasActiveFilters={filtered}>
        <AdminSearchInput
          defaultValue={params.q ?? ""}
          placeholder="Order number, name, phone or email"
        />
        <AdminFilterSelect
          name="status"
          label="Status"
          defaultValue={params.status ?? ""}
          options={[
            { value: "", label: "All statuses" },
            ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
          ]}
        />
        <AdminFilterSelect
          name="payment"
          label="Payment"
          defaultValue={params.payment ?? ""}
          options={[
            { value: "", label: "All payments" },
            ...PAYMENT_STATUSES.map((status) => ({ value: status, label: PAYMENT_STATUS_LABELS[status] })),
          ]}
        />
        <Field label="From" htmlFor="order-from" className="sm:w-40">
          <input
            id="order-from"
            name="from"
            type="date"
            max={storeDateInputValue(new Date())}
            defaultValue={params.from ?? ""}
            className={adminInputClass}
          />
        </Field>
        <Field label="To" htmlFor="order-to" className="sm:w-40">
          <input
            id="order-to"
            name="to"
            type="date"
            max={storeDateInputValue(new Date())}
            defaultValue={params.to ?? ""}
            className={adminInputClass}
          />
        </Field>
        <AdminFilterSelect
          name="sort"
          label="Sort"
          defaultValue={params.sort ?? "newest"}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "highest", label: "Highest value" },
            { value: "lowest", label: "Lowest value" },
          ]}
        />
      </AdminFilterBar>

      <Panel>
        {rows.length === 0 ? (
          filtered ? (
            <AdminEmptyState
              title="No orders match these filters"
              description="Try widening the date range, clearing the search, or clearing the filters."
            />
          ) : (
            <AdminEmptyState
              title="No orders yet"
              description="Orders placed on the storefront appear here the moment they arrive."
            />
          )
        ) : (
          <>
            <OrdersTable rows={rows} canDelete={canDelete} />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              buildHref={buildHref}
            />
          </>
        )}
      </Panel>
    </>
  );
}
