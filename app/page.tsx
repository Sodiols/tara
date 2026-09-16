import type { Metadata } from "next";
import { Suspense } from "react";
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

/**
 * THE HERO DOES NOT WAIT FOR THE CATALOGUE
 * ----------------------------------------
 * This page used to open with
 *
 *     const [newArrivals, bestSellers, settings] = await Promise.all([...])
 *
 * so no byte of HTML left the server until three database queries had come
 * back — including the hero, which needs none of them. Measured on a cold data
 * cache that was 581ms to first byte against 68ms warm: half a second in which
 * the browser had nothing to parse, could not discover the LCP photograph, and
 * could not start the fonts or the CSS.
 *
 * Each section that needs data is now its own async server component behind its
 * own Suspense boundary. The hero and the page shell flush immediately; the
 * catalogue sections stream in as their queries resolve. Nothing is client-only
 * and nothing was moved into the browser — every product still arrives as
 * server-rendered HTML in the same response, so crawlers and JavaScript-less
 * requests see exactly what they saw before.
 *
 * WHY THIS IS NOT THE loading.tsx BUG
 * -----------------------------------
 * tests/route-hydration.test.ts forbids route-level `loading.tsx`, which put
 * the WHOLE page — header, hero, every control — inside one boundary that
 * streamed but never hydrated. These boundaries sit inside the page around
 * server-rendered sections, and the interactive parts of the first screen (the
 * hero carousel, the header) are outside every one of them. Hydration of the
 * carousel, the product cards, Quick View and Add to Bag was verified in a
 * production build after this change; see the note in that test file for why
 * nothing but a real build can tell you.
 *
 * FALLBACK HEIGHTS
 * ----------------
 * Every fallback reserves the height its section will occupy, from the same
 * measurements the `defer-render` wrappers already use, so a section arriving
 * late moves nothing that is already on screen. CLS stays at 0.
 */

async function BestSellers() {
  const products = await getBestSellers(8);
  return <BestSellersSection products={products} />;
}

async function NewArrivals() {
  const products = await getNewArrivals(8);
  return <NewArrivalsSection products={products} />;
}

async function InstagramGallery() {
  const settings = await getPublicStoreSettings();
  // Renders nothing without an Instagram URL; an empty deferred box would
  // leave its reserved height as a blank gap.
  if (!settings.instagramUrl) return null;
  return (
    <div className="defer-render [--defer-render-size:435px] md:[--defer-render-size:345px] lg:[--defer-render-size:525px]">
      <SocialGallery
        instagramUrl={settings.instagramUrl}
        handle={siteConfig.instagramHandle}
      />
    </div>
  );
}

async function Benefits() {
  const settings = await getPublicStoreSettings();
  return (
    <div className="defer-render [--defer-render-size:255px] md:[--defer-render-size:180px] lg:[--defer-render-size:140px]">
      <ServiceBenefits delivery={settings.delivery} />
    </div>
  );
}

/** A height-matched placeholder, so a streamed section displaces nothing. */
function Reserved({ className }: { className: string }) {
  return <div aria-hidden="true" className={className} />;
}

export default function HomePage() {
  return (
    <>
      {/* The first screen renders at once; everything below it is deferred (see
          .defer-render in globals.css). The size hints are each section's measured
          height at phone, tablet and desktop widths, so the scrollbar holds still
          as sections render. */}
      <HeroSection />

      <Suspense fallback={<Reserved className="h-[1060px] bg-white md:h-[900px] lg:h-[1120px]" />}>
        <BestSellers />
      </Suspense>

      <div className="defer-render [--defer-render-size:1430px] md:[--defer-render-size:1200px] lg:[--defer-render-size:1490px]">
        <Suspense fallback={<Reserved className="h-[1430px] md:h-[1200px] lg:h-[1490px]" />}>
          <NewArrivals />
        </Suspense>
      </div>

      <div className="defer-render [--defer-render-size:560px] md:[--defer-render-size:665px] lg:[--defer-render-size:940px]">
        <FeaturedBanner />
      </div>

      <div className="defer-render [--defer-render-size:765px] md:[--defer-render-size:530px] lg:[--defer-render-size:780px]">
        <BrandStorySection />
      </div>

      <Suspense fallback={null}>
        <InstagramGallery />
      </Suspense>

      <Suspense fallback={<Reserved className="h-[255px] md:h-[180px] lg:h-[140px]" />}>
        <Benefits />
      </Suspense>
    </>
  );
}
