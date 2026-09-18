"use client";

import type { AnalyticsEventInput } from "./events";
import { hasAnyPixel, hasGa4, hasMetaPixel, hasTikTokPixel } from "./config";

/**
 * The bridge from TARA's own events to GA4, Meta and TikTok.
 *
 * ONE CALL SITE. `track()` in lib/analytics/client.ts calls this once per
 * event, immediately after queueing the same event for TARA's own store. That
 * is what makes duplicate events impossible by construction: there is no second
 * place in the codebase that calls `gtag`, `fbq` or `ttq`, so an event cannot
 * be sent twice by two components both deciding to be helpful.
 *
 * A tag that is not configured is not loaded, and every function here is a
 * no-op for it. Nothing throws: a blocked tag, an ad blocker, or a tag that
 * failed to load must never break the page it was measuring.
 *
 * Purchases are handled by `trackPurchasePixels()`, which the confirmation
 * screen calls exactly once per order — guarded by the order number, so a
 * refresh, a back-and-forward or a reopened tab does not report a second sale.
 */

type Gtag = (command: string, ...args: unknown[]) => void;
type Fbq = (command: string, ...args: unknown[]) => void;
type Ttq = {
  track: (event: string, parameters?: Record<string, unknown>) => void;
  page: () => void;
};

interface PixelWindow extends Window {
  gtag?: Gtag;
  fbq?: Fbq;
  ttq?: Ttq;
}

function pixelWindow(): PixelWindow | null {
  return typeof window === "undefined" ? null : (window as PixelWindow);
}

/** Every call into a third-party tag goes through this. None of them may throw. */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    // A measurement tag is never worth an error in a customer's browser.
  }
}

const CURRENCY = "BDT";

/** GA4's item shape, built from whatever the event happens to carry. */
function ga4Item(event: AnalyticsEventInput) {
  return {
    item_id: event.productId,
    item_name: event.meta?.productName,
    item_variant: [event.colour, event.size].filter(Boolean).join(" / ") || undefined,
    price: event.value !== undefined && event.quantity
      ? Number((event.value / event.quantity).toFixed(2))
      : event.value,
    quantity: event.quantity,
  };
}

/**
 * Events recorded before the tags finished loading.
 *
 * The tag scripts load after hydration, deliberately — they must not compete
 * with the product photograph for the connection. But a product page records
 * `product_view` in an effect, which runs first, so without this the most
 * important event on the most important page would be lost for every visit.
 *
 * Bounded, and dropped entirely if the tags never arrive (blocked, offline, an
 * extension): TARA's own store has the events either way.
 */
const pendingEvents: AnalyticsEventInput[] = [];
let pendingPurchase: Parameters<typeof trackPurchasePixels>[0] | null = null;
let tagsReady = !hasAnyPixel;

/** Called once by the tag component, after the snippets have run. */
export function markPixelsReady(): void {
  tagsReady = true;
  const queued = pendingEvents.splice(0, pendingEvents.length);
  for (const event of queued) dispatch(event);
  if (pendingPurchase) {
    const purchase = pendingPurchase;
    pendingPurchase = null;
    trackPurchasePixels(purchase);
  }
}

export function sendToPixels(event: AnalyticsEventInput): void {
  if (!hasAnyPixel) return;
  if (!tagsReady) {
    if (pendingEvents.length < 20) pendingEvents.push(event);
    return;
  }
  dispatch(event);
}

/**
 * The event names each platform expects.
 *
 * Only the ecommerce events each one actually understands are mapped; the rest
 * of TARA's events (a colour being chosen, a gallery image being opened) stay
 * in TARA's own store, where they are useful, rather than being pushed into a
 * third party as custom events nobody will read.
 */
function dispatch(event: AnalyticsEventInput): void {
  const target = pixelWindow();
  if (!target) return;

  const { name } = event;

  if (hasGa4 && target.gtag) {
    const gtag = target.gtag;
    safely(() => {
      switch (name) {
        case "product_view":
          gtag("event", "view_item", {
            currency: CURRENCY,
            value: event.value,
            items: [ga4Item(event)],
          });
          break;
        case "add_to_cart":
          gtag("event", "add_to_cart", {
            currency: CURRENCY,
            value: event.value,
            items: [ga4Item(event)],
          });
          break;
        case "remove_from_cart":
          gtag("event", "remove_from_cart", {
            currency: CURRENCY,
            value: event.value,
            items: [ga4Item(event)],
          });
          break;
        case "cart_view":
          gtag("event", "view_cart", { currency: CURRENCY, value: event.value });
          break;
        case "begin_checkout":
          gtag("event", "begin_checkout", { currency: CURRENCY, value: event.value });
          break;
        case "search":
          gtag("event", "search", { search_term: event.meta?.query });
          break;
        case "category_view":
          gtag("event", "view_item_list", { item_list_name: event.meta?.list });
          break;
        default:
          // page_view is sent by the tag's own configuration; the rest are
          // TARA's own and stay here.
          break;
      }
    });
  }

  if (hasMetaPixel && target.fbq) {
    const fbq = target.fbq;
    safely(() => {
      switch (name) {
        case "product_view":
          fbq("track", "ViewContent", {
            content_ids: event.productId ? [event.productId] : undefined,
            content_type: "product",
            currency: CURRENCY,
            value: event.value,
          });
          break;
        case "add_to_cart":
          fbq("track", "AddToCart", {
            content_ids: event.productId ? [event.productId] : undefined,
            content_type: "product",
            currency: CURRENCY,
            value: event.value,
          });
          break;
        case "begin_checkout":
          fbq("track", "InitiateCheckout", { currency: CURRENCY, value: event.value });
          break;
        case "search":
          fbq("track", "Search", { search_string: event.meta?.query });
          break;
        default:
          break;
      }
    });
  }

  if (hasTikTokPixel && target.ttq) {
    const ttq = target.ttq;
    safely(() => {
      switch (name) {
        case "product_view":
          ttq.track("ViewContent", {
            content_id: event.productId,
            content_type: "product",
            currency: CURRENCY,
            value: event.value,
          });
          break;
        case "add_to_cart":
          ttq.track("AddToCart", {
            content_id: event.productId,
            content_type: "product",
            currency: CURRENCY,
            value: event.value,
            quantity: event.quantity,
          });
          break;
        case "begin_checkout":
          ttq.track("InitiateCheckout", { currency: CURRENCY, value: event.value });
          break;
        case "search":
          ttq.track("Search", { query: event.meta?.query });
          break;
        default:
          break;
      }
    });
  }
}

/** A client-side route change, for the tags that need to be told about one. */
export function sendPageViewToPixels(path: string): void {
  const target = pixelWindow();
  if (!target) return;

  if (hasGa4 && target.gtag) {
    // `send_page_view: false` is set in the tag's config, so the tag does not
    // count the first page and then miss every client-side navigation after it.
    safely(() => target.gtag?.("event", "page_view", { page_path: path }));
  }
  if (hasMetaPixel && target.fbq) {
    safely(() => target.fbq?.("track", "PageView"));
  }
  if (hasTikTokPixel && target.ttq) {
    safely(() => target.ttq?.page());
  }
}

/**
 * The conversion, sent once per order.
 *
 * The caller guards on the order number so this cannot run twice for the same
 * order in one browser, and the transaction id lets each platform discard a
 * duplicate that reaches it from anywhere else — a second device, a shared
 * confirmation link.
 */
export function trackPurchasePixels(order: {
  orderNumber: string;
  total: number;
  items: { productId: string; quantity: number; price: number; name?: string }[];
}): void {
  if (!hasAnyPixel) return;
  if (!tagsReady) {
    pendingPurchase = order;
    return;
  }

  const target = pixelWindow();
  if (!target) return;

  if (hasGa4 && target.gtag) {
    safely(() =>
      target.gtag?.("event", "purchase", {
        transaction_id: order.orderNumber,
        currency: CURRENCY,
        value: order.total,
        items: order.items.map((item) => ({
          item_id: item.productId,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      }),
    );
  }

  if (hasMetaPixel && target.fbq) {
    safely(() =>
      target.fbq?.(
        "track",
        "Purchase",
        {
          currency: CURRENCY,
          value: order.total,
          content_type: "product",
          content_ids: order.items.map((item) => item.productId),
        },
        // Meta's own deduplication key. Two reports of the same eventID are
        // counted once, whichever browser or server they arrive from.
        { eventID: `purchase-${order.orderNumber}` },
      ),
    );
  }

  if (hasTikTokPixel && target.ttq) {
    safely(() =>
      target.ttq?.track("CompletePayment", {
        content_type: "product",
        content_id: order.items[0]?.productId,
        currency: CURRENCY,
        value: order.total,
      }),
    );
  }
}
