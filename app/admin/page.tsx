import Link from "next/link";
import { getDashboardMetrics } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import type { Permission } from "@/lib/permissions";
import { Boxes, ClipboardList, Mail, PackagePlus, Percent, Star } from "lucide-react";
import { formatDateTime, formatNumber, formatTaka, formatTakaCompact } from "@/lib/format";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLinkButton,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
  type BadgeTone,
} from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge, StockBadge } from "@/components/admin/status";
import type { OrderStatus } from "@/types/database";
import { formatSizeLabel } from "@/lib/product-size";

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
        <PageHeader eyebrow="Home" title="Dashboard" />
        <AdminErrorState
          title="Dashboard data is unavailable"
          description="The store metrics could not be loaded. Check that the database migrations in supabase/migrations have been applied, then refresh."
        />
      </>
    );
  }

  const status = (key: OrderStatus) => metrics.statusCounts[key] ?? 0;
  const can = (permission: Permission) => staff.permissions.includes(permission);

  /*
   * What is waiting, filtered by what this role can act on. Each tile links to
   * the list that fixes it; a count this person cannot do anything about is
   * noise on the first screen of their day.
   */
  const attention: Parameters<typeof StatTile>[0][] = [
    ...(can("orders.view")
      ? [
          {
            label: "Pending orders",
            value: formatNumber(status("pending")),
            hint: "Waiting to be confirmed",
            href: "/admin/orders?status=pending",
            tone: (status("pending") > 0 ? "warning" : "neutral") as BadgeTone,
          },
        ]
      : []),
    ...(can("inventory.adjust")
      ? [
          {
            label: "Out of stock",
            value: formatNumber(metrics.outOfStockVariants),
            hint: "Active variants with zero stock",
            href: "/admin/inventory?state=out",
            tone: (metrics.outOfStockVariants > 0 ? "danger" : "neutral") as BadgeTone,
          },
          {
            label: "Low stock",
            value: formatNumber(metrics.lowStockVariants),
            hint: "At or below threshold",
            href: "/admin/inventory?state=low",
            tone: (metrics.lowStockVariants > 0 ? "warning" : "neutral") as BadgeTone,
          },
        ]
      : []),
    ...(can("messages.manage")
      ? [
          {
            label: "Unread messages",
            value: formatNumber(metrics.unreadMessages),
            hint: "From the contact form",
            href: "/admin/messages?status=new",
            tone: (metrics.unreadMessages > 0 ? "warning" : "neutral") as BadgeTone,
          },
        ]
      : []),
    ...(can("reviews.moderate")
      ? [
          {
            label: "Reviews to moderate",
            value: formatNumber(metrics.pendingReviews),
            hint: "Not shown until approved",
            href: "/admin/reviews?status=pending",
            tone: (metrics.pendingReviews > 0 ? "warning" : "neutral") as BadgeTone,
          },
        ]
      : []),
  ];

  const needsAttention =
    (can("orders.view") ? status("pending") : 0) +
    (can("inventory.adjust") ? metrics.lowStockVariants : 0) +
    (can("reviews.moderate") ? metrics.pendingReviews : 0) +
    (can("messages.manage") ? metrics.unreadMessages : 0);

  /** The everyday jobs, for the permissions this person holds. */
  const quickActions = [
    { href: "/admin/products/new", label: "Add product", icon: PackagePlus, permission: "catalogue.manage", primary: true },
    { href: "/admin/orders?status=pending", label: "Pending orders", icon: ClipboardList, permission: "orders.view" },
    { href: "/admin/inventory?state=low", label: "Low stock", icon: Boxes, permission: "inventory.adjust" },
    { href: "/admin/messages?status=new", label: "Messages", icon: Mail, permission: "messages.manage" },
    { href: "/admin/reviews?status=pending", label: "Reviews", icon: Star, permission: "reviews.moderate" },
    { href: "/admin/coupons", label: "Create coupon", icon: Percent, permission: "coupons.manage" },
  ].filter((action) => can(action.permission as Permission));

  return (
    <>
      <PageHeader
        eyebrow="Home"
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

      {/* Needs attention — what is waiting on somebody, first. Only the tiles
          this role can act on: a support account is not shown stock it cannot
          adjust. */}
      {attention.length > 0 && (
        <section aria-labelledby="attention-heading" className="mb-6">
          <h2
            id="attention-heading"
            className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted"
          >
            Needs attention
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>
        </section>
      )}

      {/* Quick actions — the everyday jobs, one tap away, for this role only. */}
      {quickActions.length > 0 && (
        <section aria-labelledby="actions-heading" className="mb-6">
          <h2
            id="actions-heading"
            className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted"
          >
            Quick actions
          </h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <AdminLinkButton
                key={action.href}
                href={action.href}
                variant={action.primary ? "primary" : "secondary"}
              >
                <action.icon size={15} aria-hidden="true" />
                {action.label}
              </AdminLinkButton>
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      <section aria-labelledby="today-heading" className="mb-6">
        <h2
          id="today-heading"
          className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted"
        >
          Today
        </h2>
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
            href={can("customers.view") ? "/admin/customers" : undefined}
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
                can("inventory.adjust") ? (
                  <Link
                    href="/admin/inventory?state=low"
                    className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                  >
                    Manage
                  </Link>
                ) : undefined
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
                        {formatSizeLabel(variant.size)} · {variant.colour_en} · {variant.sku}
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
