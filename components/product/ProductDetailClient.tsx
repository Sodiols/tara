"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, MessageCircle, Link as LinkIcon, Star } from "lucide-react";
import type { Product } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGallery } from "./ProductGallery";
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
import { getCategoryTranslationKey } from "@/lib/utils";

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const { t, pick } = useLanguage();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const { addToast } = useToastStore();
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addSlug);

  const hasRealSizes = product.sizes.length > 0 && product.sizes[0] !== "One Size" && product.sizes[0] !== "Undready";
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [colour, setColour] = useState(product.colours[0]?.name.en ?? "");
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
    size: size || product.sizes[0] || "One Size",
    colour: colour || product.colours[0]?.name.en || "",
    quantity,
  });

  const handleAddToBag = () => {
    addItem(buildCartItem());
    addToast(t("common.addToBag"));
  };

  const handleBuyNow = () => {
    addItem(buildCartItem());
    router.push("/checkout");
  };

  const shareUrl = `${siteConfig.url}/product/${product.slug}`;

  return (
    <Container className="py-8 sm:py-12 lg:py-14 pb-28 min-[900px]:pb-14">
      <Breadcrumb
        items={[
          { label: t(getCategoryTranslationKey(product.category)), href: `/${product.category}` },
          { label: pick(product.name) },
        ]}
      />

      <div className="grid grid-cols-1 gap-10 mt-6 min-w-0 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)] min-[900px]:items-start min-[900px]:gap-8 min-[1100px]:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] min-[1100px]:gap-14">
        <ProductGallery images={product.images} alt={pick(product.name)} />

        <div className="min-w-0 min-[900px]:sticky min-[900px]:top-[120px] min-[900px]:self-start">
          <h1 className="font-serif font-normal text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.05] text-ink mb-3 text-balance">
            {pick(product.name)}
          </h1>

          <a
            href="#reviews"
            className="inline-flex items-center gap-1.5 mb-4 font-sans font-normal text-sm text-muted hover:text-ink transition-colors"
          >
            <Star size={15} className="fill-wine text-wine" />
            {product.rating.toFixed(1)} ({product.reviewCount} {t("product.reviews")})
          </a>

          <PriceDisplay price={product.price} previousPrice={product.previousPrice} size="lg" />

          <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs text-muted mt-4 mb-6">
            <span className="font-normal">
              {t("product.productCode")}: {product.productCode}
            </span>
            <span className="font-medium">
              {t("product.availability")}: {product.stock > 0 ? t("product.inStock") : t("common.outOfStock")}
            </span>
          </div>

          <p className="font-sans font-normal text-sm text-muted leading-relaxed mb-6">{pick(product.description)}</p>

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
                {product.stock === 0 ? t("common.outOfStock") : t("common.addToBag")}
              </Button>
              <Button onClick={handleBuyNow} variant="secondary" size="lg" fullWidth disabled={product.stock === 0}>
                {t("common.buyNow")}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <WishlistButton
                product={product}
                className="!rounded-control !bg-transparent border border-border p-3 hover:border-wine"
              />
              <span className="text-xs text-muted">{t("nav.wishlist")}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="font-sans font-medium text-xs uppercase tracking-[0.05em] text-muted">
              {t("product.share")}:
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
                addToast(t("common.save"));
              }}
              aria-label="Copy link"
              className="text-ink hover:text-wine"
            >
              <LinkIcon size={17} />
            </button>
          </div>

          <div>
            <AccordionItem title={t("product.description")} defaultOpen>
              <p>{pick(product.description)}</p>
            </AccordionItem>

            {product.unstitchedDetails && (
              <AccordionItem title={t("product.fabricInfo")}>
                <ul className="flex flex-col gap-1.5">
                  <li>
                    <strong className="text-ink">{t("product.kameezFabric")}:</strong> {pick(product.unstitchedDetails.kameezFabric)}
                  </li>
                  <li>
                    <strong className="text-ink">{t("product.salwarFabric")}:</strong> {pick(product.unstitchedDetails.salwarFabric)}
                  </li>
                  <li>
                    <strong className="text-ink">{t("product.dupattaFabric")}:</strong> {pick(product.unstitchedDetails.dupattaFabric)}
                  </li>
                  <li>
                    <strong className="text-ink">{t("product.workDetails")}:</strong> {pick(product.unstitchedDetails.workDetails)}
                  </li>
                  <li>
                    <strong className="text-ink">{t("product.fabricLength")}:</strong> {pick(product.unstitchedDetails.fabricLength)}
                  </li>
                  <li>
                    <strong className="text-ink">{t("product.colourInfo")}:</strong> {pick(product.unstitchedDetails.colourInfo)}
                  </li>
                </ul>
              </AccordionItem>
            )}

            {product.readyMadeDetails && (
              <AccordionItem title={t("product.fitInformation")}>
                <div className="flex flex-col gap-3">
                  <p>
                    <strong className="text-ink">{t("product.modelHeight")}:</strong> {pick(product.readyMadeDetails.modelHeight)} ·{" "}
                    <strong className="text-ink">{t("product.modelWearingSize")}:</strong> {product.readyMadeDetails.modelWearingSize}
                  </p>
                  <p>{pick(product.readyMadeDetails.fitInformation)}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse mt-2">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 text-ink">{t("product.size")}</th>
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

            <AccordionItem title={t("product.careInstructions")}>
              <p>{pick(product.careInstructions)}</p>
            </AccordionItem>

            <AccordionItem title={t("product.deliveryInfo")}>
              <p>{t("product.deliveryText")}</p>
            </AccordionItem>

            <AccordionItem title={t("product.exchangeInfo")}>
              <p>{t("product.exchangeText")}</p>
            </AccordionItem>
          </div>
        </div>
      </div>

      <div id="reviews" className="mt-16 max-w-2xl">
        <h2 className="font-serif font-normal text-2xl sm:text-3xl leading-[1.1] text-ink mb-6">
          {t("product.reviews")}
        </h2>
        <ReviewsSection reviews={product.reviews} rating={product.rating} reviewCount={product.reviewCount} />
      </div>

      <RelatedProductsSection products={relatedProducts} />
      <RecentlyViewedSection excludeSlug={product.slug} />

      <Modal isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} title={t("product.sizeGuide")}>
        <SizeGuideTable />
      </Modal>

      <div className="fixed bottom-0 left-0 right-0 z-30 min-[900px]:hidden bg-white border-t border-border p-3 grid grid-cols-2 gap-3">
        <Button onClick={handleAddToBag} fullWidth disabled={product.stock === 0}>
          {product.stock === 0 ? t("common.outOfStock") : t("common.addToBag")}
        </Button>
        <Button onClick={handleBuyNow} variant="secondary" fullWidth disabled={product.stock === 0}>
          {t("common.buyNow")}
        </Button>
      </div>
    </Container>
  );
}
