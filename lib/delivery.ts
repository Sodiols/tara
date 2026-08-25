import { resolveDivision, type Division } from "@/data/bangladesh-geography";

/**
 * Delivery pricing — one rule, used everywhere.
 *
 * The announcement bar, the bag drawer, the bag page, the checkout summary, the
 * order record, the invoice and the packing slip all read the fee from this
 * module, and `public.calculate_delivery_fee()` in
 * supabase/migrations/0009_catalogue_geography_and_delivery.sql implements exactly the
 * same branches. The database stays authoritative — `place_order()` recomputes
 * the fee and writes its own figure — so this module exists to make sure the
 * number a customer is shown is the number they will actually be charged.
 *
 * The rule the business asked for:
 *
 *   Free delivery applies inside the free-delivery division (Sylhet) once the
 *   subtotal reaches the threshold. Everywhere else pays the outside-Sylhet
 *   charge no matter how large the order is.
 *
 * Every part of it is configurable from /admin/settings, so a later change of
 * mind is a settings edit rather than a code change.
 */

export interface DeliverySettings {
  /** Charge for an address inside the free-delivery division. */
  insideFee: number;
  /** Charge for every other division. */
  outsideFee: number;
  /** Subtotal at which delivery becomes free, inside the eligible division. */
  freeDeliveryThreshold: number;
  /** Master switch — off means the threshold is ignored entirely. */
  freeDeliveryEnabled: boolean;
  /** The one division free delivery applies to. */
  freeDeliveryDivision: Division;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  insideFee: 60,
  outsideFee: 120,
  freeDeliveryThreshold: 1500,
  freeDeliveryEnabled: true,
  freeDeliveryDivision: "Sylhet",
};

export interface DeliveryQuote {
  fee: number;
  /** True when the fee was waived by the free-delivery rule. */
  isFree: boolean;
  /** True when the address is in the free-delivery-eligible division. */
  isEligibleDivision: boolean;
  /**
   * How much more the customer would have to spend to qualify. Null when they
   * already qualify, or when their division can never qualify.
   */
  amountToFreeDelivery: number | null;
}

/**
 * Quotes delivery for a subtotal and a destination.
 *
 * An unrecognised or missing division is priced as "outside": it is the higher
 * of the two charges, so a display bug can never quote a customer less than the
 * database will charge. Checkout rejects an unrecognised division outright, so
 * this branch only ever affects the pre-address screens.
 */
export function quoteDelivery(
  subtotal: number,
  division: unknown,
  settings: DeliverySettings = DEFAULT_DELIVERY_SETTINGS,
): DeliveryQuote {
  const amount = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
  const resolved = resolveDivision(division);
  const isEligibleDivision = resolved === settings.freeDeliveryDivision;

  const baseFee = Math.max(0, isEligibleDivision ? settings.insideFee : settings.outsideFee);

  if (!isEligibleDivision || !settings.freeDeliveryEnabled) {
    return {
      fee: baseFee,
      isFree: baseFee === 0,
      isEligibleDivision,
      amountToFreeDelivery: null,
    };
  }

  const threshold = Math.max(0, settings.freeDeliveryThreshold);
  if (amount >= threshold) {
    return { fee: 0, isFree: true, isEligibleDivision, amountToFreeDelivery: 0 };
  }

  return {
    fee: baseFee,
    isFree: baseFee === 0,
    isEligibleDivision,
    amountToFreeDelivery: threshold - amount,
  };
}

/** Convenience wrapper for the many places that only need the number. */
export function deliveryFeeFor(
  subtotal: number,
  division: unknown,
  settings?: DeliverySettings,
): number {
  return quoteDelivery(subtotal, division, settings).fee;
}

/**
 * The single sentence shown in the announcement bar, the bag drawer and the bag
 * page. Generated from the settings so the promise can never contradict the
 * charge — the previous copy was a hardcoded "৳1500" that would have kept
 * promising the old figure after an administrator changed the threshold.
 */
export function freeDeliveryHeadline(settings: DeliverySettings): string | null {
  if (!settings.freeDeliveryEnabled) return null;
  return `Free delivery in ${settings.freeDeliveryDivision} on orders above ৳${settings.freeDeliveryThreshold.toLocaleString("en-US")}`;
}
