import Link from "next/link";
import { getDashboardMetrics } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { formatDateTime, formatNumber, formatTaka, formatTakaCompact } from "@/lib/format";
import {
  AdminEmptyState,
  AdminErrorState,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge, StockBadge } from "@/components/admin/status";
import type { OrderStatus } from "@/types/database";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [{ denied }, staff, metrics] = await Promise.all([
    searchParams,
    requireStaff(),
    getDashboardMetrics(),
  ]);

  if (!metrics) {
    return (
      <>
        <PageHeader eyebrow="TARA Operations" title="Dashboard" />
        <AdminErrorState
          title="Dashboard data is unavailable"
          description="The store metrics could not be loaded. Check that the database migrations in supabase/migrations have been applied, then refresh."
        />
      </>
    );
  }

  const status = (key: OrderStatus) => metrics.statusCounts[key] ?? 0;
  const needsAttention =
    status("pending") + metrics.lowStockVariants + metrics.pendingReviews + metrics.unreadMessages;

  return (
    <>
      <PageHeader
        eyebrow="TARA Operations"
        title={`Good to see you, ${staff.name.split(" ")[0]}`}
        description={
          needsAttention > 0
            ? `${needsAttention} item${needsAttention === 1 ? "" : "s"} need attention today.`
            : "Nothing is waiting on you right now."
        }
      />

      {denied && (
        <div className="mb-6">
          <AdminErrorState
            title="You do not have access to that section"
            description={`Your role does not include the "${denied}" permission. Ask an administrator if you need it.`}
          />
        </div>
      )}

      {/* Today */}
      <section aria-label="Today" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Orders today"
            value={formatNumber(metrics.todayOrders)}
            hint="Excludes cancelled"
            href="/admin/orders?sort=newest"
            tone="info"
          />
          <StatTile
            label="Revenue today"
            value={formatTakaCompact(metrics.todayRevenue)}
            hint={formatTaka(metrics.todayRevenue)}
            tone="success"
          />
          <StatTile
            label="Total revenue"
            value={formatTakaCompact(metrics.totalRevenue)}
            hint={`Average order ${formatTaka(metrics.averageOrderValue)}`}
            tone="success"
          />
          <StatTile
            label="Customers"
            value={formatNumber(metrics.totalCustomers)}
            hint={`${formatNumber(metrics.newCustomersThisWeek)} new this week`}
            href="/admin/customers"
          />
        </div>
      </section>

      {/* Needs attention */}
      <section aria-label="Needs attention" className="mb-6">
        <h2 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Needs attention
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Pending orders"
            value={formatNumber(status("pending"))}
            hint="Waiting to be confirmed"
            href="/admin/orders?status=pending"
            tone={status("pending") > 0 ? "warning" : "neutral"}
          />
          <StatTile
            label="Out of stock"
            value={formatNumber(metrics.outOfStockVariants)}
            hint="Active variants with zero stock"
            href="/admin/inventory?state=out"
            tone={metrics.outOfStockVariants > 0 ? "danger" : "neutral"}
          />
          <StatTile
            label="Low stock"
            value={formatNumber(metrics.lowStockVariants)}
            hint="At or below threshold"
            href="/admin/inventory?state=low"
            tone={metrics.lowStockVariants > 0 ? "warning" : "neutral"}
          />
          <StatTile
            label="Unread messages"
            value={formatNumber(metrics.unreadMessages)}
            hint={`${formatNumber(metrics.pendingReviews)} reviews awaiting moderation`}
            href="/admin/messages?status=new"
            tone={metrics.unreadMessages > 0 ? "warning" : "neutral"}
          />
        </div>
      </section>

      {/* Fulfilment pipeline */}
      <section aria-label="Fulfilment pipeline" className="mb-6">
        <h2 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Fulfilment pipeline
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {(
            [
              "pending",
              "confirmed",
              "processing",
              "packed",
              "shipped",
              "delivered",
              "cancelled",
              "returned",
            ] as OrderStatus[]
          ).map((key) => (
            <StatTile
              key={key}
              label={key}
              value={formatNumber(status(key))}
              href={`/admin/orders?status=${key}`}
              tone={
                key === "cancelled" || key === "returned"
                  ? "danger"
                  : key === "delivered"
                    ? "success"
                    : "neutral"
              }
            />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* Recent orders */}
        <Panel>
          <PanelHeader
            title="Recent orders"
            actions={
              <Link
                href="/admin/orders"
                className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
              >
                View all
              </Link>
            }
          />
          {metrics.recentOrders.length === 0 ? (
            <AdminEmptyState
              title="No orders yet"
              description="Orders placed on the storefront will appear here the moment they arrive."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-taraIvory/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold text-taraWine underline-offset-4 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {formatDateTime(order.created_at)}
                      </span>
                    </Td>
                    <Td>{order.customer_name}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={order.payment_status} />
                    </Td>
                    <Td align="right" className="font-semibold">
                      {formatTaka(order.total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          {/* Inventory attention */}
          <Panel>
            <PanelHeader
              title="Inventory to watch"
              actions={
                <Link
                  href="/admin/inventory?state=low"
                  className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                >
                  Manage
                </Link>
              }
            />
            {metrics.attentionInventory.length === 0 ? (
              <AdminEmptyState
                title="Stock levels are healthy"
                description="No active variant is at or below its low-stock threshold."
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {metrics.attentionInventory.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${variant.product_id}`}
                        className="block truncate font-sans text-sm text-ink underline-offset-4 hover:text-taraWine hover:underline"
                      >
                        {variant.product_name}
                      </Link>
                      <p className="truncate font-sans text-xs text-muted">
                        {variant.size} · {variant.colour_en} · {variant.sku}
                      </p>
                    </div>
                    <StockBadge
                      stock={variant.stock_quantity}
                      threshold={variant.low_stock_threshold}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Top products */}
          <Panel>
            <PanelHeader title="Best selling" description="By units sold, all time" />
            {metrics.topProducts.length === 0 ? (
              <AdminEmptyState title="No sales data yet" />
            ) : (
              <dl className="px-5 py-3">
                {metrics.topProducts.map((product) => (
                  <DetailRow key={product.product_id} label={product.name}>
                    <span className="font-semibold">{formatNumber(product.units)}</span>
                    <span className="ml-2 text-xs text-muted">
                      {formatTakaCompact(product.revenue)}
                    </span>
                  </DetailRow>
                ))}
              </dl>
            )}
          </Panel>

          {/* Catalogue snapshot */}
          <Panel>
            <PanelHeader title="Catalogue" />
            <dl className="px-5 py-3">
              <DetailRow label="Active products">{formatNumber(metrics.activeProducts)}</DetailRow>
              <DetailRow label="Drafts">{formatNumber(metrics.draftProducts)}</DetailRow>
              <DetailRow label="Active coupons">{formatNumber(metrics.activeCoupons)}</DetailRow>
              <DetailRow label="Discount given">
                {formatTaka(metrics.couponDiscountTotal)}
              </DetailRow>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
