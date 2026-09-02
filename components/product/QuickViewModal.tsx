"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { PriceDisplay } from "./PriceDisplay";
import { QuantitySelector } from "./QuantitySelector";
import { Button } from "@/components/ui/Button";
import { useAddToCart } from "@/hooks/useAddToCart";
import { requiresVariantChoice } from "@/lib/product-variants";
import { ONE_SIZE } from "@/lib/product-size";
import { MAX_LINE_QUANTITY } from "@/store/cartStore";
import type { Product } from "@/types";

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
}

/**
 * A preview, and — only when it is safe — a one-tap add.
 *
 * IT NO LONGER PICKS A VARIANT
 * ----------------------------
 * This used to render a size row and a colour row built from `product.sizes`
 * and `product.colours`, which are `distinct` summaries with the pairing thrown
 * away, and add whatever pair the shopper landed on. For a product stocked as
 * 38/Black, 40/Maroon and 42/Black that offers (40, Black) — a row that does
 * not exist — and the order was refused at the end of checkout.
 *
 * A listing does not carry the variant matrix and should not: attaching it to
 * every one of 24 rows to serve a modal that is usually never opened is the
 * wrong trade. So the rule is the honest one — if there is exactly one possible
 * combination, add it; otherwise send the shopper to the product page, which
 * has the matrix and can offer a real choice.
 */
export function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const needsChoice = requiresVariantChoice(product);
  const soldOut = product.stock === 0;
  const maxQuantity = Math.max(0, Math.min(MAX_LINE_QUANTITY, product.stock));

  const handleAddToBag = () => {
    if (needsChoice || soldOut) return;
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0],
        price: product.price,
        size: product.sizes[0] ?? ONE_SIZE,
        colour: product.colours[0]?.name ?? "",
        quantity,
      },
      // The modal is already a full-screen overlay on a phone; closing it only
      // to open the drawer behind it would be two panels for one tap.
      { openDrawer: false },
    );
    onClose();
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} title={product.name} maxWidthClass="max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="relative aspect-[4/5] bg-beige">
          <Image src={product.images[0]} alt={product.name} fill sizes="400px" className="object-cover" />
        </div>
        <div className="flex flex-col gap-4">
          <PriceDisplay price={product.price} previousPrice={product.previousPrice} size="lg" />
          <p className="text-sm text-muted">{product.description}</p>

          {needsChoice ? (
            <p className="text-sm text-muted">
              {"This piece comes in more than one option. Choose a size and colour on the product page."}
            </p>
          ) : (
            <QuantitySelector quantity={quantity} onChange={setQuantity} max={maxQuantity} />
          )}

          <div className="flex flex-col gap-2 mt-2">
            {needsChoice ? (
              <Link href={`/product/${product.slug}`} onClick={onClose}>
                <Button fullWidth>{"Choose Options"}</Button>
              </Link>
            ) : (
              <Button onClick={handleAddToBag} fullWidth disabled={soldOut}>
                {soldOut ? "Out of Stock" : "Add to Cart"}
              </Button>
            )}
            <Link href={`/product/${product.slug}`} onClick={onClose}>
              <Button variant="outline" fullWidth>
                {"Full Details"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
