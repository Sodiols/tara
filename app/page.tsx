import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { NewArrivalsSection } from "@/components/home/NewArrivalsSection";
import { FeaturedBanner } from "@/components/home/FeaturedBanner";
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
    "Shop women's clothing online at TARA — unready three piece, ready three piece, two piece, hijab and accessories. Based in Sylhet, delivering across Bangladesh with cash on delivery.",
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
      {/* The first screen renders at once; everything below it is deferred (see
          .defer-render in globals.css). The size hints are each section's measured
          height at phone, tablet and desktop widths, so the scrollbar holds still
          as sections render. */}
      <HeroSection />
      <BestSellersSection products={bestSellers} />
      <div className="defer-render [--defer-render-size:1430px] md:[--defer-render-size:1200px] lg:[--defer-render-size:1490px]">
        <NewArrivalsSection products={newArrivals} />
      </div>
      <div className="defer-render [--defer-render-size:560px] md:[--defer-render-size:665px] lg:[--defer-render-size:940px]">
        <FeaturedBanner />
      </div>
      <div className="defer-render [--defer-render-size:765px] md:[--defer-render-size:530px] lg:[--defer-render-size:780px]">
        <BrandStorySection />
      </div>
      {/* SocialGallery renders nothing without an Instagram URL; an empty
          deferred box would leave its reserved height as a blank gap. */}
      {settings.instagramUrl ? (
        <div className="defer-render [--defer-render-size:435px] md:[--defer-render-size:345px] lg:[--defer-render-size:525px]">
          <SocialGallery
            instagramUrl={settings.instagramUrl}
            handle={siteConfig.instagramHandle}
          />
        </div>
      ) : null}
      <div className="defer-render [--defer-render-size:255px] md:[--defer-render-size:180px] lg:[--defer-render-size:140px]">
        <ServiceBenefits delivery={settings.delivery} />
      </div>
    </>
  );
}
