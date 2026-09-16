"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Ruler, ShoppingBag } from "lucide-react";
import type { Product, ProductVariant } from "@/types";
import { useAddToCart } from "@/hooks/useAddToCart";
import { useProductVariants } from "@/hooks/useProductVariants";
import { formatPrice, resolveCategoryLabel } from "@/lib/utils";
import { ONE_SIZE, formatSizeLabel, hasSelectableSizes, sortSizes } from "@/lib/product-size";
import { colourIdForName, mediaForColour } from "@/lib/product-colour-images";
import {
  findVariant,
  maxQuantityFor,
  requiresVariantChoice,
  sizeChoices,
} from "@/lib/product-variants";
import { primaryImageAlt } from "@/lib/product-media";
import { LaunchOfferBadge } from "@/components/offer/LaunchOfferNote";
import { MAX_LINE_QUANTITY } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onQuickView: (product: Product) => void;
  /**
   * How urgently the main photograph is fetched. Cards in the first rows of a
   * listing are on screen immediately, and a lazy image there waits for layout
   * before it even starts downloading — on a category page that photograph is
   * the largest thing on the first screen.
   */
  imagePriority?: "high" | "eager";
}

/**
 * The product card, used by every listing on the site.
 *
 * One component, rendered by ProductGrid and ProductCarousel, which between
 * them cover the homepage rails, the category listings, search, related
 * products and recently viewed. There is deliberately no second implementation
 * — a card that looks different on the homepage than in search is how a
 * catalogue stops feeling like one shop.
 *
 * THE TWO LAYOUTS ARE ONE COMPONENT
 * ---------------------------------
 * From `sm` up the card is a small buying surface: title and price on one row,
 * category and colours on the next, then the sizes and a full-width Add to
 * cart. Below `sm` the size row is not rendered at all — a size control in a
 * two-across phone grid is a row of 30px tap targets, which is worse than no
 * control — and the card becomes title, category, then price and colours on one
 * row above the button. Same markup, same data, one breakpoint.
 *
 * WHAT IT MAY DECIDE, AND WHAT IT MAY NOT
 * ---------------------------------------
 * A listing carries the FLATTENED summary of the variant matrix: `sizes` and
 * `colours` are `distinct` lists with the pairing thrown away. A card that adds
 * `sizes[0] + colours[0]` to the bag therefore invents combinations — for a
 * product stocked as 38/Black, 40/Maroon, 42/Black it offers (40, Black), which
 * has no row, and the customer finds out at the end of checkout.
 *
 * So the card shows the summary, and the moment a customer touches a size or a
 * colour it fetches the real matrix for that one product (see
 * hooks/useProductVariants.ts). From then on availability, the effective price
 * and the exact `variantId` come from real rows. If the matrix cannot be
 * loaded, or the selection still does not identify exactly one purchasable
 * variant, the card does what it has always done: it opens Quick View rather
 * than guessing.
 */
export function ProductCard({ product, onQuickView, imagePriority }: ProductCardProps) {
  const addToCart = useAddToCart();
  const { variants, load } = useProductVariants(product.id);

  // The colour a customer has picked on the card. Undefined means "as shipped"
  // — the product's own primary photograph, which is what a grid should show
  // until somebody expresses an interest.
  const [chosenColour, setChosenColour] = useState<string | null>(null);
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);

  const soldOut = product.stock === 0;
  const sizes = useMemo(() => sortSizes(product.sizes), [product.sizes]);
  // Placeholder sizes ("One Size", "Unready") are not a choice, so no selector.
  const showSizes = hasSelectableSizes(product.sizes);
  const showColours = product.colours.length > 1;
  const needsChoice = requiresVariantChoice(product);

  const colourName = chosenColour ?? product.colours[0]?.name ?? "";
  const colourId = useMemo(
    () => (variants ? colourIdForName(variants, colourName) : product.colours.find((c) => c.name === colourName)?.id ?? null),
    [variants, colourName, product.colours],
  );

  /*
   * The photograph follows the swatch.
   *
   * `mediaForColour` is the same rule the product page uses, so a colour with
   * its own photographs shows them and a colour without falls back to the
   * general ones. A product whose images predate colours keeps showing exactly
   * what it showed before.
   */
  const colourImages = useMemo(() => {
    const group = mediaForColour(product.media, colourId).map((image) => image.url);
    return group.length > 0 ? group : product.images;
  }, [product.media, colourId, product.images]);

  const displayImage = colourImages[0] ?? product.images[0];
  // The second photograph of the SELECTED colour, so the hover swap never
  // shows another colourway's picture.
  const hoverImage = colourImages[1];

  // Availability per size, once the matrix is known. Before that every size the
  // summary advertises is offered, which is what the card has always done.
  const sizeAvailability = useMemo(() => {
    if (!variants) return null;
    return new Map(
      sizeChoices(variants, showColours ? colourName : "").map((choice) => [
        choice.size,
        choice.selectable,
      ]),
    );
  }, [variants, colourName, showColours]);

  const selectedVariant = variants && chosenSize
    ? findVariant(variants, chosenSize, showColours ? colourName : variants.find((v) => v.size === chosenSize)?.colour?.name ?? "")
    : null;

  const displayPrice = selectedVariant?.price ?? product.price;

  const openOptions = () => {
    // Fired on the first hover, focus or touch of the options area, so the
    // matrix is usually already there by the time anything is clicked.
    void load();
  };

  /** The rows still standing after the customer's choices are applied. */
  const narrowTo = (matrix: ProductVariant[]) => {
    const size = chosenSize ?? (sizes.length === 1 ? sizes[0] : null);
    const colour = showColours ? colourName : null;
    return matrix.filter(
      (variant) =>
        (size === null || variant.size === size) &&
        (colour === null || variant.colour?.name === colour),
    );
  };

  const handleAddToCart = async () => {
    if (soldOut || busy) return;

    /*
     * Prefer a real row whenever one is already in hand.
     *
     * The matrix is usually loaded by the time this runs — hovering the card
     * fetches it — and a line that carries `variantId` is the one checkout can
     * resolve without matching display strings. Costs nothing when it is
     * already there and never waits for it here.
     */
    const known = variants ? narrowTo(variants) : [];
    if (known.length === 1 && maxQuantityFor(known[0], MAX_LINE_QUANTITY) > 0) {
      addToCart(cartLineFor(known[0]));
      return;
    }

    // The simple case: one size, one colour, nothing to choose. This is the
    // path most of the catalogue takes and it needs no extra request — the
    // behaviour the card had before it could resolve variants at all.
    if (!needsChoice) {
      addToCart({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: displayImage,
        price: product.price,
        size: product.sizes[0] ?? ONE_SIZE,
        colour: product.colours[0]?.name ?? "",
        quantity: 1,
      });
      return;
    }

    setBusy(true);
    const matrix = variants ?? (await load());
    setBusy(false);

    // No matrix, or the customer has not narrowed it to one row: Quick View is
    // the honest answer, the same as before this card had selectors.
    if (!matrix || matrix.length === 0) {
      onQuickView(product);
      return;
    }

    const candidates = narrowTo(matrix);
    if (candidates.length !== 1 || !candidates[0].available) {
      onQuickView(product);
      return;
    }

    const variant = candidates[0];
    if (maxQuantityFor(variant, MAX_LINE_QUANTITY) < 1) {
      onQuickView(product);
      return;
    }

    addToCart(cartLineFor(variant));
  };

  /** One purchasable row, as a cart line. */
  function cartLineFor(variant: ProductVariant) {
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: displayImage,
      // The variant's effective price, so the bag shows what checkout charges.
      price: variant.price,
      size: variant.size || ONE_SIZE,
      colour: variant.colour?.name ?? "",
      quantity: 1,
      // The identity that makes this line exactly one database row.
      variantId: variant.id,
    };
  }

  const alt = primaryImageAlt(product);

  return (
    /*
     * White card, generous outer radius, no border at all.
     *
     * Depth is two very light shadows rather than one dark one: a wide, soft
     * fall that lifts the card off an ivory section, and a 2px contact shadow
     * that keeps the bottom edge defined on white. Both are well under 20%
     * opacity, so the card reads as raised rather than outlined — which is the
     * whole point of dropping the border.
     */
    <article
      className="group flex h-full flex-col overflow-hidden rounded-[22px] bg-taraWhite shadow-[0_6px_22px_-12px_rgb(23_23_23/0.16),0_2px_6px_-4px_rgb(23_23_23/0.06)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative m-2 block shrink-0 overflow-hidden rounded-[16px] bg-taraIvory/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine sm:m-2.5"
      >
        {/*
          3:4, kept from the previous card on purpose. The reference photograph
          is a shoe on a landscape crop; TARA sells clothing shot in portrait,
          and a landscape frame cuts a kameez off at the waist. The container is
          the reference's — pale neutral, softly rounded, dominant — and
          `object-cover` fills it without distorting the garment.
        */}
        <div className="relative aspect-[3/4] w-full">
          <Image
            src={displayImage}
            alt={alt}
            fill
            loading={imagePriority ? "eager" : "lazy"}
            fetchPriority={imagePriority === "high" ? "high" : undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-opacity duration-300",
              hovered && hoverImage ? "opacity-0" : "opacity-100",
            )}
          />
          {hoverImage && hovered && (
            <Image
              src={hoverImage}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="absolute inset-0 object-cover"
            />
          )}
        </div>

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
          {/* Nothing unless a launch offer is live AND this product is in it. */}
          {!soldOut && <LaunchOfferBadge productId={product.id} />}
        </div>

        {/*
          Quick view stays a hover affordance on pointer devices only: on a
          phone there is no hover to reveal it, and a permanently visible bar
          would cover the photograph the card exists to show. It shows nothing
          at rest, so the card still reads exactly as the reference draws it.
        */}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onQuickView(product);
          }}
          className="absolute bottom-0 left-0 right-0 hidden translate-y-full items-center justify-center gap-1.5 bg-taraWhite/95 py-2.5 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-transform duration-200 group-hover:translate-y-0 focus-visible:translate-y-0 sm:flex"
        >
          <Eye size={14} aria-hidden="true" /> {"Quick View"}
        </button>
      </Link>

      <div
        className="flex flex-1 flex-col px-3 pb-3 sm:px-3.5 sm:pb-3.5"
        onMouseEnter={openOptions}
        onFocusCapture={openOptions}
        onTouchStart={openOptions}
      >
        {/*
          ROW 1 — title and price.

          On a phone the two are stacked (title, category, then price beside the
          swatches) because a 44px-wide price column beside a truncated title
          leaves neither readable. From `sm` they share the row, as in the
          reference: title left, price hard right, baselines aligned.
        */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/product/${product.slug}`}
            className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine"
          >
            {/*
              One line, cut with an ellipsis. The title itself is never changed —
              `truncate` is overflow handling, so the full name stays in the DOM
              for a crawler and in the `title` attribute for a customer.
            */}
            <h3
              title={product.name}
              className="truncate font-sans text-[15px] font-semibold leading-snug text-ink transition-colors hover:text-wine sm:text-[16px]"
            >
              {product.name}
            </h3>
          </Link>
          <span className="hidden shrink-0 font-sans text-[16px] font-bold leading-snug text-ink sm:block">
            {formatPrice(displayPrice)}
          </span>
        </div>

        {/*
          ROW 2 — category and colours.

          The swatches sit under the price on a wide card, which is the
          reference's arrangement; on a phone they move down to sit beside the
          price instead, so this row is category alone.
        */}
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-sans text-[12px] font-normal leading-tight text-muted sm:text-[13px]">
            {resolveCategoryLabel(product)}
          </p>
          {showColours && (
            <Swatches
              product={product}
              selected={colourName}
              onSelect={(name) => {
                setChosenColour(name);
                void load();
              }}
              className="hidden sm:flex"
            />
          )}
        </div>

        {/* ROW 3 and 4 — sizes. Desktop only, and only when sizes are real. */}
        {showSizes && (
          <div className="mt-3 hidden sm:block">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-[13px] font-semibold leading-none text-ink">
                Select Size
              </span>
              <Link
                href="/size-guide"
                className="inline-flex shrink-0 items-center gap-1 font-sans text-[12px] leading-none text-muted underline underline-offset-4 transition-colors hover:text-wine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine"
              >
                <Ruler size={13} aria-hidden="true" />
                Size Guide
              </Link>
            </div>

            {/*
              One row, never wrapping, and never stretched.

              The buttons share whatever width the card has (`flex-1 basis-0`,
              `min-w-0`), so eight sizes fit a 235px card without a scrollbar
              and without wrapping onto a second line — which would make cards
              in a grid different heights. The `max-w` is what stops the other
              end of the range looking wrong: a product sold in one size used to
              get a single chip stretched across the whole card, which read as a
              button rather than as a choice. Capped, it sits at its natural
              width on the left, exactly like one of five.
            */}
            <div
              role="radiogroup"
              aria-label={`Select a size for ${product.name}`}
              className="mt-2 flex items-stretch justify-start gap-1.5"
            >
              {sizes.map((size) => {
                const selected = chosenSize === size;
                // Unknown until the matrix arrives, and never "unavailable"
                // before then: the card must not grey out a size it cannot
                // prove is gone.
                const available = sizeAvailability?.get(size) ?? true;
                return (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!available}
                    onClick={() => {
                      setChosenSize(selected ? null : size);
                      void load();
                    }}
                    className={cn(
                      "min-w-0 max-w-[68px] flex-1 basis-0 rounded-[10px] border px-1 py-2 font-sans text-[12px] font-medium leading-none transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
                      selected
                        ? "border-wine bg-wine/[0.07] text-wine"
                        : "border-taraTaupe/40 bg-taraWhite text-ink hover:border-wine/60",
                      !available &&
                        "cursor-not-allowed border-taraTaupe/25 bg-taraIvory/60 text-muted/60 line-through hover:border-taraTaupe/25",
                    )}
                  >
                    <span className="block truncate">{formatSizeLabel(size)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/*
          ROW 5 (phone) — price and colours share a line, as in the reference.
          `mt-auto` anchors this block to the bottom so cards in a row line up
          however long their titles are.
        */}
        <div className="mt-auto pt-3.5">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            {/*
              The price never shrinks and never truncates — a cut price is worse
              than no swatch. Four circles beside a five-digit taka price is
              wider than a two-across phone card, so the FOURTH swatch is the
              thing that gives way below `sm`; see Swatches.
            */}
            <span className="shrink-0 whitespace-nowrap font-sans text-[16px] font-bold leading-none text-ink">
              {formatPrice(displayPrice)}
            </span>
            {showColours && (
              <Swatches
                product={product}
                selected={colourName}
                onSelect={(name) => {
                  setChosenColour(name);
                  void load();
                }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={soldOut || busy}
            aria-busy={busy}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            className={cn(
              "mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-wine",
              // The margin only separates the button from the phone-only price
              // row above it; on a wide card the wrapper's padding is the gap.
              "sm:mt-0",
              "font-sans text-[13px] font-semibold text-taraWhite transition-colors duration-200",
              "hover:bg-taraBlack focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
              "disabled:cursor-not-allowed disabled:bg-taraTaupe/40 disabled:text-taraBlack/50",
            )}
          >
            <ShoppingBag size={16} aria-hidden="true" />
            {soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * The colour circles.
 *
 * A swatch changes which photograph the card shows and which variant Add to
 * cart resolves to; it is a real control, so it is a button with the colour's
 * name as its accessible label. The name is never the only carrier of the
 * selection — the selected one takes a ring as well.
 */
function Swatches({
  product,
  selected,
  onSelect,
  className,
}: {
  product: Product;
  selected: string;
  onSelect: (name: string) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Colours available for ${product.name}`}
      className={cn("flex shrink-0 items-center gap-1.5 sm:gap-2", className)}
    >
      {/* Four beside a price on a wide card, three on a phone, where the row
          shares a 150px line with the price. The rest are on the product page,
          which the card links to. */}
      {product.colours.slice(0, 4).map((colour, index) => {
        const isSelected = colour.name === selected;
        return (
          <button
            key={colour.name}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={colour.name}
            title={colour.name}
            onClick={() => onSelect(colour.name)}
            className={cn(
              "h-4 w-4 shrink-0 rounded-full border border-taraTaupe/40 sm:h-[18px] sm:w-[18px]",
              index === 3 && "hidden sm:block",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
              isSelected && "ring-1 ring-wine ring-offset-2 ring-offset-taraWhite",
            )}
            style={{ backgroundColor: colour.hex }}
          />
        );
      })}
    </div>
  );
}
