import type { Product } from "@/types";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

/**
 * Products staff have flagged "Best seller" in the admin product form
 * (`products.is_best_seller`). Renders nothing until at least one is flagged,
 * so the homepage never shows an empty heading.
 */
export function BestSellersSection({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="bg-white py-12 sm:py-16 lg:py-24">
      <Container>
        <SectionHeader eyebrow={"Customer Favourites"} heading={"Best Sellers"} />
        <ProductCarousel products={products} />
      </Container>
    </section>
  );
}
