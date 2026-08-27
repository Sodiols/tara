import type { Product } from "@/types";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

export function BestSellersSection({ products }: { products: Product[] }) {

  return (
    <section className="bg-white py-12 sm:py-16 lg:py-24">
      <Container>
        <SectionHeader eyebrow={"Customer Favourites"} heading={"Best Sellers"} />
        <ProductCarousel products={products} />
      </Container>
    </section>
  );
}
