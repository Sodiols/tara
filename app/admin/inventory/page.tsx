import Link from "next/link";
import Image from "next/image";
import { getInventory, getTaxonomyOptions, parsePage } from "@/lib/supabase/queries/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
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
import { StockBadge } from "@/components/admin/status";
import { formatSizeLabel } from "@/lib/product-size";
import { InventoryAdjuster } from "@/components/admin/InventoryAdjuster";

type SearchParams = {
  page?: string;
  q?: string;
  state?: string;
  category?: string;
};

const STATES = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "in", label: "In stock" },
];

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const state = (params.state as "all" | "low" | "out" | "in") ?? "all";

  const supabase = await createClient();
  const [{ rows, total, pageSize }, { categories }] = await Promise.all([
    getInventory({ page, search: params.q, state, categoryId: params.category }),
    getTaxonomyOptions(),
  ]);

  // Headline counters come straight from the database rather than from the
  // current page of results, so they stay correct while filtering.
  const [outOfStockCount, activeVariantCount] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("stock_quantity", 0)
      .then((result) => result.count ?? 0),
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .then((result) => result.count ?? 0),
  ]);

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/inventory?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Inventory"
        description={`${activeVariantCount.toLocaleString("en-US")} active variants · ${outOfStockCount.toLocaleString("en-US")} out of stock. Every stock change is recorded with a reason and an audit entry.`}
      />

      <nav aria-label="Stock filters" className="mb-4 flex flex-wrap gap-2">
        {STATES.map((option) => {
          const isActive = state === option.value;
          return (
            <Link
              key={option.value}
              href={
                option.value === "all"
                  ? "/admin/inventory"
                  : `/admin/inventory?state=${option.value}`
              }
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
      </nav>

      <form method="get" action="/admin/inventory">
        <Toolbar>
          <input type="hidden" name="state" value={state} />
          <Field label="Search" htmlFor="inventory-search" className="min-w-[220px] flex-1">
            <input
              id="inventory-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="SKU or colour"
              className={adminInputClass}
            />
          </Field>
          <Field label="Category" htmlFor="inventory-category" className="min-w-[190px]">
            <select
              id="inventory-category"
              name="category"
              defaultValue={params.category ?? ""}
              className={adminInputClass}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-2 pb-[1px]">
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
            >
              Apply
            </button>
            <Link
              href="/admin/inventory"
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
            title={state === "low" ? "No low-stock variants" : "No variants match those filters"}
            description={
              state === "low"
                ? "Every active variant is comfortably above its threshold."
                : "Add variants from a product page, or widen the filters."
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Variant</Th>
                  <Th>SKU</Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">Threshold</Th>
                  <Th>State</Th>
                  <Th align="right">Updated</Th>
                  <Th align="right">Adjust</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((variant) => {
                  const image = variant.products?.product_images?.[0]?.image_url;
                  return (
                    <tr key={variant.id} className="align-top transition-colors hover:bg-taraIvory/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          {image ? (
                            <Image
                              src={image}
                              alt=""
                              width={36}
                              height={46}
                              className="h-[46px] w-9 shrink-0 rounded-sm object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="h-[46px] w-9 shrink-0 rounded-sm bg-taraIvory"
                            />
                          )}
                          <Link
                            href={`/admin/products/${variant.product_id}`}
                            className="min-w-0 truncate font-medium text-taraWine underline-offset-4 hover:underline"
                          >
                            {variant.products?.name_en ?? "Product"}
                          </Link>
                        </div>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: variant.colour_hex }}
                          />
                          {formatSizeLabel(variant.size)} · {variant.colour_en}
                        </span>
                      </Td>
                      <Td className="font-mono text-xs">{variant.sku}</Td>
                      <Td align="right" className="text-base font-semibold">
                        {variant.stock_quantity}
                      </Td>
                      <Td align="right" className="text-muted">
                        {variant.low_stock_threshold}
                      </Td>
                      <Td>
                        <StockBadge
                          stock={variant.stock_quantity}
                          threshold={variant.low_stock_threshold}
                        />
                      </Td>
                      <Td align="right" className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(variant.updated_at)}
                      </Td>
                      <Td align="right">
                        <InventoryAdjuster
                          variantId={variant.id}
                          sku={variant.sku}
                          currentStock={variant.stock_quantity}
                          label={`${variant.products?.name_en ?? "Product"} — ${formatSizeLabel(variant.size)} / ${variant.colour_en}`}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            {state !== "low" && (
              <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
            )}
          </>
        )}
      </Panel>
    </>
  );
}
