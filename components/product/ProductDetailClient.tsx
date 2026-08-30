"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, MessageCircle, Link as LinkIcon, Star } from "lucide-react";
import type { Product } from "@/types";
import { useToastStore } from "@/store/toastStore";
import { useBuyNowStore } from "@/store/buyNowStore";
import { useAddToCart } from "@/hooks/useAddToCart";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGallery } from "./ProductGallery";
import { imageAlt } from "@/lib/product-media";
import { PriceDisplay } from "./PriceDisplay";
import { SizeSelector } from "./SizeSelector";
import { ColourSelector } from "./ColourSelector";
import { QuantitySelector } from "./QuantitySelector";
import { WishlistButton } from "./WishlistButton";
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

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const router = useRouter();
  const addToCart = useAddToCart();
  const startBuyNow = useBuyNowStore((s) => s.setItem);
  const { addToast } = useToastStore();
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addSlug);

  const hasRealSizes = hasSelectableSizes(product.sizes);
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [colour, setColour] = useState(product.colours[0]?.name ?? "");
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  useEffect(() => {
    addRecentlyViewed(product.slug);
  }, [product.slug, addRecentlyViewed]);

  const buildCartItem = () => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0],
    price: product.price,
    size: size || product.sizes[0] || ONE_SIZE,
    colour: colour || product.colours[0]?.name || "",
    quantity,
  });

  const handleAddToBag = () => {
    if (product.stock === 0) return;
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
    if (product.stock === 0) return;
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
        <ProductGallery
          images={product.images}
          alts={product.images.map((_, index) =>
            imageAlt(product.media[index], product.name, index),
          )}
        />

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

          <PriceDisplay price={product.price} previousPrice={product.previousPrice} size="lg" />

          <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs text-muted mt-4 mb-6">
            <span className="font-normal">
              {"Product Code"}: {product.productCode}
            </span>
            <span className="font-medium">
              {"Availability"}: {product.stock > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <p className="font-sans font-normal text-sm text-muted leading-relaxed mb-6">{product.description}</p>

          <div className="flex flex-col gap-5 mb-6">
            {product.colours.length > 0 && (
              <ColourSelector colours={product.colours} selected={colour} onChange={setColour} />
            )}
            {hasRealSizes && (
              <SizeSelector
                sizes={product.sizes}
                selected={size}
                onChange={setSize}
                onOpenGuide={() => setSizeGuideOpen(true)}
              />
            )}
            <QuantitySelector quantity={quantity} onChange={setQuantity} max={product.stock} />
          </div>

          <div className="hidden min-[900px]:flex flex-col gap-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleAddToBag} size="lg" fullWidth disabled={product.stock === 0}>
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              <Button onClick={handleBuyNow} variant="secondary" size="lg" fullWidth disabled={product.stock === 0}>
                {"Buy Now"}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <WishlistButton product={product} variant="detail" />
              <span className="text-xs text-muted">{"Wishlist"}</span>
            </div>
          </div>

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

            <AccordionItem title={"Delivery Information"}>
              <p>{"Delivered within 2-4 business days in Sylhet and 4-7 business days nationwide."}</p>
            </AccordionItem>

            <AccordionItem title={"Exchange Information"}>
              <p>{"Easy exchange within 7 days of delivery. Item must be unused with original tags."}</p>
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

      <RelatedProductsSection products={relatedProducts} />
      <RecentlyViewedSection excludeSlug={product.slug} />

      <Modal isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} title={"Size Guide"}>
        <SizeGuideTable />
      </Modal>

      <div className="fixed bottom-0 left-0 right-0 z-30 min-[900px]:hidden bg-white border-t border-border p-3 grid grid-cols-2 gap-3">
        <Button onClick={handleAddToBag} fullWidth disabled={product.stock === 0}>
          {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
        </Button>
        <Button onClick={handleBuyNow} variant="secondary" fullWidth disabled={product.stock === 0}>
          {"Buy Now"}
        </Button>
      </div>
    </Container>
  );
}
