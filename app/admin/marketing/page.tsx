import type { Metadata } from "next";
import { getMarketingAnalytics } from "@/lib/supabase/queries/marketing";
import { resolveRange } from "@/lib/analytics/range";
import { siteConfig } from "@/data/site";
import { formatNumber, formatTaka, formatTakaCompact } from "@/lib/format";
import { MarketingFilters } from "@/components/admin/MarketingFilters";
import { UtmLinkBuilder } from "@/components/admin/UtmLinkBuilder";
import {
  AdminEmptyState,
  AdminErrorState,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Marketing analytics",
  robots: { index: false, follow: false },
};

/**
 * Where visitors come from, and what they do next.
 *
 * Every figure is computed from TARA's own first-party events joined to TARA's
 * own orders. Nothing on this page comes from a third party, nothing is
 * sampled, and nothing is modelled: if it says eleven orders, eleven orders
 * exist in the orders table.
 *
 * THE ATTRIBUTION MODEL is stated on the page, not only in the code, because a
 * number whose definition is invisible is a number people quietly disagree
 * about. It is "last non-direct session, carried forward per visitor", it is
 * the same for every table here, and it is implemented once, in SQL.
 *
 * WHAT COUNTS AS REVENUE: an order that is not cancelled, not returned and not
 * archived, valued at its current total. An order cancelled tomorrow leaves
 * these figures tomorrow without anybody rewriting anything.
 */
export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    source?: string;
    campaign?: string;
    content?: string;
    creator?: string;
    product?: string;
  }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params);

  const filters = {
    from: range.from,
    to: range.to,
    source: params.source?.trim() || undefined,
    campaign: params.campaign?.trim() || undefined,
    content: params.content?.trim() || undefined,
    creator: params.creator?.trim() || undefined,
    productId: params.product?.trim() || undefined,
  };

  const data = await getMarketingAnalytics(filters);

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Marketing analytics" />
        <AdminErrorState
          title="Marketing analytics are unavailable"
          description="The analytics function could not be reached. Check that supabase/migrations/0026_launch_offer_and_first_party_analytics.sql has been applied."
        />
      </>
    );
  }

  const { summary, funnel } = data;
  const productOptions = data.products.map((product) => ({
    id: product.productId,
    name: product.name,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Marketing analytics"
        description="First-party, from TARA's own events and TARA's own orders. Attribution: last non-direct campaign, carried forward per visitor. Revenue excludes cancelled, returned and archived orders."
      />

      <MarketingFilters
        range={range}
        available={data.available}
        active={{
          source: filters.source,
          campaign: filters.campaign,
          content: filters.content,
          creator: filters.creator,
          productId: filters.productId,
        }}
        // The products that had any activity in this window — filtering by one
        // that had none would only ever produce an empty page.
        products={productOptions}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visitors" value={formatNumber(summary.visitors)} tone="info" />
        <StatTile
          label="Product views"
          value={formatNumber(summary.productViews)}
          hint={`${formatNumber(summary.sessions)} sessions`}
        />
        <StatTile label="Add to carts" value={formatNumber(summary.addToCarts)} />
        <StatTile label="Checkout starts" value={formatNumber(summary.checkoutStarts)} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders" value={formatNumber(summary.orders)} tone="success" />
        <StatTile
          label="Revenue"
          value={formatTakaCompact(summary.revenue)}
          hint={formatTaka(summary.revenue)}
          tone="success"
        />
        <StatTile
          label="Average order"
          value={formatTaka(summary.averageOrderValue)}
          hint="Revenue ÷ orders"
        />
        <StatTile
          label="Purchase conversion"
          value={`${summary.purchaseRate}%`}
          hint="Orders ÷ visitors"
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Add to cart rate"
          value={`${summary.addToCartRate}%`}
          hint="Visitors who added to cart ÷ visitors"
        />
        <StatTile
          label="Checkout rate"
          value={`${summary.checkoutRate}%`}
          hint="Visitors who began checkout ÷ visitors who added to cart"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Visitor journey"
            description="Distinct visitors at each stage, so every step is a share of the one above it."
          />
          {funnel.visitors === 0 ? (
            <AdminEmptyState
              title="No visitors in this period"
              description="Try a longer date range, or check that the storefront has been visited since the analytics migration was applied."
            />
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-5">
              <FunnelStage label="Visitors" value={funnel.visitors} top={funnel.visitors} />
              <FunnelStage
                label="Viewed a product"
                value={funnel.productViews}
                top={funnel.visitors}
                previous={funnel.visitors}
              />
              <FunnelStage
                label="Added to cart"
                value={funnel.addToCarts}
                top={funnel.visitors}
                previous={funnel.productViews}
              />
              <FunnelStage
                label="Started checkout"
                value={funnel.checkoutStarts}
                top={funnel.visitors}
                previous={funnel.addToCarts}
              />
              <FunnelStage
                label="Ordered"
                value={funnel.orders}
                top={funnel.visitors}
                previous={funnel.checkoutStarts}
              />
            </ul>
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Source performance"
            description="Where visitors came from, and what each source was worth."
          />
          {data.sources.length === 0 ? (
            <AdminEmptyState title="No traffic in this period" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th align="right">Visitors</Th>
                  <Th align="right">Product views</Th>
                  <Th align="right">Add to carts</Th>
                  <Th align="right">Checkouts</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">Conversion</Th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((row) => (
                  <tr key={row.source}>
                    <Td className="font-medium">{row.source}</Td>
                    <Td align="right">{formatNumber(row.visitors)}</Td>
                    <Td align="right">{formatNumber(row.productViews)}</Td>
                    <Td align="right">{formatNumber(row.addToCarts)}</Td>
                    <Td align="right">{formatNumber(row.checkoutStarts)}</Td>
                    <Td align="right">{formatNumber(row.orders)}</Td>
                    <Td align="right">{formatTaka(row.revenue)}</Td>
                    <Td align="right">{row.conversionRate}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Campaign performance" />
          {data.campaigns.length === 0 ? (
            <AdminEmptyState
              title="No campaigns in this period"
              description="Campaigns appear once links carrying utm_campaign are used."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Source</Th>
                  <Th align="right">Visitors</Th>
                  <Th align="right">Add to carts</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((row) => (
                  <tr key={`${row.campaign}-${row.source}`}>
                    <Td className="font-medium">{row.campaign}</Td>
                    <Td>{row.source}</Td>
                    <Td align="right">{formatNumber(row.visitors)}</Td>
                    <Td align="right">{formatNumber(row.addToCarts)}</Td>
                    <Td align="right">{formatNumber(row.orders)}</Td>
                    <Td align="right">{formatTaka(row.revenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Creator performance"
            description="Links posted as utm_source=creator, or content named creator_<name>_…"
          />
          {data.creators.length === 0 ? (
            <AdminEmptyState
              title="No creator traffic in this period"
              description="Build a creator link below to start measuring one."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Creator</Th>
                  <Th align="right">Visitors</Th>
                  <Th align="right">Product views</Th>
                  <Th align="right">Add to carts</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {data.creators.map((row) => (
                  <tr key={row.creator}>
                    <Td className="font-medium">{row.creator}</Td>
                    <Td align="right">{formatNumber(row.visitors)}</Td>
                    <Td align="right">{formatNumber(row.productViews)}</Td>
                    <Td align="right">{formatNumber(row.addToCarts)}</Td>
                    <Td align="right">{formatNumber(row.orders)}</Td>
                    <Td align="right">{formatTaka(row.revenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Content performance"
            description="Individual posts and reels, from utm_content."
          />
          {data.content.length === 0 ? (
            <AdminEmptyState
              title="No tagged content in this period"
              description="Give each post its own utm_content and two reels become comparable."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Content</Th>
                  <Th>Source</Th>
                  <Th>Campaign</Th>
                  <Th align="right">Visitors</Th>
                  <Th align="right">Add to carts</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((row) => (
                  <tr key={`${row.content}-${row.source}`}>
                    <Td className="font-mono text-xs font-medium">{row.content}</Td>
                    <Td>{row.source}</Td>
                    <Td>{row.campaign}</Td>
                    <Td align="right">{formatNumber(row.visitors)}</Td>
                    <Td align="right">{formatNumber(row.addToCarts)}</Td>
                    <Td align="right">{formatNumber(row.orders)}</Td>
                    <Td align="right">{formatTaka(row.revenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Product performance"
            description="Add to cart rate is visitors who added ÷ visitors who viewed. Revenue is this product's own order lines."
          />
          {data.products.length === 0 ? (
            <AdminEmptyState title="No product activity in this period" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th align="right">Views</Th>
                  <Th align="right">Add to carts</Th>
                  <Th align="right">Add to cart rate</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">Conversion</Th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((row) => (
                  <tr key={row.productId}>
                    <Td className="font-medium">{row.name}</Td>
                    <Td align="right">{formatNumber(row.productViews)}</Td>
                    <Td align="right">{formatNumber(row.addToCarts)}</Td>
                    <Td align="right">{row.addToCartRate}%</Td>
                    <Td align="right">{formatNumber(row.orders)}</Td>
                    <Td align="right">{formatTaka(row.revenue)}</Td>
                    <Td align="right">{row.conversionRate}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>

      <div className="mt-5">
        <UtmLinkBuilder siteUrl={siteConfig.url} />
      </div>
    </>
  );
}

/** One stage of the funnel: a bar, the count, and the drop from the stage above. */
function FunnelStage({
  label,
  value,
  top,
  previous,
}: {
  label: string;
  value: number;
  top: number;
  previous?: number;
}) {
  const width = top > 0 ? Math.max(2, Math.round((value / top) * 100)) : 0;
  const share = previous && previous > 0 ? Math.round((value / previous) * 100) : null;

  return (
    <li className="grid grid-cols-[130px_1fr_auto] items-center gap-3 sm:grid-cols-[170px_1fr_auto]">
      <span className="font-sans text-xs text-muted">{label}</span>
      <div
        className="h-2.5 w-full rounded-sm bg-taraIvory"
        role="img"
        aria-label={`${label}: ${value}${share === null ? "" : `, ${share}% of the previous stage`}`}
      >
        <div className="h-2.5 rounded-sm bg-taraWine" style={{ width: `${width}%` }} />
      </div>
      <span className="whitespace-nowrap font-sans text-xs font-semibold text-ink">
        {formatNumber(value)}
        {share !== null && <span className="ml-1.5 font-normal text-muted">{share}%</span>}
      </span>
    </li>
  );
}
