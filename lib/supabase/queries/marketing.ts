import "server-only";

import { createClient } from "../server";
import { requirePermission } from "../auth";
import { logFailure } from "@/lib/logger";

/**
 * The marketing dashboard's one read.
 *
 * Everything /admin/marketing shows comes from a single call to
 * `admin_marketing_analytics()`, which requires `analytics.view` inside the
 * database — so a customer, a fulfilment account or an unauthenticated request
 * gets nothing regardless of what the application does. The tables themselves
 * are unreadable without that permission too (row level security, migration
 * 0026); this function is not the gate, it is the convenience.
 *
 * ATTRIBUTION: last non-direct session, carried forward per visitor. The rule
 * is expressed once, in SQL, and documented at the top of the migration and in
 * docs/MARKETING.md. Nothing in TypeScript re-attributes anything.
 */

export interface MarketingFilters {
  from: Date;
  to: Date;
  source?: string;
  campaign?: string;
  content?: string;
  creator?: string;
  productId?: string;
}

export interface MarketingSummary {
  visitors: number;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
  addToCartRate: number;
  checkoutRate: number;
  purchaseRate: number;
  averageOrderValue: number;
}

export interface MarketingFunnel {
  visitors: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
}

export interface SourceRow {
  source: string;
  visitors: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface CampaignRow {
  campaign: string;
  source: string;
  visitors: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface ContentRow {
  content: string;
  source: string;
  campaign: string;
  visitors: number;
  addToCarts: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface CreatorRow {
  creator: string;
  visitors: number;
  productViews: number;
  addToCarts: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface ProductRow {
  productId: string;
  name: string;
  slug: string;
  productViews: number;
  addToCarts: number;
  addToCartRate: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface MarketingAnalytics {
  from: string;
  to: string;
  attributionModel: string;
  summary: MarketingSummary;
  funnel: MarketingFunnel;
  sources: SourceRow[];
  campaigns: CampaignRow[];
  content: ContentRow[];
  creators: CreatorRow[];
  products: ProductRow[];
  available: { sources: string[]; campaigns: string[]; content: string[] };
}

export async function getMarketingAnalytics(
  filters: MarketingFilters,
): Promise<MarketingAnalytics | null> {
  await requirePermission("analytics.view");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_marketing_analytics", {
    p_filters: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      source: filters.source ?? null,
      campaign: filters.campaign ?? null,
      content: filters.content ?? null,
      creator: filters.creator ?? null,
      productId: filters.productId ?? null,
    },
  });

  if (error || !data) {
    // Null renders an explanatory empty state rather than a broken page: the
    // most likely cause is the migration not having been applied yet.
    if (error) logFailure("marketing.analytics_unavailable", error);
    return null;
  }

  return data as unknown as MarketingAnalytics;
}
