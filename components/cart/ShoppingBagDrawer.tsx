"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { lockBodyScroll } from "@/lib/scroll-lock";

export function ShoppingBagDrawer() {
  const { items, isOpen, closeBag, removeItem, updateQuantity, subtotal } = useCartStore();

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 animate-fadeIn" onClick={closeBag} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white animate-slideInRight flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">
            {"Shopping Bag"} ({items.length})
          </h2>
          <button onClick={closeBag} aria-label={"Close"} className="p-1 text-ink">
            <X size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={ShoppingBag}
              heading={"Your bag is empty"}
              text={"Add items to your bag to see them here."}
              action={
                <Button variant="secondary" onClick={closeBag}>{"Continue Shopping"}</Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size}-${item.colour}`} className="flex gap-4">
                  <div className="relative w-20 h-[100px] shrink-0 bg-beige">
                    <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <Link href={`/product/${item.slug}`} onClick={closeBag} className="text-sm text-ink hover:text-wine">
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {item.size} / {item.colour}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center rounded-control border border-border">
                        <button
                          aria-label="Decrease quantity"
                          className="p-1.5 hover:bg-beige transition-colors"
                          onClick={() => updateQuantity(item.productId, item.size, item.colour, item.quantity - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-xs">{item.quantity}</span>
                        <button
                          aria-label="Increase quantity"
                          className="p-1.5 hover:bg-beige transition-colors"
                          onClick={() => updateQuantity(item.productId, item.size, item.colour, item.quantity + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-sm text-ink">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId, item.size, item.colour)}
                      className="text-xs text-muted hover:text-wine underline underline-offset-2 self-start mt-1"
                    >
                      {"Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-5 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{"Subtotal"}</span>
                <span className="text-ink font-medium">{formatPrice(subtotal())}</span>
              </div>
              <p className="text-xs text-muted">{"Free delivery in Sylhet on orders above ৳1500"}</p>
              <Link href="/bag" onClick={closeBag}>
                <Button variant="secondary" fullWidth>
                  {"Shopping Bag"}
                </Button>
              </Link>
              <Link href="/checkout" onClick={closeBag}>
                <Button fullWidth>{"Proceed to Checkout"}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
