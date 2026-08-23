"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye } from "lucide-react";
import type { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";
import { PriceDisplay } from "./PriceDisplay";
import { WishlistButton } from "./WishlistButton";
import { Button } from "@/components/ui/Button";
import { resolveCategoryLabel } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onQuickView: (product: Product) => void;
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { addToast } = useToastStore();
  const [hovered, setHovered] = useState(false);

  const secondaryImage = product.images[1] ?? product.images[0];

  const handleAddToBag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      size: product.sizes[0] ?? "One Size",
      colour: product.colours[0]?.name ?? "",
      quantity: 1,
    });
    addToast("Add to Cart");
  };

  return (
    <div
      className="group flex h-full flex-col rounded-control border border-border p-2 transition-colors hover:border-taraTaupe"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] shrink-0 rounded-control bg-beige overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine"
      >
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className={`object-cover transition-opacity duration-300 ${hovered && product.images[1] ? "opacity-0" : "opacity-100"}`}
        />
        {product.images[1] && (
          <Image
            src={secondaryImage}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={`object-cover transition-opacity duration-300 absolute inset-0 ${hovered ? "opacity-100" : "opacity-0"}`}
          />
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-taraRose text-taraBlack font-sans font-semibold text-[10px] uppercase tracking-wide px-2 py-1 rounded-control">
              {"New"}
            </span>
          )}
          {product.isSale && (
            <span className="bg-wine text-taraIvory font-sans font-semibold text-[10px] uppercase tracking-wide px-2 py-1 rounded-control">
              {"Sale"}
            </span>
          )}
          {product.stock === 0 && (
            <span className="bg-taraTaupe text-taraBlack font-sans font-semibold text-[10px] uppercase tracking-wide px-2 py-1 rounded-control">
              {"Out of Stock"}
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5">
          <WishlistButton product={product} />
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(product);
          }}
          className="hidden sm:flex items-center justify-center gap-1.5 absolute bottom-0 left-0 right-0 bg-white/95 text-ink font-sans font-semibold text-xs uppercase tracking-wide py-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200"
        >
          <Eye size={14} /> {"Quick View"}
        </button>
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-sans font-medium text-[13px] sm:text-sm text-ink hover:text-wine transition-colors line-clamp-2 min-h-[2.5rem] leading-snug">
            {product.name}
          </h3>
        </Link>
        <p className="font-sans font-normal text-xs text-muted mt-1">
          {resolveCategoryLabel(product)}
        </p>
        <div className="mt-1.5">
          <PriceDisplay price={product.price} previousPrice={product.previousPrice} />
        </div>

        {(product.colours.length > 1 || product.sizes.length > 1) && (
          <div className="mt-2 flex flex-col gap-1.5">
            {product.colours.length > 1 && (
              <div className="flex items-center gap-1.5">
                {product.colours.map((c) => (
                  <span
                    key={c.name}
                    className="w-3.5 h-3.5 rounded-full border border-border/70"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
            {product.sizes.length > 1 && (
              <p className="text-[11px] text-muted">{product.sizes.join(" · ")}</p>
            )}
          </div>
        )}

        <div className="mt-auto pt-3">
          <Button
            onClick={handleAddToBag}
            size="sm"
            fullWidth
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
