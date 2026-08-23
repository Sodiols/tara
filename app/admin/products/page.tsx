import Link from "next/link";
import { getAdminProducts, getTaxonomyOptions, parsePage } from "@/lib/supabase/queries/admin";
import { formatDateTime, formatTaka } from "@/lib/format";
import {
  setProductStatusAction,
  duplicateProductAction,
} from "@/lib/supabase/actions/admin";
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
import { ProductStatusBadge } from "@/components/admin/status";
import { RowActionButton } from "@/components/admin/AdminForm";

type SearchParams = { page?: string; q?: string; status?: string; category?: string };

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
      status: (params.status as "draft" | "active" | "archived") || "all",
      categoryId: params.category,
    }),
    getTaxonomyOptions(),
  ]);

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
        eyebrow="Selling"
        title="Products"
        description={`${total.toLocaleString("en-US")} product${total === 1 ? "" : "s"} in the catalogue.`}
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
          >
            New product
          </Link>
        }
      />

      <form method="get" action="/admin/products">
        <Toolbar>
          <Field label="Search" htmlFor="product-search" className="min-w-[220px] flex-1">
            <input
              id="product-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ""}
              placeholder="Name, code or slug"
              className={adminInputClass}
            />
          </Field>
          <Field label="Status" htmlFor="product-status" className="min-w-[150px]">
            <select
              id="product-status"
              name="status"
              defaultValue={params.status ?? ""}
              className={adminInputClass}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Category" htmlFor="product-category" className="min-w-[190px]">
            <select
              id="product-category"
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
              href="/admin/products"
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
            title="No products match those filters"
            description="Create your first product, or reset the filters to see the whole catalogue."
            action={
              <Link
                href="/admin/products/new"
                className="mt-2 inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory"
              >
                New product
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Variants</Th>
                  <Th align="right">Stock</Th>
                  <Th>Status</Th>
                  <Th align="right">Updated</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const variants = product.product_variants ?? [];
                  const stock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
                  const lowCount = variants.filter(
                    (v) => v.stock_quantity <= v.low_stock_threshold,
                  ).length;

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-taraIvory/40">
                      <Td>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-medium text-taraWine underline-offset-4 hover:underline"
                        >
                          {product.name_en}
                        </Link>
                        <span className="mt-0.5 block font-sans text-xs text-muted">
                          {product.product_code} · /{product.slug}
                        </span>
                      </Td>
                      <Td>{product.categories?.name_en ?? "—"}</Td>
                      <Td align="right">
                        {formatTaka(product.base_price)}
                        {product.compare_at_price && (
                          <span className="ml-1 text-xs text-muted line-through">
                            {formatTaka(product.compare_at_price)}
                          </span>
                        )}
                      </Td>
                      <Td align="right">{variants.length}</Td>
                      <Td align="right">
                        <span className={lowCount > 0 ? "font-semibold text-[#8A6A1F]" : ""}>
                          {stock}
                        </span>
                        {lowCount > 0 && (
                          <span className="block text-[11px] text-muted">{lowCount} low</span>
                        )}
                      </Td>
                      <Td>
                        <ProductStatusBadge status={product.status} />
                      </Td>
                      <Td align="right" className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(product.updated_at)}
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <RowActionButton
                            action={async () => {
                              "use server";
                              return duplicateProductAction(product.id);
                            }}
                          >
                            Duplicate
                          </RowActionButton>
                          {product.status === "archived" ? (
                            <RowActionButton
                              action={async () => {
                                "use server";
                                return setProductStatusAction(product.id, "draft");
                              }}
                            >
                              Restore
                            </RowActionButton>
                          ) : (
                            <RowActionButton
                              tone="danger"
                              confirm={`Archive "${product.name_en}"? It will be hidden from the storefront. Past orders keep their own price and name snapshots, so order history is unaffected.`}
                              action={async () => {
                                "use server";
                                return setProductStatusAction(product.id, "archived");
                              }}
                            >
                              Archive
                            </RowActionButton>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
