"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useToastStore } from "@/store/toastStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { previewCouponAction } from "@/lib/supabase/actions/checkout";
import { freeDeliveryHeadline, quoteDelivery, type DeliverySettings } from "@/lib/delivery";

interface BagClientProps {
  deliverySettings: DeliverySettings;
}

export function BagClient({ deliverySettings }: BagClientProps) {
  const { items, removeItem, updateQuantity, subtotal } = useCartStore();
  const addWishlistItem = useWishlistStore((s) => s.addItem);
  const { addToast } = useToastStore();
  const [coupon, setCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const subtotalValue = subtotal();
  // The destination is not known until checkout, so the bag quotes the rate for
  // the free-delivery division -- the lowest the customer could pay -- and says
  // so. Quoting a single flat fee here, as this page used to, was wrong for
  // everyone outside Sylhet and wrong again for everyone inside it who had
  // passed the threshold.
  const deliveryQuote = quoteDelivery(
    subtotalValue,
    deliverySettings.freeDeliveryDivision,
    deliverySettings,
  );
  const deliveryFee = subtotalValue === 0 ? 0 : deliveryQuote.fee;
  const total = Math.max(0, subtotalValue + deliveryFee - couponDiscount);
  const deliveryHeadline = freeDeliveryHeadline(deliverySettings);

  const handleMoveToWishlist = (item: (typeof items)[number]) => {
    addWishlistItem({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      image: item.image,
      price: item.price,
    });
    removeItem(item.productId, item.size, item.colour);
    addToast("Move to Bag");
  };

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) {
      setCouponDiscount(0);
      setCouponMessage("Enter a coupon code first.");
      return;
    }
    setCheckingCoupon(true);
    const result = await previewCouponAction(coupon.trim(), subtotalValue);
    setCheckingCoupon(false);
    if (!result.ok || !result.data) {
      setCouponDiscount(0);
      setCouponMessage(!result.ok ? result.message : "Could not check that coupon right now. Please try again.");
      return;
    }
    setCouponDiscount(result.data.discount);
    setCouponMessage(`${"Coupon applied — you saved"} ${formatPrice(result.data.discount)}`);
  };

  const handleRemoveCoupon = () => {
    setCoupon("");
    setCouponDiscount(0);
    setCouponMessage("");
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Shopping Bag" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">{"Shopping Bag"}</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          heading={"Your bag is empty"}
          text={"Add items to your bag to see them here."}
          action={
            <Link href="/new-arrivals">
              <Button variant="secondary">{"Continue Shopping"}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 flex flex-col divide-y divide-border">
            {items.map((item) => (
              <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-4 py-6 first:pt-0">
                <Link href={`/product/${item.slug}`} className="relative w-24 h-[120px] sm:w-28 sm:h-[140px] shrink-0 bg-beige">
                  <Image src={item.image} alt={item.name} fill sizes="120px" className="object-cover" />
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between gap-2">
                    <Link href={`/product/${item.slug}`} className="text-sm sm:text-base text-ink hover:text-wine">
                      {item.name}
                    </Link>
                    <span className="text-sm sm:text-base text-ink whitespace-nowrap">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {item.size} / {item.colour}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3">
                    <div className="flex items-center rounded-control border border-border">
                      <button
                        aria-label="Decrease quantity"
                        className="p-2.5 hover:bg-beige transition-colors"
                        onClick={() => updateQuantity(item.productId, item.size, item.colour, item.quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        aria-label="Increase quantity"
                        className="p-2.5 hover:bg-beige transition-colors"
                        onClick={() => updateQuantity(item.productId, item.size, item.colour, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleMoveToWishlist(item)}
                        className="text-xs text-muted hover:text-ink underline underline-offset-2"
                      >
                        {"Move to Wishlist"}
                      </button>
                      <button
                        onClick={() => removeItem(item.productId, item.size, item.colour)}
                        className="text-xs text-muted hover:text-wine underline underline-offset-2"
                      >
                        {"Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-6">
              <Link href="/new-arrivals" className="text-sm text-ink underline underline-offset-2 hover:text-wine">
                {"Continue Shopping"}
              </Link>
            </div>
          </div>

          <div className="bg-beige/50 rounded-panel border border-border p-6 h-fit flex flex-col gap-4">
            <h2 className="font-serif text-xl text-ink mb-1">{"Shopping Bag"}</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{"Subtotal"}</span>
              <span className="text-ink">{formatPrice(subtotalValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{"Delivery"}</span>
              <span className="text-ink">
                {deliveryFee === 0 ? "Free" : `From ${formatPrice(deliveryFee)}`}
              </span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{"Coupon Code"}</span>
                <span className="text-wine">-{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <p className="text-xs text-muted -mt-2">
              {"The exact delivery charge depends on your division and is confirmed at checkout."}
            </p>
            {deliveryHeadline && (
              <p className="text-xs text-muted -mt-2">{deliveryHeadline}</p>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <label htmlFor="coupon" className="text-xs uppercase tracking-wide text-muted">
                {"Coupon Code"}
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  disabled={couponDiscount > 0}
                  className="h-11 flex-1 rounded-control border border-border bg-white px-3.5 text-sm focus:outline-none focus:border-wine transition-colors disabled:bg-beige/60 disabled:text-muted"
                />
                {couponDiscount > 0 ? (
                  <Button variant="outline" size="sm" onClick={handleRemoveCoupon}>
                    {"Remove coupon"}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleApplyCoupon} loading={checkingCoupon}>
                    {"Apply"}
                  </Button>
                )}
              </div>
              {couponMessage && <p className="text-xs text-wine">{couponMessage}</p>}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 text-base">
              <span className="text-ink font-medium">{"Total"}</span>
              <span className="text-ink font-medium">{formatPrice(total)}</span>
            </div>

            <Link href="/checkout">
              <Button fullWidth>{"Proceed to Checkout"}</Button>
            </Link>
          </div>
        </div>
      )}
    </Container>
  );
}
