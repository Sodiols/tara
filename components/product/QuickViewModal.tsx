"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { PriceDisplay } from "./PriceDisplay";
import { SizeSelector } from "./SizeSelector";
import { ColourSelector } from "./ColourSelector";
import { QuantitySelector } from "./QuantitySelector";
import { Button } from "@/components/ui/Button";
import { useAddToCart } from "@/hooks/useAddToCart";
import { hasSelectableSizes } from "@/lib/product-size";
import type { Product } from "@/types";

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
}

export function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const addToCart = useAddToCart();
  const [size, setSize] = useState(product?.sizes[0] ?? "");
  const [colour, setColour] = useState(product?.colours[0]?.name ?? "");
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleAddToBag = () => {
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0],
        price: product.price,
        size: size || product.sizes[0],
        colour: colour || product.colours[0]?.name || "",
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
          {hasSelectableSizes(product.sizes) && (
            <SizeSelector sizes={product.sizes} selected={size} onChange={setSize} />
          )}
          {product.colours.length > 0 && (
            <ColourSelector colours={product.colours} selected={colour} onChange={setColour} />
          )}
          <QuantitySelector quantity={quantity} onChange={setQuantity} max={product.stock} />
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={handleAddToBag} fullWidth>
              {"Add to Cart"}
            </Button>
            <Link href={`/product/${product.slug}`} onClick={onClose}>
              <Button variant="outline" fullWidth>
                {"Description"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
