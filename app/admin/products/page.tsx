import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { getAdminProducts, getTaxonomyOptions, parsePage } from "@/lib/supabase/queries/admin";
import { formatDateTime, formatNumber, formatTaka } from "@/lib/format";
import { duplicateProductAction } from "@/lib/supabase/actions/admin";
import { archiveItemAction } from "@/lib/supabase/actions/archive";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterSelect,
  AdminPrimaryAction,
  AdminSearchInput,
  Badge,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ProductStatusBadge } from "@/components/admin/status";
import { RowActionButton } from "@/components/admin/AdminForm";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

type SearchParams = { page?: string; q?: string; status?: string; category?: string };

type Row = Awaited<ReturnType<typeof getAdminProducts>>["rows"][number];

/** The photograph a card would show: the main one, else the first. */
function thumbnailOf(product: Row): string | null {
  const images = product.product_images ?? [];
  const primary = images.find((image) => image.is_primary);
  if (primary) return primary.image_url;
  const first = [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
  return first?.image_url ?? null;
}

/** Stock across the variants a customer can actually buy. */
function stockSummary(product: Row) {
  const active = (product.product_variants ?? []).filter((variant) => variant.is_active !== false);
  const stock = active.reduce((sum, variant) => sum + variant.stock_quantity, 0);
  const out = active.filter((variant) => variant.stock_quantity <= 0).length;
  const low = active.filter(
    (variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.low_stock_threshold,
  ).length;
  return { variants: product.product_variants?.length ?? 0, stock, out, low };
}

function Thumbnail({ src, name }: { src: string | null; name: string }) {
  return (
    <span className="relative inline-flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-taraIvory">
      {src ? (
        <Image src={src} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <ImageOff size={16} className="text-muted" aria-label={`${name} has no photograph`} />
      )}
    </span>
  );
}

function StockCell({ product, align = "end" }: { product: Row; align?: "start" | "end" }) {
  const summary = stockSummary(product);
  if (summary.variants === 0) return <Badge tone="warning">No variants</Badge>;
  return (
    <div className={align === "end" ? "flex flex-col items-end gap-1" : "flex flex-col gap-0.5"}>
      <span className="font-semibold">{formatNumber(summary.stock)} in stock</span>
      <span className="text-xs text-muted">
        {summary.variants} variant{summary.variants === 1 ? "" : "s"}
        {summary.out > 0 && ` · ${summary.out} sold out`}
        {summary.out === 0 && summary.low > 0 && ` · ${summary.low} low`}
      </span>
    </div>
  );
}

function RowActions({ product }: { product: Row }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      <Link
        href={`/admin/products/${product.id}`}
        className="inline-flex min-h-9 items-center font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
      >
        Edit
      </Link>
      <RowActionButton
        action={async () => {
          "use server";
          return duplicateProductAction(product.id);
        }}
      >
        Duplicate
      </RowActionButton>
      <RowActionButton
        tone="danger"
        confirmTitle={`Archive ${product.name_en}?`}
        confirmLabel="Archive product"
        confirm="It will be hidden from the storefront. Past orders keep their own price and name, so order history is unaffected. An administrator can restore it from Archive & Trash."
        action={async () => {
          "use server";
          return archiveItemAction("product", product.id);
        }}
      >
        Archive
      </RowActionButton>
    </div>
  );
}

/**
 * The catalogue.
 *
 * Each row answers the questions staff actually open this page with — what it
 * looks like, what it costs, whether it can be bought, whether it is live —
 * and the name opens the editor. On a phone the table becomes a list of cards
 * rather than a table somebody has to scroll sideways to read.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);

  const [{ rows, total, pageSize }, { categories }] = await Promise.all([
    getAdminProducts({
      page,
      search: params.q,
      status: params.status === "active" || params.status === "draft" ? params.status : "all",
      categoryId: params.category,
    }),
    getTaxonomyOptions(),
  ]);

  const filtered = Boolean(params.q || params.status || params.category);

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/products?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description={`${total.toLocaleString("en-US")} product${total === 1 ? "" : "s"}${filtered ? " match these filters" : " in the catalogue"}. Archived products are in Archive & Trash.`}
        actions={<AdminPrimaryAction href="/admin/products/new">Add product</AdminPrimaryAction>}
      />

      <AdminFilterBar action="/admin/products" resetHref="/admin/products" hasActiveFilters={filtered}>
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="Name, product code or address" />
        <AdminFilterSelect
          name="status"
          label="Status"
          defaultValue={params.status ?? ""}
          options={[
            { value: "", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
          ]}
        />
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
          filtered ? (
            <AdminEmptyState
              title="No products match these filters"
              description="Try a different search, or clear the filters to see the whole catalogue."
            />
          ) : (
            <AdminEmptyState
              title="No products yet"
              description="Add the first product — its photographs, colours, sizes and stock are all set up on one screen."
              action={<AdminPrimaryAction href="/admin/products/new">Add product</AdminPrimaryAction>}
            />
          )
        ) : (
          <>
            {/* Phones: cards. */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((product) => {
                const imageCount = product.product_images?.length ?? 0;
                return (
                  <li key={product.id} className="flex gap-3 px-4 py-4">
                    <Thumbnail src={thumbnailOf(product)} name={product.name_en} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="min-w-0 font-sans text-sm font-semibold text-taraWine underline-offset-4 hover:underline"
                        >
                          {product.name_en}
                        </Link>
                        <ProductStatusBadge status={product.status} />
                      </div>
                      <p className="font-sans text-xs text-muted">
                        {product.product_code} · {product.categories?.name_en ?? "No category"} ·{" "}
                        {formatTaka(product.base_price)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <StockCell product={product} align="start" />
                        {imageCount === 0 && <Badge tone="warning">Needs photographs</Badge>}
                      </div>
                      <RowActions product={product} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Tablet and up: a table. */}
            <div className="hidden md:block">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Category</Th>
                    <Th align="right">Price</Th>
                    <Th align="right">Stock</Th>
                    <Th>Status</Th>
                    <Th align="right">Updated</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => {
                    const imageCount = product.product_images?.length ?? 0;
                    return (
                      <tr key={product.id} className="transition-colors hover:bg-taraIvory/40">
                        <Td>
                          <div className="flex items-center gap-3">
                            <Thumbnail src={thumbnailOf(product)} name={product.name_en} />
                            <div className="min-w-0">
                              <Link
                                href={`/admin/products/${product.id}`}
                                className="font-semibold text-taraWine underline-offset-4 hover:underline"
                              >
                                {product.name_en}
                              </Link>
                              <span className="mt-0.5 block font-mono text-xs text-muted">
                                {product.product_code}
                              </span>
                              {imageCount === 0 && (
                                <Badge tone="warning" className="mt-1">
                                  Needs photographs
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Td>
                        <Td>{product.categories?.name_en ?? "—"}</Td>
                        <Td align="right">
                          {formatTaka(product.base_price)}
                          {product.compare_at_price && (
                            <span className="block text-xs text-muted line-through">
                              {formatTaka(product.compare_at_price)}
                            </span>
                          )}
                        </Td>
                        <Td align="right">
                          <StockCell product={product} />
                        </Td>
                        <Td>
                          <ProductStatusBadge status={product.status} />
                        </Td>
                        <Td align="right" className="whitespace-nowrap text-xs text-muted">
                          {formatDateTime(product.updated_at)}
                        </Td>
                        <Td align="right">
                          <RowActions product={product} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
