import { formatTaka } from "./format";
import type { LaunchOfferScope, LaunchOfferType } from "@/types/database";

/**
 * The launch offer, as the storefront understands it.
 *
 * ONE OFFER, and it does not exist until an administrator configures it and
 * switches it on. Nothing here has a default that offers anybody anything: an
 * absent offer is `null`, and every surface that shows one renders nothing for
 * null rather than falling back to a discount nobody authorised.
 *
 * THE WORDING IS DERIVED, THE MONEY IS NOT. Everything in this module is
 * display: a badge, a sentence, whether a product takes part. What an order
 * actually costs is decided by `launch_offer_benefit()` inside `place_order()`,
 * which re-reads the offer, re-checks its dates and re-checks participation
 * (migration 0026). A browser that lies about any of this changes what it sees
 * and nothing about what it pays.
 */

export interface LaunchOffer {
  title: string;
  description: string;
  offerType: LaunchOfferType;
  appliesTo: LaunchOfferScope;
  /** A percentage (1-90) or an amount in taka. Null for free delivery and gift. */
  discountValue: number | null;
  minimumOrderAmount: number;
  giftDescription: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Participating products. Empty for a site-wide offer, which includes all. */
  productIds: string[];
  /** The campaign's hero products, newest first. */
  heroSlugs: string[];
}

/** What the offer gives, in three or four words. For a badge. */
export function offerBadge(offer: LaunchOffer): string {
  switch (offer.offerType) {
    case "free_delivery":
      return "Free delivery";
    case "percentage":
      return offer.discountValue ? `${formatPercentage(offer.discountValue)} off` : "Launch offer";
    case "fixed_amount":
      return offer.discountValue ? `${formatTaka(offer.discountValue)} off` : "Launch offer";
    case "first_order":
      return offer.discountValue
        ? `${formatPercentage(offer.discountValue)} off your first order`
        : "First order offer";
    case "gift":
      return "Free gift";
    default:
      return "Launch offer";
  }
}

/**
 * The offer in one sentence, including its condition.
 *
 * The minimum is stated whenever there is one, because an offer whose condition
 * is only discovered at checkout is worse than no offer.
 */
export function offerSentence(offer: LaunchOffer): string {
  const benefit = (() => {
    switch (offer.offerType) {
      case "free_delivery":
        return "Free delivery on this order";
      case "percentage":
        return offer.discountValue
          ? `${formatPercentage(offer.discountValue)} off`
          : "A launch discount";
      case "fixed_amount":
        return offer.discountValue ? `${formatTaka(offer.discountValue)} off` : "A launch discount";
      case "first_order":
        return offer.discountValue
          ? `${formatPercentage(offer.discountValue)} off your first order`
          : "A discount on your first order";
      case "gift":
        return offer.giftDescription.trim()
          ? `A free gift: ${offer.giftDescription.trim()}`
          : "A free gift with your order";
      default:
        return "A launch offer";
    }
  })();

  const scope =
    offer.appliesTo === "selected_products" ? " on selected pieces" : "";
  const minimum =
    offer.minimumOrderAmount > 0
      ? `, on orders from ${formatTaka(offer.minimumOrderAmount)}`
      : "";

  return `${benefit}${scope}${minimum}.`;
}

/** Whether this product takes part. A site-wide offer includes everything. */
export function offerIncludesProduct(offer: LaunchOffer, productId: string): boolean {
  if (offer.appliesTo === "site_wide") return true;
  return offer.productIds.includes(productId);
}

/**
 * Whether the offer is live right now, in the browser's clock.
 *
 * Only ever used to stop a page showing an offer that expired while the tab was
 * left open. The database's own window check is the authority — it decides what
 * `active_launch_offer()` returns and what `place_order()` applies — so a
 * clock-shifted device gets a wrong badge at worst, never a wrong price.
 */
export function offerIsLive(offer: LaunchOffer, now: Date = new Date()): boolean {
  const time = now.getTime();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > time) return false;
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= time) return false;
  return true;
}

/**
 * Whether the storefront can state the money an offer saves before checkout.
 *
 * A first-order offer cannot be quoted: whether this is somebody's first order
 * depends on their phone number, which the shop does not know while they are
 * browsing. Showing a saving that then does not appear would be worse than
 * showing none, so those offers are announced in words only.
 */
export function offerIsQuotable(offer: LaunchOffer): boolean {
  return offer.offerType !== "first_order" && offer.offerType !== "gift";
}

/** 20 rather than 20.00, and 12.5 kept as 12.5. */
function formatPercentage(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}%`;
}

export interface OfferQuote {
  /** Taka taken off the goods. Never off the delivery charge. */
  discount: number;
  /** True when the delivery charge is waived outright. */
  freeDelivery: boolean;
  label: string;
}

/**
 * What the offer is worth on this basket, for display.
 *
 * MIRRORS `launch_offer_benefit()` in migration 0026, branch for branch — the
 * same shape as `lib/delivery.ts` and `calculate_delivery_fee_for_zone()`, and
 * for the same reason: the number a customer is shown has to be the number they
 * are charged. The database stays authoritative (`place_order()` recomputes it
 * and writes its own figure); this exists so the bag and the checkout can show
 * the saving without a round trip, and `tests/launch-offer.test.ts` asserts the
 * two implementations agree.
 *
 * Returns null when the offer does not apply — outside its dates, below its
 * minimum, no participating product in the basket — and also for the two types
 * that cannot honestly be quoted before checkout:
 *
 *   first_order  depends on whether this phone number has ordered before, which
 *                the shop does not know while somebody is browsing;
 *   gift         carries no money at all.
 *
 * Both are still announced in words. Quoting them optimistically would show a
 * saving that the order then does not get, which is the one failure mode worth
 * designing against.
 */
export function quoteOffer(
  offer: LaunchOffer | null,
  subtotal: number,
  productIds: readonly string[],
  now: Date = new Date(),
): OfferQuote | null {
  if (!offer || !offerIsLive(offer, now)) return null;
  if (!offerIsQuotable(offer)) return null;

  const goods = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
  if (goods < offer.minimumOrderAmount) return null;

  const participates =
    offer.appliesTo === "site_wide" ||
    productIds.some((id) => offer.productIds.includes(id));
  if (!participates) return null;

  const label = offer.title.trim() || "Launch offer";

  if (offer.offerType === "free_delivery") {
    return { discount: 0, freeDelivery: true, label };
  }
  if (offer.offerType === "percentage") {
    const percentage = Math.min(Math.max(offer.discountValue ?? 0, 0), 90);
    return {
      discount: Number(((goods * percentage) / 100).toFixed(2)),
      freeDelivery: false,
      label,
    };
  }
  if (offer.offerType === "fixed_amount") {
    return {
      discount: Math.min(Math.max(offer.discountValue ?? 0, 0), goods),
      freeDelivery: false,
      label,
    };
  }
  return null;
}

export interface OfferedTotals {
  /** Delivery after a free-delivery offer has been applied. */
  deliveryFee: number;
  /** What the offer actually takes off, after clamping. */
  offerDiscount: number;
  total: number;
}

/**
 * Applies a quote to a basket's totals, the way `place_order()` does.
 *
 * The order matters and is the same in both places:
 *
 *   1. a free-delivery offer waives the delivery charge outright;
 *   2. a money offer comes off the GOODS, never off delivery;
 *   3. it stacks on top of a coupon, clamped so the two together can never
 *      exceed the goods — an order can reach zero for the items and still owe
 *      the delivery charge, and it can never go negative.
 *
 * Used by the bag and by the checkout summary so both show the same figure, and
 * mirrored in SQL, which is what the customer is actually charged.
 */
export function applyOfferToTotals(input: {
  subtotal: number;
  deliveryFee: number;
  couponDiscount: number;
  quote: OfferQuote | null;
}): OfferedTotals {
  const { subtotal, couponDiscount, quote } = input;
  const deliveryFee = quote?.freeDelivery ? 0 : input.deliveryFee;
  const offerDiscount = quote
    ? Math.min(Math.max(quote.discount, 0), Math.max(subtotal - couponDiscount, 0))
    : 0;

  return {
    deliveryFee,
    offerDiscount,
    total: Math.max(0, subtotal + deliveryFee - couponDiscount - offerDiscount),
  };
}
