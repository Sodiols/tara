import type { Product } from "@/types";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { offerBadge, offerSentence, type LaunchOffer } from "@/lib/launch-offer";

/**
 * The launch campaign on the homepage.
 *
 * Renders only when an offer is live AND the administrator has named hero
 * products for it — the same rule as every other homepage rail: an empty
 * heading is worse than no heading.
 *
 * Deliberately built out of the pieces the homepage already uses (the section
 * header, the product carousel) rather than as a new kind of block. A campaign
 * should read as TARA doing something, not as a banner bolted onto TARA.
 *
 * No countdown, no "hurry", no invented stock figures. The offer states what it
 * gives and, when there is one, when it ends — both from the offer row.
 */
export function LaunchCampaignSection({
  offer,
  products,
}: {
  offer: LaunchOffer;
  products: Product[];
}) {
  if (products.length === 0) return null;

  const ends = offer.endsAt
    ? new Date(offer.endsAt).toLocaleDateString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <section className="border-t border-b border-border bg-taraIvory py-12 sm:py-16 lg:py-20">
      <Container>
        <SectionHeader
          eyebrow={offerBadge(offer)}
          heading={offer.title.trim() || "Launch offer"}
          description={offer.description.trim() || offerSentence(offer)}
          action={
            ends ? (
              <p className="font-sans text-xs uppercase tracking-[0.08em] text-muted">
                Until {ends}
              </p>
            ) : null
          }
        />
        <ProductCarousel products={products} />
      </Container>
    </section>
  );
}
