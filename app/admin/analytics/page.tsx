import Link from "next/link";
import { getAnalytics } from "@/lib/supabase/queries/admin";
import { formatDate, formatNumber, formatPercent, formatTaka, formatTakaCompact } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
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
import type { OrderStatus } from "@/types/database";

const WINDOWS = [7, 30, 90, 365];

/**
 * A bar rendered from real values only. There is no synthetic data anywhere on
 * this page: if a period has no orders, it shows an empty state rather than a
 * decorative chart.
 */
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full rounded-sm bg-taraIvory"
      role="img"
      aria-label={label}
      title={label}
    >
      <div className="h-2 rounded-sm bg-taraWine" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const window = WINDOWS.includes(Number(days)) ? Number(days) : 30;
  const data = await getAnalytics(window);

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Analytics" />
        <AdminErrorState
          title="Analytics are unavailable"
          description="The analytics function could not be reached. Check that supabase/migrations/0002_production_hardening.sql has been applied."
        />
      </>
    );
  }

  const maxRevenue = Math.max(0, ...data.revenueTrend.map((point) => Number(point.revenue)));
  const maxProductUnits = Math.max(0, ...data.topProducts.map((product) => product.units));
  const maxCategoryRevenue = Math.max(
    0,
    ...data.topCategories.map((category) => Number(category.revenue)),
  );
  const totalRevenue = data.revenueTrend.reduce((sum, point) => sum + Number(point.revenue), 0);
  const totalOrders = data.revenueTrend.reduce((sum, point) => sum + point.orders, 0);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Analytics"
        description={`Every figure below is computed from real order data over the last ${window} days.`}
      />

      <nav aria-label="Time range" className="mb-5 flex flex-wrap gap-2">
        {WINDOWS.map((option) => {
          const isActive = option === window;
          return (
            <Link
              key={option}
              href={`/admin/analytics?days=${option}`}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "inline-flex h-9 items-center rounded-control border border-taraWine bg-taraWine px-3 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory"
                  : "inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
              }
            >
              {option === 365 ? "12 months" : `${option} days`}
            </Link>
          );
        })}
      </nav>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue"
          value={formatTakaCompact(totalRevenue)}
          hint={formatTaka(totalRevenue)}
          tone="success"
        />
        <StatTile label="Orders" value={formatNumber(totalOrders)} tone="info" />
        <StatTile
          label="Average order"
          value={formatTaka(data.averageOrderValue)}
          tone="neutral"
        />
        <StatTile
          label="Cash on delivery"
          value={formatPercent(data.codShare)}
          hint="Share of orders"
          tone="neutral"
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Cancellation rate"
          value={formatPercent(data.cancellationRate)}
          tone={Number(data.cancellationRate) > 10 ? "warning" : "neutral"}
          href="/admin/orders?status=cancelled"
        />
        <StatTile
          label="Return rate"
          value={formatPercent(data.returnRate)}
          tone={Number(data.returnRate) > 5 ? "warning" : "neutral"}
          href="/admin/orders?status=returned"
        />
        <StatTile
          label="New customers"
          value={formatNumber(
            data.customerGrowth.reduce((sum, point) => sum + point.customers, 0),
          )}
          href="/admin/customers"
        />
        <StatTile
          label="Coupon redemptions"
          value={formatNumber(
            data.couponPerformance.reduce((sum, coupon) => sum + coupon.redemptions, 0),
          )}
          href="/admin/coupons"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Revenue by day" description="Cancelled and returned orders excluded." />
          {data.revenueTrend.length === 0 ? (
            <AdminEmptyState
              title="No orders in this period"
              description="Try a longer time range."
            />
          ) : (
            <ul className="flex flex-col gap-2 px-5 py-5">
              {data.revenueTrend.map((point) => (
                <li key={point.day} className="grid grid-cols-[90px_1fr_auto] items-center gap-3">
                  <span className="font-sans text-xs text-muted">{formatDate(point.day)}</span>
                  <Bar
                    value={Number(point.revenue)}
                    max={maxRevenue}
                    label={`${formatDate(point.day)}: ${formatTaka(point.revenue)} from ${point.orders} orders`}
                  />
                  <span className="whitespace-nowrap font-sans text-xs font-semibold text-ink">
                    {formatTakaCompact(point.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Order status mix" />
          {Object.keys(data.statusDistribution).length === 0 ? (
            <AdminEmptyState title="No orders in this period" />
          ) : (
            <dl className="px-5 py-3">
              {Object.entries(data.statusDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <DetailRow
                    key={status}
                    label={ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
                  >
                    {formatNumber(count)}
                  </DetailRow>
                ))}
            </dl>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Top products" description="By units sold." />
          {data.topProducts.length === 0 ? (
            <AdminEmptyState title="No sales in this period" />
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-5">
              {data.topProducts.map((product) => (
                <li key={product.name} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-sans text-sm text-ink">
                      {product.name}
                    </span>
                    <span className="whitespace-nowrap font-sans text-xs text-muted">
                      {formatNumber(product.units)} units · {formatTakaCompact(product.revenue)}
                    </span>
                  </div>
                  <Bar
                    value={product.units}
                    max={maxProductUnits}
                    label={`${product.name}: ${product.units} units`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Top categories" description="By revenue." />
          {data.topCategories.length === 0 ? (
            <AdminEmptyState title="No sales in this period" />
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-5">
              {data.topCategories.map((category) => (
                <li key={category.name} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-sans text-sm text-ink">
                      {category.name}
                    </span>
                    <span className="whitespace-nowrap font-sans text-xs text-muted">
                      {formatTakaCompact(category.revenue)}
                    </span>
                  </div>
                  <Bar
                    value={Number(category.revenue)}
                    max={maxCategoryRevenue}
                    label={`${category.name}: ${formatTaka(category.revenue)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader title="Coupon performance" />
          {data.couponPerformance.length === 0 ? (
            <AdminEmptyState
              title="No coupons redeemed in this period"
              description="Create a promotion from the Coupons page to start tracking this."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th align="right">Redemptions</Th>
                  <Th align="right">Discount given</Th>
                  <Th align="right">Average discount</Th>
                </tr>
              </thead>
              <tbody>
                {data.couponPerformance.map((coupon) => (
                  <tr key={coupon.code}>
                    <Td className="font-mono text-sm font-semibold">{coupon.code}</Td>
                    <Td align="right">{formatNumber(coupon.redemptions)}</Td>
                    <Td align="right">{formatTaka(coupon.discount)}</Td>
                    <Td align="right">
                      {formatTaka(Number(coupon.discount) / Math.max(1, coupon.redemptions))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}
