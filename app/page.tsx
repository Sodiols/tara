import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { StoreIntroSection } from "@/components/home/StoreIntroSection";
import { MainCategorySection } from "@/components/home/MainCategorySection";
import { NewArrivalsSection } from "@/components/home/NewArrivalsSection";
import { FeaturedBanner } from "@/components/home/FeaturedBanner";
import { ShopByStyleSection } from "@/components/home/ShopByStyleSection";
import { BestSellersSection } from "@/components/home/BestSellersSection";
import { BrandStorySection } from "@/components/home/BrandStorySection";
import { SocialGallery } from "@/components/home/SocialGallery";
import { ServiceBenefits } from "@/components/home/ServiceBenefits";
import { getBestSellers, getNewArrivals } from "@/lib/supabase/queries/products";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { siteConfig } from "@/data/site";
import { buildMetadata } from "@/lib/seo";

/**
 * The homepage declares its own canonical.
 *
 * It used to come from the root layout, which meant every route without one of
 * its own inherited it — see the note in app/layout.tsx.
 */
export const metadata: Metadata = buildMetadata({
  title: "Women's Clothing Online in Bangladesh",
  description:
    "Shop women's clothing online at TARA — unready three piece, three piece, two piece, hijab and accessories. Based in Sylhet, delivering across Bangladesh with cash on delivery.",
  path: "/",
});

export default async function HomePage() {
  const [newArrivals, bestSellers, settings] = await Promise.all([
    getNewArrivals(8),
    getBestSellers(8),
    getPublicStoreSettings(),
  ]);
  return (
    <>
      <HeroSection />
      <StoreIntroSection />
      <MainCategorySection />
      <NewArrivalsSection products={newArrivals} />
      <FeaturedBanner />
      <ShopByStyleSection />
      <BestSellersSection products={bestSellers} />
      <BrandStorySection />
      <SocialGallery
        instagramUrl={settings.instagramUrl}
        handle={siteConfig.instagramHandle}
      />
      <ServiceBenefits delivery={settings.delivery} />
    </>
  );
}
