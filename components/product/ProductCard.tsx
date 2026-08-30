"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, ShoppingBag } from "lucide-react";
import type { Product } from "@/types";
import { useAddToCart } from "@/hooks/useAddToCart";
import { PriceDisplay } from "./PriceDisplay";
import { WishlistButton } from "./WishlistButton";
import { resolveCategoryLabel } from "@/lib/utils";
import { ONE_SIZE, hasSelectableSizes, sortSizes } from "@/lib/product-size";

interface ProductCardProps {
  product: Product;
  onQuickView: (product: Product) => void;
}

/**
 * The product card, used by every listing on the site.
 *
 * One component, rendered by ProductGrid and ProductCarousel, which between
 * them cover the homepage rails, the category listings, search, related
 * products, recently viewed and the wishlist. There is deliberately no second
 * implementation — a card that looks different on the homepage than in search
 * is how a catalogue stops feeling like one shop.
 *
 * THE SHAPE
 * ---------
 * The photograph is the product. It takes the top of the card at a fixed 3:4
 * crop — fixed so that a hundred different uploads still line up in a grid —
 * and everything else is quiet supporting text underneath: what it is, what
 * kind, what it costs, what sizes exist. 3:4 rather than 4:5 because the image
 * has to carry roughly two thirds of the card's height to read as the subject;
 * at 4:5 it measured 58% and the card looked like a text block with a picture
 * on top. The skeleton uses the same ratio, so nothing shifts on load.
 *
 * The two actions are separated on purpose. The wishlist sits beside the title
 * as a light, reversible "keep this"; the bag sits at the bottom right in Deep
 * Wine as the one committing action on the card. Both are real buttons that
 * stop the event, so neither can fire the link they are nested inside.
 *
 * EQUAL HEIGHTS
 * -------------
 * `h-full` plus `flex-1` on the body and `mt-auto` on the action row means a
 * two-line title and a one-line title produce the same card height, with the
 * price and bag aligned across the row. Nothing is a fixed pixel height, so
 * this survives a long Bangla product name and a narrow phone equally.
 */
export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const addToCart = useAddToCart();
  const [hovered, setHovered] = useState(false);

  const secondaryImage = product.images[1] ?? product.images[0];
  const soldOut = product.stock === 0;
  // Placeholder sizes ("Unready", "One Size") are not sizes a customer chooses
  // between, so they are not advertised as if they were.
  const showSizes = hasSelectableSizes(product.sizes);

  const handleAddToBag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      size: product.sizes[0] ?? ONE_SIZE,
      colour: product.colours[0]?.name ?? "",
      quantity: 1,
    });
  };

  return (
    // The card itself does not react to hover: no lift, no shadow change, no
    // scale. The only hover behaviour is the second product photograph and the
    // quick view control, both of which are content rather than decoration.
    <article
      className="group flex h-full flex-col rounded-[24px] border border-taraTaupe/25 bg-taraWhite p-2 shadow-[0_2px_10px_-8px_rgb(23_23_23/0.18)] sm:rounded-[28px] sm:p-2.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[3/4] shrink-0 overflow-hidden rounded-[18px] bg-taraIvory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine sm:rounded-[22px]"
      >
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition-opacity duration-300 ${
            hovered && product.images[1] ? "opacity-0" : "opacity-100"
          }`}
        />
        {product.images[1] && hovered && (
          <Image
            src={secondaryImage}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="absolute inset-0 object-cover"
          />
        )}

        {/*
          Merchandising state, from the database — never hardcoded. Sold out is
          listed first because it is the one a customer must see before they
          form any intention about the product.
        */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {soldOut && (
            <span className="rounded-full bg-taraTaupe px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-taraBlack">
              {"Sold Out"}
            </span>
          )}
          {product.isSale && !soldOut && (
            <span className="rounded-full bg-wine px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-taraIvory">
              {"Sale"}
            </span>
          )}
          {product.isNew && !soldOut && (
            <span className="rounded-full bg-taraRose px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-taraBlack">
              {"New"}
            </span>
          )}
        </div>

        {/*
          Quick view stays a hover affordance on pointer devices only: on a
          phone there is no hover to reveal it, and a permanently visible bar
          would cover the photograph the card exists to show.
        */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(product);
          }}
          className="absolute bottom-0 left-0 right-0 hidden translate-y-full items-center justify-center gap-1.5 bg-taraWhite/95 py-2.5 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-transform duration-200 group-hover:translate-y-0 focus-visible:translate-y-0 sm:flex"
        >
          <Eye size={14} aria-hidden="true" /> {"Quick View"}
        </button>
      </Link>

      <div className="flex flex-1 flex-col px-1.5 pb-0.5 pt-2.5 sm:px-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/product/${product.slug}`}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine"
            >
              {/*
                Two lines, always reserved. A one-line and a two-line name must
                not push the price to different heights in adjacent cards.
              */}
              <h3 className="line-clamp-2 min-h-[2.5rem] font-sans text-[15px] font-semibold leading-snug text-ink transition-colors hover:text-wine sm:min-h-[2.7rem] sm:text-[17px]">
                {product.name}
              </h3>
            </Link>
            <p className="mt-0.5 font-sans text-[12px] font-normal text-taraTaupe sm:text-[13px]">
              {resolveCategoryLabel(product)}
            </p>
          </div>

          <WishlistButton product={product} variant="card" className="mt-0.5" />
        </div>

        {/* Pushed to the bottom so price and bag align across a row of cards. */}
        <div className="mt-auto pt-2.5">
          {(showSizes || product.colours.length > 1) && (
            <div className="mb-2 flex items-center justify-between gap-2">
              {showSizes ? (
                <p className="truncate font-sans text-[11px] uppercase tracking-[0.12em] text-taraTaupe sm:text-[12px]">
                  {sortSizes(product.sizes).join("  ")}
                </p>
              ) : (
                <span />
              )}
              {product.colours.length > 1 && (
                <span className="flex shrink-0 items-center gap-1">
                  {product.colours.slice(0, 4).map((colour) => (
                    <span
                      key={colour.name}
                      title={colour.name}
                      className="h-2.5 w-2.5 rounded-full border border-taraTaupe/40"
                      style={{ backgroundColor: colour.hex }}
                    />
                  ))}
                </span>
              )}
            </div>
          )}

          <div className="flex items-end justify-between gap-2">
            <PriceDisplay
              price={product.price}
              previousPrice={product.previousPrice}
              size="card"
            />
            <button
              type="button"
              onClick={handleAddToBag}
              disabled={soldOut}
              aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to bag`}
              title={soldOut ? "Sold out" : "Add to bag"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-wine text-taraIvory transition-colors duration-200 hover:bg-taraBlack focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:cursor-not-allowed disabled:bg-taraTaupe/40 disabled:text-taraBlack/50 sm:h-11 sm:w-11 sm:rounded-[16px]"
            >
              <ShoppingBag size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
