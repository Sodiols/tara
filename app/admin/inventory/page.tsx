import Link from "next/link";
import Image from "next/image";
import { getInventory, getTaxonomyOptions, parsePage } from "@/lib/supabase/queries/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminQuickFilters,
  AdminSearchInput,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
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
        eyebrow="Catalogue"
        title="Inventory"
        description={`${activeVariantCount.toLocaleString("en-US")} active variants · ${outOfStockCount.toLocaleString("en-US")} out of stock. Every change is made through Adjust, with a reason, and recorded.`}
      />

      <AdminQuickFilters
        label="Stock filters"
        items={STATES.map((option) => ({
          label: option.label,
          href: option.value === "all" ? "/admin/inventory" : `/admin/inventory?state=${option.value}`,
          active: state === option.value,
          count: option.value === "out" ? outOfStockCount : undefined,
        }))}
      />

      <AdminFilterBar
        action="/admin/inventory"
        resetHref={state === "all" ? "/admin/inventory" : `/admin/inventory?state=${state}`}
        hasActiveFilters={Boolean(params.q || params.category)}
      >
        <input type="hidden" name="state" value={state} />
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="SKU or colour" />
        <AdminFilterSelect
          name="category"
          label="Category"
          defaultValue={params.category ?? ""}
          options={[
            { value: "", label: "All categories" },
            ...categories.map((category) => ({ value: category.id, label: category.name_en })),
          ]}
        />
      </AdminFilterBar>

      <Panel>
        {rows.length === 0 ? (
          <AdminEmptyState
            title={
              state === "low"
                ? "No low-stock variants"
                : state === "out"
                  ? "Nothing is out of stock"
                  : "No variants match these filters"
            }
            description={
              state === "low" || state === "out"
                ? "Every active variant is comfortably above its threshold."
                : "Variants are created when a product is added. Widen the filters, or add a product."
            }
          />
        ) : (
          <>
            {/* Phones: one card per variant, with Adjust in reach. */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((variant) => (
                <li key={variant.id} className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${variant.product_id}`}
                        className="font-sans text-sm font-semibold text-taraWine underline-offset-4 hover:underline"
                      >
                        {variant.products?.name_en ?? "Product"}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1.5 font-sans text-xs text-muted">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                          style={{ backgroundColor: variant.colour_hex }}
                        />
                        {formatSizeLabel(variant.size)} · {variant.colour_en} ·{" "}
                        <span className="font-mono">{variant.sku}</span>
                      </p>
                    </div>
                    <StockBadge stock={variant.stock_quantity} threshold={variant.low_stock_threshold} />
                  </div>
                  <p className="font-sans text-sm text-ink">
                    <strong className="text-base">{variant.stock_quantity}</strong> in stock
                    <span className="text-muted"> · low at {variant.low_stock_threshold}</span>
                  </p>
                  <InventoryAdjuster
                    variantId={variant.id}
                    sku={variant.sku}
                    currentStock={variant.stock_quantity}
                    label={`${variant.products?.name_en ?? "Product"} — ${formatSizeLabel(variant.size)} / ${variant.colour_en}`}
                  />
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
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
            </div>
            {state !== "low" && (
              <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
            )}
          </>
        )}
      </Panel>
    </>
  );
}
