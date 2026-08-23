import Link from "next/link";
import { getAdminReviews, parsePage } from "@/lib/supabase/queries/admin";
import { moderateReviewAction } from "@/lib/supabase/actions/admin";
import { formatDateTime } from "@/lib/format";
import { AdminEmptyState, PageHeader, Pagination, Panel } from "@/components/admin/ui";
import { ReviewStatusBadge } from "@/components/admin/status";
import { RowActionButton } from "@/components/admin/AdminForm";
import type { ReviewStatus } from "@/types/database";

type SearchParams = { page?: string; q?: string; status?: string };

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = (params.status ?? "pending") as ReviewStatus | "all" | "";

  const { rows, total, pageSize } = await getAdminReviews({
    page,
    search: params.q,
    status: status === "" ? "all" : (status as ReviewStatus),
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/reviews?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Reviews"
        description="Only approved reviews are visible on the storefront and only they count towards a product's rating."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((option) => {
          const isActive = (params.status ?? "pending") === option.value;
          return (
            <Link
              key={option.label}
              href={option.value ? `/admin/reviews?status=${option.value}` : "/admin/reviews?status="}
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
        <form method="get" action="/admin/reviews" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="status" value={params.status ?? "pending"} />
          <label htmlFor="review-search" className="sr-only">
            Search reviews
          </label>
          <input
            id="review-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Author or text"
            className="h-9 w-52 rounded-control border border-border bg-taraWhite px-3 font-sans text-sm outline-none focus:border-taraWine"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
          >
            Search
          </button>
        </form>
      </div>

      <Panel>
        {rows.length === 0 ? (
          <AdminEmptyState
            title="Nothing to moderate"
            description="Reviews can only be written by customers who actually received the product, so this queue stays short."
          />
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              {rows.map((review) => (
                <li key={review.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-semibold text-ink">
                        {review.author_name}
                        <span
                          className="ml-2 text-taraWine"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          {"★".repeat(review.rating)}
                          <span className="text-muted">{"★".repeat(5 - review.rating)}</span>
                        </span>
                      </p>
                      <p className="font-sans text-xs text-muted">
                        {review.products?.name_en ?? "Product"} ·{" "}
                        {formatDateTime(review.created_at)}
                        {review.moderated_at && ` · moderated ${formatDateTime(review.moderated_at)}`}
                      </p>
                    </div>
                    <ReviewStatusBadge status={review.status} />
                  </div>

                  {review.title && (
                    <p className="mt-3 font-sans text-sm font-semibold text-ink">{review.title}</p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
                    {review.comment_en}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4">
                    {review.status !== "approved" && (
                      <RowActionButton
                        action={async () => {
                          "use server";
                          return moderateReviewAction(review.id, "approved");
                        }}
                      >
                        Approve
                      </RowActionButton>
                    )}
                    {review.status !== "rejected" && (
                      <RowActionButton
                        tone="danger"
                        confirm="Reject this review? It stays in the database but is never shown publicly."
                        action={async () => {
                          "use server";
                          return moderateReviewAction(review.id, "rejected");
                        }}
                      >
                        Reject
                      </RowActionButton>
                    )}
                    {review.status !== "pending" && (
                      <RowActionButton
                        action={async () => {
                          "use server";
                          return moderateReviewAction(review.id, "pending");
                        }}
                      >
                        Return to pending
                      </RowActionButton>
                    )}
                    {review.products?.slug && (
                      <Link
                        href={`/product/${review.products.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-sans text-xs font-semibold uppercase tracking-wide text-muted underline-offset-4 hover:text-taraWine hover:underline"
                      >
                        View product
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
