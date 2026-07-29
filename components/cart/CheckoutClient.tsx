"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useCartStore } from "@/store/cartStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
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
  const { t, pick } = useLanguage();
  const { items, subtotal, clearBag } = useCartStore();
  const {
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    standardDeliveryFee: STANDARD_DELIVERY_FEE,
    expressDeliveryFee: EXPRESS_DELIVERY_FEE,
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
  const [upazila, setUpazila] = useState(defaultSavedAddress?.upazila ?? "");
  const [area, setArea] = useState(defaultSavedAddress?.area ?? "");
  const [address, setAddress] = useState(defaultSavedAddress?.full_address ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [notes, setNotes] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const subtotalValue = subtotal();
  const deliveryFee =
    subtotalValue >= FREE_DELIVERY_THRESHOLD && deliveryMethod === "standard"
      ? 0
      : deliveryMethod === "express"
      ? EXPRESS_DELIVERY_FEE
      : STANDARD_DELIVERY_FEE;
  const total = Math.max(0, subtotalValue + deliveryFee - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponDiscount(0);
      setCouponMessage(t("bag.errors.couponRequired"));
      return;
    }
    setCheckingCoupon(true);
    const result = await previewCouponAction(couponCode.trim(), subtotalValue);
    setCheckingCoupon(false);
    if (!result.ok || !result.data) {
      setCouponDiscount(0);
      setCouponMessage(t(!result.ok ? result.message : "bag.errors.couponFailed"));
      return;
    }
    setCouponDiscount(result.data.discount);
    setCouponMessage(`${t("bag.couponApplied")} ${formatPrice(result.data.discount)}`);
  };

  const selectSavedAddress = (id: string) => {
    setSelectedAddressId(id);
    if (id === "new") return;
    const saved = savedAddresses.find((a) => a.id === id);
    if (!saved) return;
    setDivision(saved.division);
    setDistrict(saved.district);
    setUpazila(saved.upazila);
    setArea(saved.area);
    setAddress(saved.full_address);
    setPhone(saved.phone);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!fullName.trim()) next.fullName = t("common.required");
    if (!/^01[3-9]\d{8}$/.test(phone.replace(/\s/g, ""))) next.phone = t("common.required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("common.required");
    if (!upazila.trim()) next.upazila = t("common.required");
    if (!area.trim()) next.area = t("common.required");
    if (!address.trim()) next.address = t("common.required");
    if (!agreeTerms) next.agreeTerms = t("common.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    const result = await placeCartOrderAction({
      customerName: fullName,
      customerEmail: email,
      customerPhone: phone,
      deliveryMethod,
      paymentMethod: "cash_on_delivery",
      customerNote: notes,
      shippingAddress: { division, district, upazila, area, fullAddress: address },
      couponCode,
    }, items);
    setSubmitting(false);
    if (!result.ok) return setSubmitError(t(result.message));
    if (!result.data) return setSubmitError(t("checkout.errors.orderFailed"));
    setOrderNumber(result.data.orderNumber);
    setTrackingToken(result.data.trackingToken);
    setOrderTotal(result.data.total);
    clearBag();
  };

  if (orderNumber) {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <CheckCircle2 size={48} className="text-wine mx-auto mb-5" />
        <h1 className="font-serif text-3xl text-ink mb-3">{t("checkout.orderSuccess")}</h1>
        <p className="text-sm text-muted mb-6">{t("checkout.orderSuccessText")}</p>
        <p className="text-sm text-ink mb-2">
          {t("checkout.orderNumber")}: <strong>{orderNumber}</strong>
        </p>
        {orderTotal != null && (
          <p className="text-sm text-ink mb-6">
            {t("bag.total")}: <strong>{formatPrice(orderTotal)}</strong>
          </p>
        )}
        <p className="mb-8 break-all text-xs text-muted">{t("account.trackingToken")}: <strong>{trackingToken}</strong></p>
        <Link href="/">
          <Button variant="secondary">{t("bag.continueShopping")}</Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-5 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink mb-3">{t("bag.empty")}</h1>
        <p className="text-sm text-muted mb-8">{t("bag.emptyText")}</p>
        <Link href="/new-arrivals">
          <Button variant="secondary">{t("bag.continueShopping")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("checkout.heading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">{t("checkout.heading")}</h1>

      <form onSubmit={handleSubmit} noValidate className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 flex flex-col gap-10">
          <section>
            <h2 className="text-sm uppercase tracking-wide text-ink mb-4 pb-2 border-b border-border">
              {t("checkout.contactInfo")}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t("checkout.fullName")}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
              />
              <Input
                label={t("checkout.phone")}
                required
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
              />
              <Input
                label={t("checkout.email")}
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
              {t("checkout.shippingAddress")}
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
                        {saved.full_address}, {saved.area}, {saved.upazila}, {saved.district}, {saved.division}
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
                  <span className="text-sm text-ink">{t("checkout.newAddress")}</span>
                </label>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label={t("checkout.division")}
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
                label={t("checkout.district")}
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
              <Input
                label={t("checkout.upazila")}
                required
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                error={errors.upazila}
                disabled={selectedAddressId !== "new"}
              />
              <Input
                label={t("checkout.area")}
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                error={errors.area}
                disabled={selectedAddressId !== "new"}
              />
              <Textarea
                label={t("checkout.fullAddress")}
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
              {t("checkout.deliveryMethod")}
            </h2>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3 rounded-control border border-border px-4 h-[52px] cursor-pointer transition-colors has-[:checked]:border-wine">
                <span className="flex items-center gap-3 text-sm text-ink">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === "standard"}
                    onChange={() => setDeliveryMethod("standard")}
                    className="w-4 h-4 accent-wine"
                  />
                  {t("checkout.standardDelivery")}
                </span>
                <span className="text-sm text-muted">
                  {subtotalValue >= FREE_DELIVERY_THRESHOLD ? t("bag.freeDeliveryNote") : formatPrice(STANDARD_DELIVERY_FEE)}
                </span>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-control border border-border px-4 h-[52px] cursor-pointer transition-colors has-[:checked]:border-wine">
                <span className="flex items-center gap-3 text-sm text-ink">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === "express"}
                    onChange={() => setDeliveryMethod("express")}
                    className="w-4 h-4 accent-wine"
                  />
                  {t("checkout.expressDelivery")}
                </span>
                <span className="text-sm text-muted">{formatPrice(EXPRESS_DELIVERY_FEE)}</span>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-ink mb-4 pb-2 border-b border-border">
              {t("checkout.paymentMethod")}
            </h2>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 rounded-control border border-border bg-beige/40 px-4 h-[52px] cursor-not-allowed opacity-70">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="w-4 h-4 accent-wine"
                />
                <span className="text-sm text-ink">{t("checkout.cod")}</span>
              </label>
              <label className="flex items-center gap-3 rounded-control border border-border px-4 h-[52px] cursor-pointer transition-colors has-[:checked]:border-wine">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "online"}
                  onChange={() => undefined}
                  disabled
                  className="w-4 h-4 accent-wine"
                />
                <span className="text-sm text-ink">{t("checkout.onlinePayment")} — {t("checkout.comingSoon")}</span>
              </label>
            </div>
          </section>

          <section>
            <Textarea
              label={t("checkout.orderNotes")}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        <div className="bg-beige/50 rounded-panel border border-border p-6 h-fit flex flex-col gap-4">
          <h2 className="font-serif text-xl text-ink mb-1">{t("checkout.orderSummary")}</h2>
          <div className="flex flex-col gap-4 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-3">
                <div className="relative w-14 h-[70px] shrink-0 bg-white">
                  <Image src={item.image} alt={pick(item.name)} fill sizes="56px" className="object-cover" />
                  <span className="absolute -top-2 -right-2 bg-wine text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-xs text-ink line-clamp-1">{pick(item.name)}</p>
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
              {t("checkout.coupon")}
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
                    setCouponDiscount(0);
                    setCouponMessage("");
                  }}
                >
                  {t("bag.couponRemove")}
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={handleApplyCoupon} loading={checkingCoupon}>
                  {t("bag.applyCoupon")}
                </Button>
              )}
            </div>
            {couponMessage && <p className="text-xs text-wine">{couponMessage}</p>}

            <div className="flex items-center justify-between text-sm pt-2">
              <span className="text-muted">{t("bag.subtotal")}</span>
              <span className="text-ink">{formatPrice(subtotalValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t("bag.delivery")}</span>
              <span className="text-ink">{formatPrice(deliveryFee)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t("bag.coupon")}</span>
                <span className="text-wine">-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base border-t border-border pt-3 mt-1">
              <span className="text-ink font-medium">{t("bag.total")}</span>
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
            {t("checkout.termsAgree")}
          </label>
          {errors.agreeTerms && <p className="text-xs text-wine -mt-2">{errors.agreeTerms}</p>}

          {submitError && <p role="alert" className="text-xs text-wine">{submitError}</p>}
          <Button type="submit" fullWidth loading={submitting}>
            {t("checkout.placeOrder")}
          </Button>
        </div>
      </form>
    </Container>
  );
}
