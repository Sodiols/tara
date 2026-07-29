import { HeroSection } from "@/components/home/HeroSection";
import { MainCategorySection } from "@/components/home/MainCategorySection";
import { NewArrivalsSection } from "@/components/home/NewArrivalsSection";
import { FeaturedBanner } from "@/components/home/FeaturedBanner";
import { ShopByStyleSection } from "@/components/home/ShopByStyleSection";
import { BestSellersSection } from "@/components/home/BestSellersSection";
import { BrandStorySection } from "@/components/home/BrandStorySection";
import { SocialGallery } from "@/components/home/SocialGallery";
import { ServiceBenefits } from "@/components/home/ServiceBenefits";
import { getBestSellers, getNewArrivals } from "@/lib/supabase/queries/products";

export default async function HomePage() {
  const [newArrivals, bestSellers] = await Promise.all([
    getNewArrivals(8),
    getBestSellers(8),
  ]);
  return (
    <>
      <HeroSection />
      <MainCategorySection />
      <NewArrivalsSection products={newArrivals} />
      <FeaturedBanner />
      <ShopByStyleSection />
      <BestSellersSection products={bestSellers} />
      <BrandStorySection />
      <SocialGallery />
      <ServiceBenefits />
    </>
  );
}
