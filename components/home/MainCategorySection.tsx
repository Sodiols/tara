"use client";

import { CategoryCard } from "./CategoryCard";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

export function MainCategorySection() {

  const categories = [
    {
      name: "Unready Three Piece",
      image: img(stockImages.portraitE, 700, 875),
      href: "/unstitched-three-piece",
    },
    {
      name: "Ready Three Piece",
      image: img(stockImages.portraitK, 700, 875),
      href: "/ready-three-piece",
    },
    {
      name: "Accessories",
      image: img(stockImages.bagE, 700, 875),
      href: "/accessories",
    },
  ];

  return (
    <Container as="section" className="py-12 sm:py-16 lg:py-24">
      <SectionHeader eyebrow={"Categories"} heading={"Shop by Category"} />
      <div className="grid sm:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.href}
            image={cat.image}
            name={cat.name}
            exploreLabel={"Explore"}
            href={cat.href}
          />
        ))}
      </div>
    </Container>
  );
}
