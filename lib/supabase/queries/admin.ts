import "server-only";

import { createClient } from "../server";
import { requirePermission, requireStaff } from "../auth";
import { isAppRole } from "@/lib/permissions";
import type {
  MessageStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ReviewStatus,
  Tables,
} from "@/types/database";

/**
 * Admin read layer.
 *
 * Every list is server-paginated with an exact count. Nothing here does an
 * unbounded `select("*")` — a store with 20,000 orders must not try to render
 * them all in one table, and an admin page must not become the slowest query in
 * the database.
 *
 * These run with the signed-in staff member's own session, so RLS applies on
 * top of the explicit permission check.
 */

export const DEFAULT_PAGE_SIZE = 25;

export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

function range(page: number, pageSize: number): [number, number] {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/**
 * PostgREST treats `,` `.` `(` `)` as operator syntax inside `or(...)`, so a
 * search term containing them could otherwise change the shape of the filter.
 */
function escapeFilterValue(term: string): string {
  return term.replace(/[,.()\\"']/g, " ").trim();
}

// --- Dashboard -------------------------------------------------------------

export interface DashboardMetrics {
  todayOrders: number;
  todayRevenue: number;
  totalRevenue: number;
  statusCounts: Partial<Record<OrderStatus, number>>;
  totalCustomers: number;
  newCustomersThisWeek: number;
  activeProducts: number;
  draftProducts: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  pendingReviews: number;
  unreadMessages: number;
  activeCoupons: number;
  couponDiscountTotal: number;
  averageOrderValue: number;
  recentOrders: {
    id: string;
    order_number: string;
    customer_name: string;
    status: OrderStatus;
    payment_status: PaymentStatus;
    total: number;
    created_at: string;
  }[];
  recentCustomers: { id: string; full_name: string; email: string; created_at: string }[];
  topProducts: { product_id: string; name: string; units: number; revenue: number }[];
  attentionInventory: {
    id: string;
    sku: string;
    size: string;
    colour_en: string;
    stock_quantity: number;
    low_stock_threshold: number;
    product_name: string;
    product_id: string;
  }[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  await requirePermission("orders.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_metrics");
  if (error || !data) return null;
  return data as unknown as DashboardMetrics;
}

export async function getAnalytics(days: number) {
  await requirePermission("analytics.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
  if (error || !data) return null;
  return data as unknown as {
    windowDays: number;
    revenueTrend: { day: string; orders: number; revenue: number }[];
    averageOrderValue: number;
    statusDistribution: Record<string, number>;
    topProducts: { name: string; units: number; revenue: number }[];
    topCategories: { name: string; units: number; revenue: number }[];
    customerGrowth: { day: string; customers: number }[];
    couponPerformance: { code: string; redemptions: number; discount: number }[];
    cancellationRate: number;
    returnRate: number;
    codShare: number;
  };
}

// --- Orders ----------------------------------------------------------------

export interface OrderFilters {
  page?: number;
  search?: string;
  status?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "highest" | "lowest";
}

export async function getAdminOrders(
  filters: OrderFilters,
): Promise<PagedResult<Tables<"orders">>> {
  await requirePermission("orders.view");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("orders").select("*", { count: "exact" });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    query = query.eq("payment_status", filters.paymentStatus);
  }
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+06:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59+06:00`);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or(
      [
        `order_number.ilike.*${term}*`,
        `customer_name.ilike.*${term}*`,
        `customer_phone.ilike.*${term}*`,
        `normalized_phone.ilike.*${term}*`,
        `customer_email.ilike.*${term}*`,
      ].join(","),
    );
  }

  switch (filters.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "highest":
      query = query.order("total", { ascending: false });
      break;
    case "lowest":
      query = query.order("total", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count } = await query.range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getAdminOrderDetail(orderId: string) {
  await requirePermission("orders.view");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const [items, events, notes, adjustments, redemption] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    supabase
      .from("order_tracking_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_internal_notes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_adjustments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("coupon_redemptions")
      .select("discount_amount,coupon_id")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);

  let couponCode: string | null = null;
  if (redemption.data?.coupon_id) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("code")
      .eq("id", redemption.data.coupon_id)
      .maybeSingle();
    couponCode = coupon?.code ?? null;
  }

  return {
    order,
    items: items.data ?? [],
    events: events.data ?? [],
    notes: notes.data ?? [],
    adjustments: adjustments.data ?? [],
    couponCode,
  };
}

/** Minimal, print-safe projection used by the invoice and packing slip. */
export async function getOrderForPrint(orderId: string) {
  await requirePermission("orders.view");
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");
  return { order, items: items ?? [] };
}

// --- Products --------------------------------------------------------------

export interface ProductFilters {
  page?: number;
  search?: string;
  status?: ProductStatus | "all";
  categoryId?: string;
}

export async function getAdminProducts(filters: ProductFilters) {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("products")
    .select("*, categories(name_en), product_variants(id,stock_quantity,low_stock_threshold)", {
      count: "exact",
    });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or(
      [`name_en.ilike.*${term}*`, `product_code.ilike.*${term}*`, `slug.ilike.*${term}*`].join(","),
    );
  }

  const { data, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  type Row = Tables<"products"> & {
    categories: { name_en: string } | null;
    product_variants: { id: string; stock_quantity: number; low_stock_threshold: number }[];
  };

  return {
    rows: (data ?? []) as unknown as Row[],
    total: count ?? 0,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function getProductEditorData(productId: string) {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();
  const [product, categories, collections, variants, images] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("categories").select("id,name_en").order("sort_order"),
    supabase.from("collections").select("id,name_en").order("sort_order"),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("size")
      .order("colour_en"),
    supabase.from("product_images").select("*").eq("product_id", productId).order("sort_order"),
  ]);

  if (!product.data) return null;
  return {
    product: product.data,
    categories: categories.data ?? [],
    collections: collections.data ?? [],
    variants: variants.data ?? [],
    images: images.data ?? [],
  };
}

export async function getTaxonomyOptions() {
  // Category and collection names are public catalogue data, so this is not a
  // disclosure risk — but every other reader in this module states the access
  // it needs, and a back-office helper should not be the one exception.
  await requireStaff();
  const supabase = await createClient();
  const [categories, collections] = await Promise.all([
    supabase.from("categories").select("id,name_en").order("sort_order"),
    supabase.from("collections").select("id,name_en").order("sort_order"),
  ]);
  return { categories: categories.data ?? [], collections: collections.data ?? [] };
}

// --- Inventory -------------------------------------------------------------

export interface InventoryFilters {
  page?: number;
  search?: string;
  state?: "all" | "low" | "out" | "in";
  categoryId?: string;
}

export interface InventoryRow {
  id: string;
  sku: string;
  size: string;
  colour_en: string;
  colour_hex: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  product_id: string;
  products: {
    id: string;
    name_en: string;
    slug: string;
    category_id: string;
    product_images: { image_url: string }[];
  } | null;
}

export async function getInventory(filters: InventoryFilters) {
  await requirePermission("inventory.adjust");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("product_variants")
    .select(
      "id,sku,size,colour_en,colour_hex,stock_quantity,low_stock_threshold,is_active,updated_at,product_id," +
        "products!inner(id,name_en,slug,category_id,product_images(image_url))",
      { count: "exact" },
    );

  if (filters.state === "out") query = query.eq("stock_quantity", 0);
  if (filters.state === "in") query = query.gt("stock_quantity", 0);
  if (filters.categoryId) query = query.eq("products.category_id", filters.categoryId);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) query = query.or([`sku.ilike.*${term}*`, `colour_en.ilike.*${term}*`].join(","));

  const { data, count } = await query
    .order("stock_quantity", { ascending: true })
    .range(from, to);

  let rows = (data ?? []) as unknown as InventoryRow[];

  // "Low stock" compares two columns, which PostgREST cannot express as a
  // filter, so it is applied after the fetch. The page size is bounded, so this
  // stays cheap; the count reflects the pre-filter total and is corrected below.
  if (filters.state === "low") {
    rows = rows.filter(
      (row) => row.stock_quantity > 0 && row.stock_quantity <= row.low_stock_threshold,
    );
  }

  return {
    rows,
    total: filters.state === "low" ? rows.length : count ?? 0,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

// --- Customers -------------------------------------------------------------

export async function getAdminCustomers(filters: { page?: number; search?: string; role?: string }) {
  await requirePermission("customers.view");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (filters.role && filters.role !== "all" && isAppRole(filters.role)) {
    query = query.eq("role", filters.role);
  }

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or(
      [`full_name.ilike.*${term}*`, `email.ilike.*${term}*`, `phone.ilike.*${term}*`].join(","),
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getCustomerDetail(profileId: string) {
  await requirePermission("customers.view");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return null;

  const [orders, summary] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_number,status,payment_status,total,created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("admin_customer_summary", { p_profile_id: profileId }),
  ]);

  return {
    profile,
    orders: orders.data ?? [],
    summary: (summary.data ?? {
      totalOrders: 0,
      totalSpend: 0,
      lastOrderAt: null,
      cancelledOrders: 0,
    }) as unknown as {
      totalOrders: number;
      totalSpend: number;
      lastOrderAt: string | null;
      cancelledOrders: number;
    },
  };
}

export async function getStaffList() {
  await requirePermission("staff.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,role,is_active,created_at,last_seen_at")
    .neq("role", "customer")
    .order("created_at", { ascending: true });
  return data ?? [];
}

// --- Coupons, reviews, messages, newsletter, audit -------------------------

export async function getAdminCoupons(filters: { page?: number; search?: string; state?: string }) {
  await requirePermission("coupons.manage");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("coupons").select("*", { count: "exact" });
  if (filters.state === "active") {
    query = query.eq("is_active", true).is("archived_at", null);
  }
  if (filters.state === "archived") query = query.not("archived_at", "is", null);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) query = query.ilike("code", `%${term}%`);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getAdminReviews(filters: {
  page?: number;
  search?: string;
  status?: ReviewStatus | "all";
}) {
  await requirePermission("reviews.moderate");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase
    .from("reviews")
    .select("*, products(name_en,slug)", { count: "exact" });
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or([`author_name.ilike.*${term}*`, `comment_en.ilike.*${term}*`].join(","));
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  type Row = Tables<"reviews"> & { products: { name_en: string; slug: string } | null };
  return {
    rows: (data ?? []) as unknown as Row[],
    total: count ?? 0,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function getAdminMessages(filters: {
  page?: number;
  search?: string;
  status?: MessageStatus | "all";
}) {
  await requirePermission("messages.manage");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("contact_messages").select("*", { count: "exact" });
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or(
      [`name.ilike.*${term}*`, `email.ilike.*${term}*`, `message.ilike.*${term}*`].join(","),
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getNewsletterSubscribers(filters: {
  page?: number;
  search?: string;
  state?: "all" | "active" | "unsubscribed";
}) {
  await requirePermission("newsletter.manage");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("newsletter_subscribers").select("*", { count: "exact" });
  if (filters.state === "active") query = query.eq("is_active", true);
  if (filters.state === "unsubscribed") query = query.eq("is_active", false);

  const term = escapeFilterValue(filters.search ?? "");
  if (term) query = query.ilike("email", `%${term}%`);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getAuditLog(filters: {
  page?: number;
  search?: string;
  entityType?: string;
}) {
  await requirePermission("audit.view");
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = range(page, DEFAULT_PAGE_SIZE);

  let query = supabase.from("admin_audit_log").select("*", { count: "exact" });
  if (filters.entityType && filters.entityType !== "all") {
    query = query.eq("entity_type", filters.entityType);
  }

  const term = escapeFilterValue(filters.search ?? "");
  if (term) {
    query = query.or(
      [`actor_email.ilike.*${term}*`, `action.ilike.*${term}*`, `entity_label.ilike.*${term}*`].join(","),
    );
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getAdminSettings() {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("*").order("key");
  const map = new Map<string, unknown>();
  for (const row of data ?? []) map.set(row.key, row.value);
  return { rows: data ?? [], value: (key: string) => map.get(key) };
}

export async function getNotificationOutbox(limit = 20) {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
