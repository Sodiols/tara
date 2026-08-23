"use client";

import Link from "next/link";
import type { Product } from "@/types";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

export function NewArrivalsSection({ products }: { products: Product[] }) {

  return (
    <Container as="section" className="py-12 sm:py-16 lg:py-24">
      <SectionHeader
        eyebrow={"New Arrivals"}
        heading={"Just In"}
        action={
          <Link
            href="/new-arrivals"
            className="inline-block text-xs uppercase tracking-wide text-ink border-b border-ink pb-0.5 hover:text-wine hover:border-wine transition-colors"
          >
            {"Shop All"}
          </Link>
        }
      />
      <ProductGrid products={products} />
    </Container>
  );
}
