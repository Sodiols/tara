import Link from "next/link";
import { getAdminOrders, parsePage } from "@/lib/supabase/queries/admin";
import { formatDateTime, formatTaka, storeDateInputValue } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
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
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status";
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

  const { rows, total, pageSize } = await getAdminOrders({
    page,
    search: params.q,
    status: (params.status as OrderStatus) || "all",
    paymentStatus: (params.payment as PaymentStatus) || "all",
    from: params.from,
    to: params.to,
    sort: (params.sort as "newest" | "oldest" | "highest" | "lowest") || "newest",
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/orders?${query.toString()}`;
  };

  const activeFilter = params.status ?? params.payment ?? "";

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Orders"
        description={`${total.toLocaleString("en-US")} order${total === 1 ? "" : "s"} match the current filters.`}
      />

      <nav aria-label="Quick filters" className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => {
          const value = new URL(filter.href, "http://x").searchParams;
          const isActive =
            (value.get("status") ?? value.get("payment") ?? "") === activeFilter;
          return (
            <Link
              key={filter.label}
              href={filter.href}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "inline-flex h-9 items-center rounded-control border border-taraWine bg-taraWine px-3 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory"
                  : "inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <form method="get" action="/admin/orders">
        <Toolbar>
          <Field label="Search" htmlFor="order-search" className="min-w-[220px] flex-1">
            <input
              id="order-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Order number, name, phone or email"
              className={adminInputClass}
            />
          </Field>
          <Field label="Status" htmlFor="order-status" className="min-w-[150px]">
            <select
              id="order-status"
              name="status"
              defaultValue={params.status ?? ""}
              className={adminInputClass}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment" htmlFor="order-payment" className="min-w-[150px]">
            <select
              id="order-payment"
              name="payment"
              defaultValue={params.payment ?? ""}
              className={adminInputClass}
            >
              <option value="">All payments</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From" htmlFor="order-from" className="min-w-[140px]">
            <input
              id="order-from"
              name="from"
              type="date"
              max={storeDateInputValue(new Date())}
              defaultValue={params.from ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field label="To" htmlFor="order-to" className="min-w-[140px]">
            <input
              id="order-to"
              name="to"
              type="date"
              max={storeDateInputValue(new Date())}
              defaultValue={params.to ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field label="Sort" htmlFor="order-sort" className="min-w-[150px]">
            <select
              id="order-sort"
              name="sort"
              defaultValue={params.sort ?? "newest"}
              className={adminInputClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest value</option>
              <option value="lowest">Lowest value</option>
            </select>
          </Field>
          <div className="flex items-center gap-2 pb-[1px]">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:bg-taraBlack hover:border-taraBlack"
            >
              Apply
            </button>
            <Link
              href="/admin/orders"
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
            title="No orders match those filters"
            description="Try widening the date range, clearing the search, or resetting the filters."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Fulfilment</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Placed</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-taraIvory/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold text-taraWine underline-offset-4 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                      {order.risk_flags.includes("repeat_cancellations") && (
                        <span className="mt-1 block font-sans text-[11px] font-semibold uppercase tracking-wide text-[#8A6A1F]">
                          Repeat cancellations
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="block">{order.customer_name}</span>
                      <span className="block font-sans text-xs text-muted">
                        {formatBdPhone(order.customer_phone)}
                      </span>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={order.payment_status} />
                    </Td>
                    <Td align="right" className="font-semibold">
                      {formatTaka(order.total)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(order.created_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
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
