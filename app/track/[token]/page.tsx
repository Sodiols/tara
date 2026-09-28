import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { OrderTrackingView } from "@/components/orders/OrderTrackingView";
import { lookupOrderTracking } from "@/lib/supabase/queries/tracking";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";

/**
 * /track/<tracking token> -- the canonical public tracking page.
 *
 * The URL itself is the credential, so the page is never indexed, never cached
 * across visitors, and sends no Referer when someone follows a link off it.
 * The analytics layer records this route as /track/[token]
 * (lib/order-identifiers.ts: redactTrackingPath) and the third-party tags do
 * not load on it at all (components/analytics/MarketingTags.tsx).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your order",
  description: "The delivery status of a TARA order.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function TrackOrderByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [lookup, settings] = await Promise.all([
    lookupOrderTracking(token),
    getPublicStoreSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Order Tracking", href: "/track-order" }, { label: "Status" }]} />
      <h1 className="mt-3 mb-8 font-serif text-3xl text-ink sm:text-4xl">Track your order</h1>

      {lookup.state === "found" ? (
        <OrderTrackingView order={lookup.order} delivery={settings.delivery} />
      ) : (
        <div role="alert" className="rounded-panel border border-border p-6 text-sm">
          <p className="text-ink">
            {lookup.state === "rate_limited"
              ? "Too many tracking attempts. Please wait a few minutes and try again."
              : lookup.state === "unavailable"
                ? "Tracking is temporarily unavailable. Please try again shortly."
                : "We could not find an order for this tracking link."}
          </p>
          {lookup.state === "not_found" ? (
            <p className="mt-2 text-muted">
              Check that the whole link from your order confirmation was copied, or{" "}
              <Link href="/track-order" className="text-wine underline">enter your tracking code</Link>.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
