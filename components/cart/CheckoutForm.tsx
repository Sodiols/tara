"use client";

import { useState, useRef, useMemo, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { isValidBdPhone, normalizeBdPhone, formatBdPhone } from "@/lib/phone";
import {
  DELIVERY_ZONES,
  deliveryZoneLabel,
  quoteDeliveryForZone,
  zoneForDivision,
  type DeliveryZone,
  type DeliverySettings,
} from "@/lib/delivery";
import { placeCartOrderAction, previewCouponAction } from "@/lib/supabase/actions/checkout";
import type { CartItem } from "@/types";
import { formatSizeLabel } from "@/lib/product-size";
import type { getCheckoutPrefill } from "@/lib/supabase/queries/account";
import { ReceiptDownloadButton } from "@/components/orders/ReceiptDownloadButton";

type Prefill = Awaited<ReturnType<typeof getCheckoutPrefill>>;

export interface CheckoutFormProps {
  /**
   * "cart" orders everything in the bag. "buy-now" orders exactly one item and
   * never reads or clears the bag.
   */
  mode: "cart" | "buy-now";
  title: string;
  items: CartItem[];
  deliverySettings: DeliverySettings;
  codEnabled: boolean;
  prefill: Prefill;
  /** Shown in the cash-on-delivery terms. From store settings, never invented. */
  supportPhone: string;
  /** Called once the order exists in the database. Clears only this flow's state. */
  onOrderPlaced: () => void;
  /** What to show when there is nothing to buy. */
  emptyState: ReactNode;
}

interface FormErrors {
  [key: string]: string;
}

/**
 * A checkout section heading.
 *
 * Deliberately heavier than the old all-caps micro-label: on a form this long
 * the four section titles are the customer's map, and they were previously the
 * same visual weight as a field label.
 */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-sans text-lg font-bold tracking-tight text-ink sm:text-xl">{children}</h2>
  );
}

/**
 * The checkout, shared by the cart flow and the Buy Now flow.
 *
 * One component rather than two, because the difference between them is which
 * items are being bought and what gets cleared afterwards — everything else,
 * including every validation rule and the submission path, must stay identical.
 * Two copies would drift, and the half that drifted would be the one taking
 * money.
 *
 * NOTHING ABOUT THE MONEY IS TRUSTED FROM HERE. The action sends the product,
 * the variant and the quantity; `place_order()` re-reads every price, recomputes
 * the delivery fee from the chosen zone, re-validates the coupon, locks each
 * variant row and deducts stock inside one transaction. The totals below are
 * display only — they exist so the customer is shown what they will be charged,
 * not so the browser can decide it.
 */
export function CheckoutForm({
  mode,
  title,
  items,
  deliverySettings,
  codEnabled,
  prefill,
  supportPhone,
  onOrderPlaced,
  emptyState,
}: CheckoutFormProps) {
  const savedAddresses = useMemo(() => prefill?.addresses ?? [], [prefill]);
  const defaultSavedAddress = useMemo(
    () => savedAddresses.find((a) => a.is_default) ?? savedAddresses[0],
    [savedAddresses],
  );

  // A saved address prefills what it can. Its division is used only to preselect
  // the delivery zone -- the customer still sees and controls that choice, and
  // no division or district becomes a visible checkout field.
  const [name, setName] = useState(
    prefill?.fullName || defaultSavedAddress?.recipient_name || "",
  );
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone || defaultSavedAddress?.phone || "");
  const [address, setAddress] = useState(defaultSavedAddress?.full_address ?? "");
  const [apartment, setApartment] = useState("");
  const [city, setCity] = useState(defaultSavedAddress?.district ?? "");
  const [postalCode, setPostalCode] = useState(defaultSavedAddress?.postal_code ?? "");
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>(() =>
    zoneForDivision(defaultSavedAddress?.division, deliverySettings),
  );

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);

  const [couponCode, setCouponCode] = useState("");
  // Only a code the server accepted is ever sent: place_order() aborts the whole
  // order with `invalid_coupon` if handed one that does not validate, so a
  // half-typed code left in the box must never reach it.
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // One key per checkout attempt, minted on the first submit and held for the
  // life of this screen. A retry -- a double tap, a flaky connection, a browser
  // retry after a timeout -- replays the original order instead of creating a
  // second. Generated in the handler rather than during render, because a random
  // value produced while rendering is not stable.
  const idempotencyKeyRef = useRef<string | null>(null);
  const getIdempotencyKey = () => {
    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  };

  const subtotalValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryQuote = quoteDeliveryForZone(subtotalValue, deliveryZone, deliverySettings);
  const total = Math.max(0, subtotalValue + deliveryQuote.fee - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponDiscount(0);
      setCouponMessage("Enter a coupon code first.");
      return;
    }
    setCheckingCoupon(true);
    const result = await previewCouponAction(couponCode.trim(), subtotalValue, phone);
    setCheckingCoupon(false);
    if (!result.ok || !result.data) {
      setAppliedCoupon("");
      setCouponDiscount(0);
      setCouponMessage(
        !result.ok ? result.message : "Could not check that coupon right now. Please try again.",
      );
      return;
    }
    setAppliedCoupon(couponCode.trim());
    setCouponDiscount(result.data.discount);
    setCouponMessage(`Coupon applied — you saved ${formatPrice(result.data.discount)}`);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!isValidBdPhone(phone)) {
      next.phone = "Enter a valid Bangladesh mobile number, for example 01712345678.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address for your confirmation and receipt.";
    }
    if (name.trim().length < 2) next.name = "Enter the name the order is for.";
    if (address.trim().length < 8) next.address = "Enter the full street address.";
    if (city.trim().length < 2) next.city = "Enter your city or town.";
    // Optional, but if it is filled in it should be a real shape rather than
    // silently stored as nonsense.
    if (postalCode.trim() && !/^\d{4}$/.test(postalCode.trim())) {
      next.postalCode = "A Bangladesh postal code is four digits, for example 3100.";
    }
    if (!agreeTerms) {
      next.agreeTerms = "Please accept the Terms and Conditions to place your order.";
    }
    // A code typed but never applied would be sent as-is and make place_order()
    // reject the whole order. Silently dropping it would be worse: the customer
    // would pay full price without being told.
    if (couponCode.trim() && !appliedCoupon) {
      next.coupon = "Press Apply to use your coupon code, or clear the box to continue without it.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Guards a second submit slipping through between the click and React
    // re-rendering the disabled button.
    if (submitting) return;
    if (!validate()) return;
    if (items.length === 0) {
      setSubmitError("There is nothing to order.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const result = await placeCartOrderAction(
      {
        customerName: name,
        customerEmail: email,
        customerPhone: normalizeBdPhone(phone) ?? phone,
        paymentMethod: "cash_on_delivery",
        shippingAddress: {
          address,
          apartment,
          city,
          postalCode,
          deliveryZone,
        },
        couponCode: appliedCoupon,
        idempotencyKey: getIdempotencyKey(),
      },
      items,
    );

    if (!result.ok || !result.data) {
      setSubmitting(false);
      setSubmitError(
        result.ok
          ? "Your order could not be placed. Nothing has been ordered — please try again."
          : result.message,
      );
      return;
    }

    setOrderNumber(result.data.orderNumber);
    setTrackingToken(result.data.trackingToken);
    setOrderTotal(result.data.total);
    // Only once the order exists in the database. For Buy Now this clears the
    // Buy Now selection and leaves the cart exactly as it was.
    onOrderPlaced();
  };

  if (orderNumber) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-5 text-wine" />
        <h1 className="mb-3 font-serif text-3xl text-ink">
          {"Your order has been placed successfully!"}
        </h1>
        <p className="mb-6 text-sm text-muted">
          {
            "Thank you for shopping with TARA. We will call you shortly to confirm your order, then deliver it to your address. You pay the delivery agent in cash when it arrives — nothing to pay now."
          }
        </p>
        <p className="mb-2 text-sm text-ink">
          {"Order Number"}: <strong data-testid="order-number">{orderNumber}</strong>
        </p>
        {orderTotal != null && (
          <p className="mb-6 text-sm text-ink">
            {"Total"}: <strong>{formatPrice(orderTotal)}</strong>
          </p>
        )}
        <p className="mb-8 break-all text-xs text-muted">
          {"Tracking token"}: <strong data-testid="tracking-token">{trackingToken}</strong>
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ReceiptDownloadButton orderNumber={orderNumber} trackingToken={trackingToken} />
          <Link href="/"><Button variant="secondary">{"Continue Shopping"}</Button></Link>
        </div>
      </div>
    );
  }

  if (!codEnabled) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="mb-3 font-serif text-3xl text-ink">
          {"We are not taking orders right now"}
        </h1>
        <p className="mb-8 text-sm text-muted">
          {
            "Cash on delivery is temporarily unavailable, so new orders cannot be placed. Please try again shortly."
          }
        </p>
        <Link href="/">
          <Button variant="secondary">{"Continue Shopping"}</Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) return <>{emptyState}</>;

  const supportContact = supportPhone ? formatBdPhone(supportPhone) : "+88017********";

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: title }]} />
      <h1 className="mb-8 mt-3 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h1>

      <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-10 lg:col-span-2">
          {/* ---------------------------------------------------- Contact -- */}
          <section aria-labelledby="checkout-contact">
            <div id="checkout-contact" className="mb-4">
              <SectionHeading>{"Contact"}</SectionHeading>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={"Email address"}
                type="email"
                autoComplete="email"
                required
                maxLength={200}
                placeholder="you@example.com"
                hint="We send your confirmation and receipt here."
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={errors.email}
              />
              <Input
                label={"Phone number"}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="01XXXXXXXXX"
                hint="We call this number to confirm your order before delivery."
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={errors.phone}
              />
            </div>
          </section>

          {/* --------------------------------------------------- Delivery -- */}
          <section aria-labelledby="checkout-delivery">
            <div id="checkout-delivery" className="mb-4">
              <SectionHeading>{"Delivery"}</SectionHeading>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={"Name"}
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={errors.name}
                containerClassName="sm:col-span-2"
              />
              <Input
                label={"Address"}
                autoComplete="street-address"
                required
                placeholder="House and road, plus any landmark"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                error={errors.address}
                containerClassName="sm:col-span-2"
              />
              <Input
                label={"Apartment, suite, etc. (optional)"}
                autoComplete="address-line2"
                value={apartment}
                onChange={(event) => setApartment(event.target.value)}
                containerClassName="sm:col-span-2"
              />
              <Input
                label={"City"}
                autoComplete="address-level2"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                error={errors.city}
              />
              <Input
                label={"Postal code (optional)"}
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={4}
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                error={errors.postalCode}
              />
            </div>
          </section>

          {/* -------------------------------------------- Delivery method -- */}
          <section aria-labelledby="checkout-delivery-method">
            <div id="checkout-delivery-method" className="mb-4">
              <SectionHeading>{"Delivery method"}</SectionHeading>
            </div>
            {/*
              The one question the delivery charge actually depends on. Checkout
              used to ask for a division and a district and infer the zone; now
              the customer states it, and the same value is what the database
              prices from.
            */}
            <fieldset>
              <legend className="sr-only">{"Choose a delivery area"}</legend>
              <div className="flex flex-col gap-3">
                {DELIVERY_ZONES.map((zone) => {
                  const quote = quoteDeliveryForZone(subtotalValue, zone, deliverySettings);
                  const selected = deliveryZone === zone;
                  return (
                    <label
                      key={zone}
                      className={`flex cursor-pointer items-center gap-3 rounded-control border px-4 py-4 transition-colors ${
                        selected ? "border-wine bg-beige/40" : "border-border hover:border-wine/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryZone"
                        value={zone}
                        checked={selected}
                        onChange={() => setDeliveryZone(zone)}
                        className="h-4 w-4 shrink-0 accent-wine"
                      />
                      <span className="flex-1 text-sm text-ink">
                        {deliveryZoneLabel(zone, deliverySettings)}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {quote.isFree ? "FREE" : formatPrice(quote.fee)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {deliveryQuote.amountToFreeDelivery != null &&
              deliveryQuote.amountToFreeDelivery > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {"Add "}
                  {formatPrice(deliveryQuote.amountToFreeDelivery)}
                  {" more to qualify for free delivery "}
                  {deliveryZoneLabel("inside_sylhet", deliverySettings).toLowerCase()}
                  {"."}
                </p>
              )}
          </section>

          {/* --------------------------------------------- Payment method -- */}
          <section aria-labelledby="checkout-payment">
            <div id="checkout-payment" className="mb-4">
              <SectionHeading>{"Payment method"}</SectionHeading>
            </div>
            {/*
              Cash on delivery is the only method, and place_order() writes it on
              every order regardless of what a client sends. It is presented as
              the selected option rather than as a choice that does not exist.
            */}
            <div className="rounded-control border border-wine bg-beige/40 px-4 py-4">
              <p className="text-sm font-medium text-ink">{"Cash on Delivery (COD)"}</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {"Pay in cash when your order is delivered to your door."}
              </p>
            </div>

            <div className="mt-3 rounded-control border border-border bg-cream/60 px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {"Cash on Delivery (COD) Terms and Conditions"}
              </h3>
              <ol className="mt-3 flex flex-col gap-3 text-sm leading-6 text-muted">
                <li>
                  <span className="font-medium text-ink">{"1. Order Confirmation"}</span>
                  <br />
                  {"All COD orders will be confirmed by our team via phone within 24 hours."}
                </li>
                <li>
                  <span className="font-medium text-ink">{"2. Payment at Delivery"}</span>
                  <br />
                  {
                    "Payment is due in full upon delivery. Please ensure you have the exact amount ready."
                  }
                </li>
                <li>
                  <span className="font-medium text-ink">{"3. Order Cancellation"}</span>
                  <br />
                  {
                    "COD orders can be cancelled up to 24 hours before dispatch. Contact us to cancel."
                  }
                </li>
                <li>
                  <span className="font-medium text-ink">{"4. Contact Us"}</span>
                  <br />
                  {"For any questions or concerns, reach out to us at "}
                  {supportContact}
                  {"."}
                </li>
              </ol>
            </div>
          </section>
        </div>

        {/* ------------------------------------------------- Order summary -- */}
        <div className="flex h-fit flex-col gap-4 rounded-panel border border-border bg-beige/50 p-6 lg:sticky lg:top-[120px]">
          <h2 className="mb-1 font-serif text-xl text-ink">{"Order Summary"}</h2>
          <div className="flex max-h-64 flex-col gap-4 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-3">
                <div className="relative h-[70px] w-14 shrink-0 bg-white">
                  <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-wine text-[10px] text-white">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center">
                  <p className="line-clamp-1 text-xs text-ink">{item.name}</p>
                  <p className="text-xs text-muted">
                    {[formatSizeLabel(item.size), item.colour].filter(Boolean).join(" / ")}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <label htmlFor="checkout-coupon" className="text-xs uppercase tracking-wide text-muted">
              {"Coupon Code"}
            </label>
            <div className="flex gap-2">
              <input
                id="checkout-coupon"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                disabled={couponDiscount > 0}
                className="h-11 flex-1 rounded-control border border-border bg-white px-3.5 text-sm transition-colors focus:border-wine focus:outline-none disabled:bg-beige/60 disabled:text-muted"
              />
              {couponDiscount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCouponCode("");
                    setAppliedCoupon("");
                    setCouponDiscount(0);
                    setCouponMessage("");
                  }}
                >
                  {"Remove coupon"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyCoupon}
                  loading={checkingCoupon}
                >
                  {"Apply"}
                </Button>
              )}
            </div>
            {couponMessage && <p className="text-xs text-wine">{couponMessage}</p>}
            {errors.coupon && (
              <p role="alert" className="text-xs text-wine">
                {errors.coupon}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-muted">{"Subtotal"}</span>
              <span className="text-ink">{formatPrice(subtotalValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{"Delivery"}</span>
              <span className="text-ink" aria-live="polite" data-testid="delivery-charge">
                {deliveryQuote.isFree ? "FREE" : formatPrice(deliveryQuote.fee)}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{"Coupon Code"}</span>
                <span className="text-wine">-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-base">
              <span className="font-medium text-ink">{"Total"}</span>
              <span className="font-medium text-ink" aria-live="polite">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <label className="mt-1 flex items-start gap-2.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-wine"
            />
            {"I agree to the Terms and Conditions and Privacy Policy"}
          </label>
          {errors.agreeTerms && (
            <p role="alert" className="-mt-2 text-xs text-wine">
              {errors.agreeTerms}
            </p>
          )}

          {submitError && (
            <p role="alert" className="text-xs text-wine">
              {submitError}
            </p>
          )}
          <Button type="submit" fullWidth loading={submitting}>
            {"Place Order"}
          </Button>
        </div>
      </form>
    </Container>
  );
}
