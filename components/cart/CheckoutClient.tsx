"use client";

import { useState, useRef, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/phone";
import { divisions, districtsByDivision } from "@/data/site";
import { Container } from "@/components/layout/Container";
import { placeCartOrderAction, previewCouponAction } from "@/lib/supabase/actions/checkout";
import type { DeliverySettings } from "@/lib/supabase/queries/settings";
import type { getCheckoutPrefill } from "@/lib/supabase/queries/account";

interface FormErrors {
  [key: string]: string;
}

interface CheckoutClientProps {
  deliverySettings: DeliverySettings;
  prefill: Awaited<ReturnType<typeof getCheckoutPrefill>>;
}

export function CheckoutClient({ deliverySettings, prefill }: CheckoutClientProps) {
  const { items, subtotal, clearBag } = useCartStore();
  const {
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    standardDeliveryFee: STANDARD_DELIVERY_FEE,
  } = deliverySettings;

  const savedAddresses = prefill?.addresses ?? [];
  const defaultSavedAddress = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];

  const [fullName, setFullName] = useState(prefill?.fullName ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    defaultSavedAddress ? defaultSavedAddress.id : "new"
  );
  const [division, setDivision] = useState(defaultSavedAddress?.division ?? "Sylhet");
  const [district, setDistrict] = useState(
    defaultSavedAddress?.district ?? districtsByDivision["Sylhet"][0]
  );
  const [address, setAddress] = useState(defaultSavedAddress?.full_address ?? "");
  const [notes, setNotes] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  // The code the server actually accepted. Only this is sent with the
  // order: place_order() aborts the whole order with `invalid_coupon` if it
  // is handed a code that does not validate, so a half-typed or rejected
  // code left sitting in the box must never reach it.
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // One key per checkout attempt, minted on the first submit and then held for
  // the life of this screen. If the request is retried — a double tap, a flaky
  // mobile connection, a browser retry after a timeout — the database
  // recognises the key and replays the original order instead of creating a
  // second one. Generated inside the event handler rather than during render,
  // because a random value produced while rendering is not stable.
  const idempotencyKeyRef = useRef<string | null>(null);
  const getIdempotencyKey = () => {
    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  };

  const subtotalValue = subtotal();
  // One delivery option, so the fee is simply the standard charge, waived above
  // the free-delivery threshold. `place_order()` recomputes this from
  // store_settings and charges its own figure — this is display only.
  const deliveryFee = subtotalValue >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const total = Math.max(0, subtotalValue + deliveryFee - couponDiscount);

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
      setCouponMessage(!result.ok ? result.message : "Could not check that coupon right now. Please try again.");
      return;
    }
    setAppliedCoupon(couponCode.trim());
    setCouponDiscount(result.data.discount);
    setCouponMessage(`${"Coupon applied — you saved"} ${formatPrice(result.data.discount)}`);
  };

  const selectSavedAddress = (id: string) => {
    setSelectedAddressId(id);
    if (id === "new") return;
    const saved = savedAddresses.find((a) => a.id === id);
    if (!saved) return;
    setDivision(saved.division);
    setDistrict(saved.district);
    setAddress(saved.full_address);
    setPhone(saved.phone);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!fullName.trim()) next.fullName = "This field is required";
    // Accepts 01…, 880…, +880… with or without spaces and dashes, so a valid
    // Bangladeshi number is never rejected over formatting.
    if (!isValidBdPhone(phone)) next.phone = "Enter a valid Bangladesh mobile number, for example 01712345678.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address, or leave this blank.";
    if (!address.trim()) next.address = "This field is required";
    if (!agreeTerms) next.agreeTerms = "Please accept the Terms and Conditions to place your order.";
    // A code typed but never applied would otherwise be sent as-is and make
    // place_order() reject the entire order. Silently dropping it instead
    // would be worse: the customer would be charged full price without
    // being told. So ask, and let them choose.
    if (couponCode.trim() && !appliedCoupon) {
      next.coupon = "Press Apply to use your coupon code, or clear the box to continue without it.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Guards against a second submit slipping through between the click and
    // React re-rendering the disabled button.
    if (submitting) return;
    if (!validate()) return;
    if (items.length === 0) {
      setSubmitError("Your bag is empty.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const result = await placeCartOrderAction({
      customerName: fullName,
      customerEmail: email,
      customerPhone: normalizeBdPhone(phone) ?? phone,
      paymentMethod: "cash_on_delivery",
      customerNote: notes,
      shippingAddress: { division, district, fullAddress: address },
      couponCode: appliedCoupon,
      idempotencyKey: getIdempotencyKey(),
    }, items);

    if (!result.ok) {
      setSubmitting(false);
      setSubmitError(result.message);
      return;
    }
    if (!result.data) {
      setSubmitting(false);
      setSubmitError("Your order could not be placed. Nothing has been ordered — please try again.");
      return;
    }

    setOrderNumber(result.data.orderNumber);
    setTrackingToken(result.data.trackingToken);
    setOrderTotal(result.data.total);
    // The bag is emptied only once the order exists in the database. Clearing
    // it any earlier would lose the customer's selection if the order failed.
    clearBag();
  };

  if (orderNumber) {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <CheckCircle2 size={48} className="text-wine mx-auto mb-5" />
        <h1 className="font-serif text-3xl text-ink mb-3">{"Your order has been placed successfully!"}</h1>
        <p className="text-sm text-muted mb-6">{"Thank you for shopping with TARA. We will call you shortly to confirm your order, then deliver it to your address. You pay the delivery agent in cash when it arrives — nothing to pay now."}</p>
        <p className="text-sm text-ink mb-2">
          {"Order Number"}: <strong>{orderNumber}</strong>
        </p>
        {orderTotal != null && (
          <p className="text-sm text-ink mb-6">
            {"Total"}: <strong>{formatPrice(orderTotal)}</strong>
          </p>
        )}
        <p className="mb-8 break-all text-xs text-muted">{"Tracking token"}: <strong>{trackingToken}</strong></p>
        <Link href="/">
          <Button variant="secondary">{"Continue Shopping"}</Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink mb-3">{"Your bag is empty"}</h1>
        <p className="text-sm text-muted mb-8">{"Add items to your bag to see them here."}</p>
        <Link href="/new-arrivals">
          <Button variant="secondary">{"Continue Shopping"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Checkout" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">{"Checkout"}</h1>

      <form onSubmit={handleSubmit} noValidate className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 flex flex-col gap-10">
          <section>
            <h2 className="text-sm uppercase tracking-wide text-ink mb-4 pb-2 border-b border-border">
              {"Contact Information"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={"Full Name"}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
              />
              <Input
                label={"Phone Number"}
                required
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
              />
              <Input
                label={"Email Address"}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-ink mb-4 pb-2 border-b border-border">
              {"Shipping Address"}
            </h2>

            {savedAddresses.length > 0 && (
              <div className="mb-5 flex flex-col gap-2">
                {savedAddresses.map((saved) => (
                  <label
                    key={saved.id}
                    className="flex items-start gap-3 rounded-control border border-border px-4 py-3 cursor-pointer transition-colors has-[:checked]:border-wine"
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={selectedAddressId === saved.id}
                      onChange={() => selectSavedAddress(saved.id)}
                      className="mt-1 w-4 h-4 accent-wine shrink-0"
                    />
                    <span className="text-sm text-ink">
                      <strong>{saved.recipient_name}</strong> · {saved.phone}
                      <br />
                      <span className="text-muted">
                        {[saved.full_address, saved.area, saved.upazila, saved.district, saved.division]
                          .map((part) => part?.trim())
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-3 rounded-control border border-border px-4 py-3 cursor-pointer transition-colors has-[:checked]:border-wine">
                  <input
                    type="radio"
                    name="savedAddress"
                    checked={selectedAddressId === "new"}
                    onChange={() => selectSavedAddress("new")}
                    className="w-4 h-4 accent-wine shrink-0"
                  />
                  <span className="text-sm text-ink">{"Enter a new address"}</span>
                </label>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label={"Division"}
                value={division}
                disabled={selectedAddressId !== "new"}
                onChange={(e) => {
                  setDivision(e.target.value);
                  setDistrict(districtsByDivision[e.target.value][0]);
                }}
              >
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              <Select
                label={"District"}
                value={district}
                disabled={selectedAddressId !== "new"}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {(districtsByDivision[division] ?? []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              <Textarea
                label={"Full Address"}
                required
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={errors.address}
                disabled={selectedAddressId !== "new"}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-ink mb-4 pb-2 border-b border-border">
              {"Payment Method"}
            </h2>
            {/*
              Cash on delivery is the only method the store accepts, and the
              database refuses anything else outright. A radio group with one
              permanently selected option would imply a choice that does not
              exist, so the method is simply stated.
            */}
            <div className="rounded-control border border-wine/30 bg-beige/40 px-4 py-4">
              <p className="text-sm font-medium text-ink">{"Cash on Delivery"}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{"Pay in cash when your order is delivered to your door."}</p>
            </div>
          </section>

          <section>
            <Textarea
              label={"Order Notes (Optional)"}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        <div className="bg-beige/50 rounded-panel border border-border p-6 h-fit flex flex-col gap-4">
          <h2 className="font-serif text-xl text-ink mb-1">{"Order Summary"}</h2>
          <div className="flex flex-col gap-4 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-3">
                <div className="relative w-14 h-[70px] shrink-0 bg-white">
                  <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  <span className="absolute -top-2 -right-2 bg-wine text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-xs text-ink line-clamp-1">{item.name}</p>
                  <p className="text-xs text-muted">
                    {item.size} / {item.colour}
                  </p>
                </div>
                <span className="text-xs text-ink whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <label htmlFor="checkout-coupon" className="text-xs uppercase tracking-wide text-muted">
              {"Coupon Code"}
            </label>
            <div className="flex gap-2">
              <input
                id="checkout-coupon"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                disabled={couponDiscount > 0}
                className="h-11 flex-1 rounded-control border border-border bg-white px-3.5 text-sm focus:outline-none focus:border-wine transition-colors disabled:bg-beige/60 disabled:text-muted"
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
                <Button type="button" variant="outline" size="sm" onClick={handleApplyCoupon} loading={checkingCoupon}>
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

            <div className="flex items-center justify-between text-sm pt-2">
              <span className="text-muted">{"Subtotal"}</span>
              <span className="text-ink">{formatPrice(subtotalValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{"Delivery"}</span>
              <span className="text-ink">{formatPrice(deliveryFee)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{"Coupon Code"}</span>
                <span className="text-wine">-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base border-t border-border pt-3 mt-1">
              <span className="text-ink font-medium">{"Total"}</span>
              <span className="text-ink font-medium">{formatPrice(total)}</span>
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-muted mt-1">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-wine shrink-0"
            />
            {"I agree to the Terms and Conditions and Privacy Policy"}
          </label>
          {errors.agreeTerms && <p className="text-xs text-wine -mt-2">{errors.agreeTerms}</p>}

          {submitError && <p role="alert" className="text-xs text-wine">{submitError}</p>}
          <Button type="submit" fullWidth loading={submitting}>
            {"Place Order"}
          </Button>
        </div>
      </form>
    </Container>
  );
}
