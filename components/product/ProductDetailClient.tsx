"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, MessageCircle, Link as LinkIcon, Star } from "lucide-react";
import type { Product, ProductVariant } from "@/types";
import { useToastStore } from "@/store/toastStore";
import { useBuyNowStore } from "@/store/buyNowStore";
import { useAddToCart } from "@/hooks/useAddToCart";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { track } from "@/lib/analytics/client";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGallery } from "./ProductGallery";
import { imageAlt } from "@/lib/product-media";
import { LaunchOfferNote } from "@/components/offer/LaunchOfferNote";
import { colourIdForName } from "@/lib/product-colour-images";
import { PriceDisplay } from "./PriceDisplay";
import { SizeSelector } from "./SizeSelector";
import { ColourSelector } from "./ColourSelector";
import { QuantitySelector } from "./QuantitySelector";
import { AccordionItem } from "./ProductAccordion";
import { ReviewsSection } from "./ReviewsSection";
import { RelatedProductsSection } from "./RelatedProductsSection";
import { RecentlyViewedSection } from "./RecentlyViewedSection";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SizeGuideTable } from "./SizeGuideTable";
import { siteConfig } from "@/data/site";
import { Container } from "@/components/layout/Container";
import { categoryHref, resolveCategoryLabel } from "@/lib/utils";
import { hasSelectableSizes, ONE_SIZE } from "@/lib/product-size";
import {
  colourChoices,
  defaultSelection,
  findVariant,
  hasColourAxis,
  maxQuantityFor,
  resolveSelection,
  sizeChoices,
  unavailableReason,
  type Selection,
} from "@/lib/product-variants";
import { MAX_LINE_QUANTITY } from "@/store/cartStore";
import type { DeliverySettings } from "@/lib/delivery";
import type { PolicySettings } from "@/lib/supabase/queries/settings";

interface ProductDetailClientProps {
  product: Product;
  /**
   * The real purchasable matrix. Empty means nothing on this product can be
   * bought right now — see the note on the derived state below.
   */
  variants: ProductVariant[];
  relatedProducts: Product[];
  /**
   * The shop's live delivery rule and its stated timelines and exchange window,
   * read once on the server and passed in the same way the header and footer
   * receive them. The Delivery and Exchange accordions are generated from
   * these, so the product page cannot promise something the policy pages and
   * the checkout do not.
   */
  delivery: DeliverySettings;
  policies: PolicySettings;
}

export function ProductDetailClient({
  product,
  variants,
  relatedProducts,
  delivery,
  policies,
}: ProductDetailClientProps) {
  const router = useRouter();
  const addToCart = useAddToCart();
  const startBuyNow = useBuyNowStore((s) => s.setItem);
  const { addToast } = useToastStore();
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addSlug);

  const hasRealSizes = hasSelectableSizes(product.sizes);
  const showColours = hasColourAxis(variants);

  /*
   * The selection is one pair, not two independent values.
   *
   * It used to be `size` and `colour` in separate state, each seeded from a
   * flattened array, with nothing checking that the pair existed. Holding it as
   * one object and pushing every change through resolveSelection() is what
   * makes an impossible combination unrepresentable rather than merely
   * discouraged.
   */
  const [selection, setSelection] = useState(() => defaultSelection(variants));
  const [requestedQuantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const selectedVariant = findVariant(variants, selection.size, selection.colour);
  const sizes = useMemo(
    () => sizeChoices(variants, selection.colour),
    [variants, selection.colour],
  );
  const colours = useMemo(
    () => colourChoices(variants, selection.size),
    [variants, selection.size],
  );

  /*
   * The colour being looked at has exactly one source of truth: `selection`,
   * which resolveSelection() keeps on a combination that really exists. The
   * gallery position is moved BY it and can move it in turn — see
   * applySelection and chooseImage below — so the two can never disagree, which
   * is the bug this feature exists to remove: looking at Black photographs
   * while Maroon is selected.
   *
   * Everything below is client-side arithmetic over data the page already has.
   * Changing colour does not fetch anything.
   */
  const selectedColourId = useMemo(
    () => colourIdForName(variants, selection.colour),
    [variants, selection.colour],
  );

  /*
   * THE RAIL SHOWS EVERYTHING; THE SELECTION DECIDES WHERE IT OPENS
   * ---------------------------------------------------------------
   * Every photograph the product has is in the gallery, whichever colour it
   * belongs to, so a three-colour product shows all three colourways in the
   * rail instead of hiding two of them behind a swatch.
   *
   * What keeps that honest is that the image and the colour move together:
   * picking a swatch jumps to that colour's first photograph, and clicking a
   * photograph that belongs to another colour selects that colour. The
   * customer can never be looking at Maroon while Black is in the bag.
   */
  const galleryMedia = useMemo(
    () => (product.media.length > 0
      ? product.media
      : product.images.map((url, index) => ({
          url,
          alt: null,
          isPrimary: index === 0,
          sortOrder: index,
          colourId: null,
        }))),
    [product.media, product.images],
  );
  const galleryImages = useMemo(
    () => galleryMedia.map((image) => image.url),
    [galleryMedia],
  );
  const galleryAlts = useMemo(
    () => galleryMedia.map((image, index) => imageAlt(image, product.name, index)),
    [galleryMedia, product.name],
  );

  /** Where a colour's own photographs begin, or 0 when it has none of its own. */
  const firstIndexForColour = useCallback(
    (colourId: string | null) => {
      if (!colourId) return 0;
      const index = galleryMedia.findIndex((image) => image.colourId === colourId);
      return index === -1 ? 0 : index;
    },
    [galleryMedia],
  );

  /*
   * Opens on the selected colour's first photograph, not on the product's.
   *
   * `defaultSelection` may land on Maroon because Black is sold out, and the
   * page would otherwise open showing a Black photograph with Maroon selected.
   */
  const [activeIndex, setActiveIndex] = useState(() => {
    const colourId = colourIdForName(variants, defaultSelection(variants).colour);
    if (!colourId) return 0;
    const index = (product.media.length > 0 ? product.media : []).findIndex(
      (image) => image.colourId === colourId,
    );
    return index === -1 ? 0 : index;
  });

  /*
   * Everything about the purchase comes from the selected variant, not the
   * product.
   *
   * `product.price` is the base price and `product.stock` is sum(stock) across
   * every variant — both are summaries for a card. Showing them here is how a
   * shopper is quoted one price and charged another by place_order(), and how
   * the quantity stepper offered ten of a size with one left.
   *
   * An empty matrix means fail closed. `product_variants` holds the only rows
   * that can be sold; if none are active, or the read failed, there is nothing
   * to sell and the page says so rather than offering a purchase the server
   * would refuse.
   */
  const effectivePrice = selectedVariant?.price ?? product.price;
  const maxQuantity = maxQuantityFor(selectedVariant, MAX_LINE_QUANTITY);
  const purchasable = maxQuantity > 0;
  const soldOutReason = unavailableReason(variants, selection.size, selection.colour);

  useEffect(() => {
    addRecentlyViewed(product.slug);
  }, [product.slug, addRecentlyViewed]);

  /*
   * One product view per product, per arrival on this page.
   *
   * The ref is keyed on the product rather than being a plain boolean, because
   * App Router keeps this component mounted when a customer moves from one
   * product to another — without it the second product would never be counted.
   * It also makes the effect idempotent under React's development-mode double
   * invocation, so the add-to-cart rate is not halved while somebody works on
   * the page.
   *
   * The price recorded is the one on screen: the selected variant's, which is
   * what the customer is deciding about.
   */
  const viewedProductId = useRef<string | null>(null);
  useEffect(() => {
    if (viewedProductId.current === product.id) return;
    viewedProductId.current = product.id;
    track({
      name: "product_view",
      productId: product.id,
      value: effectivePrice,
      meta: { productName: product.name, category: product.category },
    });
    // The price is read once, at arrival. Changing colour is its own event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  /*
   * Clamped on read rather than corrected in an effect.
   *
   * A shopper who asked for 5 of one size and then switched to a size with 2
   * left must not keep 5. Deriving it means the displayed quantity is never
   * momentarily wrong — an effect would render the stale value once first —
   * and it keeps the requested figure, so going back to a size that has 5
   * again restores what they asked for rather than leaving them on 2.
   */
  const quantity = Math.min(Math.max(1, requestedQuantity), Math.max(1, maxQuantity));

  /**
   * Applies a resolved selection and moves the gallery with it.
   *
   * `resolveSelection` may change the colour as well as the size — picking a
   * size that the current colour does not come in moves both — so the gallery
   * is pointed at whatever colour comes back rather than at the one that was
   * asked for.
   */
  const applySelection = (next: Selection) => {
    setSelection(next);
    const nextColourId = colourIdForName(variants, next.colour);
    if (nextColourId !== selectedColourId) setActiveIndex(firstIndexForColour(nextColourId));
  };

  const chooseSize = (next: string) => {
    applySelection(resolveSelection(variants, { ...selection, size: next }, "size"));
    track({ name: "product_size_selected", productId: product.id, size: next });
  };
  const chooseColour = (next: string) => {
    applySelection(resolveSelection(variants, { ...selection, colour: next }, "colour"));
    track({ name: "product_colour_selected", productId: product.id, colour: next });
  };

  /**
   * A thumbnail click.
   *
   * Always shows the photograph. If it belongs to a colourway other than the
   * one selected, the selection follows it, so the swatch, the price, the stock
   * and the variant the bag receives all describe what is on screen.
   */
  const chooseImage = (index: number) => {
    setActiveIndex(index);
    // How far into the gallery a customer goes is the closest thing an online
    // shop has to picking a garment up and turning it over.
    track({
      name: "product_image_interaction",
      productId: product.id,
      meta: { index, total: galleryMedia.length },
    });
    const colourId = galleryMedia[index]?.colourId ?? null;
    if (!colourId || colourId === selectedColourId) return;

    const match = variants.find((variant) => variant.colour?.id === colourId);
    if (match?.colour) {
      setSelection(resolveSelection(variants, { ...selection, colour: match.colour.name }, "colour"));
    }
  };

  const buildCartItem = () => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    // The photograph on screen, which is the one the customer is buying: the
    // gallery and the colour selection are kept in step, so this is always a
    // picture of the chosen colourway. place_order() independently picks that
    // colour's image for the order line.
    image: galleryImages[activeIndex] ?? galleryImages[0] ?? product.images[0],
    // The variant's effective price, so the bag shows what checkout will charge.
    // place_order() still recomputes it; this is display truth, not authority.
    price: effectivePrice,
    size: selection.size || ONE_SIZE,
    colour: selection.colour,
    quantity,
    // The identity that makes this line exactly one database row.
    variantId: selectedVariant?.id,
  });

  const handleAddToBag = () => {
    if (!purchasable) return;
    addToCart(buildCartItem());
  };

  /**
   * Buy Now is a separate purchase, not a cart operation.
   *
   * It used to call addItem() and then navigate to /checkout, so the customer's
   * existing cart came along for the ride: someone with three saved items who
   * clicked "Buy Now" on a fourth bought all four. It also left the item in the
   * cart if they abandoned checkout.
   *
   * The selection now goes into its own session-scoped store and the Buy Now
   * checkout reads only that. The cart is not read, not written, and its badge
   * does not move.
   */
  const handleBuyNow = () => {
    if (!purchasable) return;
    startBuyNow(buildCartItem());
    router.push("/checkout/buy-now");
  };

  const shareUrl = `${siteConfig.url}/product/${product.slug}`;

  return (
    <Container className="py-8 sm:py-12 lg:py-14 pb-28 min-[900px]:pb-14">
      <Breadcrumb
        items={[
          { label: resolveCategoryLabel(product), href: categoryHref(product.category) ?? undefined },
          { label: product.name },
        ]}
      />

      <div className="grid grid-cols-1 gap-10 mt-6 min-w-0 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)] min-[900px]:items-start min-[900px]:gap-8 min-[1100px]:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] min-[1100px]:gap-14">
        <div className="min-w-0">
          <ProductGallery
            images={galleryImages}
            alts={galleryAlts}
            activeIndex={activeIndex}
            onActiveIndexChange={chooseImage}
          />

          {/*
            The optional product video, under the gallery rather than inside it:
            a video in the thumbnail rail would have to pretend to be a
            photograph, and the rail's job is to show the colourways.

            `preload="none"` so a page that has one costs nothing until somebody
            presses play — the file is several hundred kilobytes and the
            photographs are what the page is for. No autoplay, no loop and no
            muted-autoplay trick: this is a garment, not an advertisement.
          */}
          {product.videoUrl && (
            <figure className="mt-4">
              <video
                src={product.videoUrl}
                controls
                preload="none"
                playsInline
                poster={galleryImages[0]}
                className="w-full rounded-panel border border-border bg-taraIvory"
              >
                Your browser cannot play this video.
              </video>
              <figcaption className="mt-1.5 font-sans text-xs text-muted">
                {product.name} — product video
              </figcaption>
            </figure>
          )}
        </div>

        <div className="min-w-0 min-[900px]:sticky min-[900px]:top-[120px] min-[900px]:self-start">
          <h1 className="font-serif font-normal text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.05] text-ink mb-3 text-balance">
            {product.name}
          </h1>

          <a
            href="#reviews"
            className="inline-flex items-center gap-1.5 mb-4 font-sans font-normal text-sm text-muted hover:text-ink transition-colors"
          >
            <Star size={15} className="fill-wine text-wine" />
            {product.rating.toFixed(1)} ({product.reviewCount} {"Customer Reviews"})
          </a>

          {/* The selected variant's price, which changes with the selection. */}
          <PriceDisplay price={effectivePrice} previousPrice={product.previousPrice} size="lg" />

          <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs text-muted mt-4 mb-6">
            <span className="font-normal">
              {"Product Code"}: {product.productCode}
            </span>
            {/*
              Availability of the chosen combination, not of the product. A
              product with stock in three sizes is not "In Stock" for the size
              this shopper has selected, and saying so is what sends them to a
              checkout that refuses the order.
            */}
            <span className="font-medium" aria-live="polite">
              {"Availability"}:{" "}
              {purchasable
                ? `In Stock (${maxQuantity} available)`
                : soldOutReason === "missing"
                  ? "Unavailable in this combination"
                  : "Out of Stock"}
            </span>
          </div>

          <div className="flex flex-col gap-5 mb-6">
            {showColours && (
              <ColourSelector
                colours={colours}
                selected={selection.colour}
                onChange={chooseColour}
              />
            )}
            {hasRealSizes && (
              <SizeSelector
                sizes={sizes}
                selected={selection.size}
                onChange={chooseSize}
                onOpenGuide={() => setSizeGuideOpen(true)}
              />
            )}
            {/* Capped by the selected variant's own stock. */}
            <QuantitySelector quantity={quantity} onChange={setQuantity} max={maxQuantity} />
          </div>

          <div className="hidden min-[900px]:flex flex-col gap-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleAddToBag} size="lg" fullWidth disabled={!purchasable}>
                {purchasable ? "Add to Cart" : "Out of Stock"}
              </Button>
              <Button
                onClick={handleBuyNow}
                variant="secondary"
                size="lg"
                fullWidth
                disabled={!purchasable}
              >
                {"Buy Now"}
              </Button>
            </div>
          </div>

          {/*
            The launch offer, when one is live and this product is in it.

            This is the only thing that goes here. A block repeating the
            delivery estimate, the exchange window and the sizes used to sit in
            this spot, and every line of it was already on the page: the two
            policies are in the accordion below, the sizes are the selector
            above, and the size guide is beside it. Saying all of it twice made
            the page longer without making it more convincing.
          */}
          <LaunchOfferNote productId={product.id} className="mb-6" />

          <div className="flex items-center gap-3 mb-6">
            <span className="font-sans font-medium text-xs uppercase tracking-[0.05em] text-muted">
              {"Share"}:
            </span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
              className="text-ink hover:text-wine"
            >
              <Facebook size={17} />
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
              className="text-ink hover:text-wine"
            >
              <MessageCircle size={17} />
            </a>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                addToast("Link copied");
              }}
              aria-label="Copy link"
              className="text-ink hover:text-wine"
            >
              <LinkIcon size={17} />
            </button>
          </div>

          <div>
            <AccordionItem title={"Description"} defaultOpen>
              <p>{product.description}</p>
            </AccordionItem>

            {product.unreadyDetails && (
              <AccordionItem title={"Fabric Information"}>
                <ul className="flex flex-col gap-1.5">
                  <li>
                    <strong className="text-ink">{"Kameez Fabric"}:</strong> {product.unreadyDetails.kameezFabric}
                  </li>
                  <li>
                    <strong className="text-ink">{"Salwar Fabric"}:</strong> {product.unreadyDetails.salwarFabric}
                  </li>
                  <li>
                    <strong className="text-ink">{"Dupatta Fabric"}:</strong> {product.unreadyDetails.dupattaFabric}
                  </li>
                  <li>
                    <strong className="text-ink">{"Work Details"}:</strong> {product.unreadyDetails.workDetails}
                  </li>
                  <li>
                    <strong className="text-ink">{"Fabric Length"}:</strong> {product.unreadyDetails.fabricLength}
                  </li>
                  <li>
                    <strong className="text-ink">{"Colour Information"}:</strong> {product.unreadyDetails.colourInfo}
                  </li>
                </ul>
              </AccordionItem>
            )}

            {product.readyMadeDetails && (
              <AccordionItem title={"Fit Information"}>
                <div className="flex flex-col gap-3">
                  <p>
                    <strong className="text-ink">{"Model Height"}:</strong> {product.readyMadeDetails.modelHeight} ·{" "}
                    <strong className="text-ink">{"Model Wearing Size"}:</strong> {product.readyMadeDetails.modelWearingSize}
                  </p>
                  <p>{product.readyMadeDetails.fitInformation}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse mt-2">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 text-ink">{"Size"}</th>
                          <th className="py-2 pr-3 text-ink">Chest</th>
                          <th className="py-2 pr-3 text-ink">Waist</th>
                          <th className="py-2 text-ink">Length</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.readyMadeDetails.sizeMeasurements.map((row) => (
                          <tr key={row.size} className="border-b border-border">
                            <td className="py-2 pr-3 text-ink">{row.size}</td>
                            <td className="py-2 pr-3">{row.chest}</td>
                            <td className="py-2 pr-3">{row.waist}</td>
                            <td className="py-2">{row.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </AccordionItem>
            )}

            <AccordionItem title={"Care Instructions"}>
              <p>{product.careInstructions}</p>
            </AccordionItem>

            {/*
              Both sentences used to be written here, which meant the product
              page could promise one thing and /delivery-information another.
              They come from store settings now — the same rows the assurance
              panel above and both policy pages read.
            */}
            <AccordionItem title={"Delivery Information"}>
              <p>
                {`Delivered within ${policies.deliveryEstimateInside} in ${delivery.freeDeliveryDivision} and ${policies.deliveryEstimateOutside} elsewhere in Bangladesh.`}
              </p>
            </AccordionItem>

            <AccordionItem title={"Exchange Information"}>
              <p>
                {`Easy exchange within ${policies.exchangeWindowDays} days of delivery. Item must be unused with original tags.`}
              </p>
            </AccordionItem>
          </div>
        </div>
      </div>

      <div id="reviews" className="mt-16 max-w-2xl">
        <ReviewsSection
          productId={product.id}
          productSlug={product.slug}
          reviews={product.reviews}
          rating={product.rating}
          reviewCount={product.reviewCount}
        />
      </div>

      {/* Deferred only when there is something to show: an empty deferred box
          would hold its estimated height open as a blank gap. Recently viewed
          is read from the browser after mount, so it is never deferred. */}
      {relatedProducts.length > 0 ? (
        <div className="defer-render [--defer-render-size:700px]">
          <RelatedProductsSection products={relatedProducts} />
        </div>
      ) : (
        <RelatedProductsSection products={relatedProducts} />
      )}
      <RecentlyViewedSection excludeSlug={product.slug} />

      <Modal isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} title={"Size Guide"}>
        <SizeGuideTable />
      </Modal>

      <div className="fixed bottom-0 left-0 right-0 z-30 min-[900px]:hidden bg-white border-t border-border p-3 grid grid-cols-2 gap-3">
        <Button onClick={handleAddToBag} fullWidth disabled={!purchasable}>
          {purchasable ? "Add to Cart" : "Out of Stock"}
        </Button>
        <Button onClick={handleBuyNow} variant="secondary" fullWidth disabled={!purchasable}>
          {"Buy Now"}
        </Button>
      </div>
    </Container>
  );
}
