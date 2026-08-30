import { CategoryCard } from "./CategoryCard";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

/**
 * The categories the shop is organised around.
 *
 * A server component: it has no state and no interactivity, so it costs nothing
 * in the browser bundle.
 *
 * The names here are the customer-facing wording. The two three-piece slugs are
 * deliberately NOT renamed — they are live routes, they are in the sitemap,
 * every product row and several migrations reference them, and customers have
 * the URLs. Renaming a slug would 404 every shared link to change words the
 * label already changes.
 *
 * The order matches `categories.sort_order` in the database (migration 0015)
 * and the navigation bar, so a shopper meets the same sequence wherever they
 * look.
 */
const categories = [
  {
    name: "Unready Three Piece",
    image: img(stockImages.portraitE, 700, 875),
    href: "/unstitched-three-piece",
  },
  {
    name: "Three Piece",
    image: img(stockImages.portraitD, 700, 875),
    href: "/three-piece",
  },
  {
    name: "Two Piece",
    image: img(stockImages.portraitK, 700, 875),
    href: "/ready-three-piece",
  },
  {
    name: "Hijab",
    image: img(stockImages.portraitH, 700, 875),
    href: "/hijab",
  },
  {
    name: "Accessories",
    image: img(stockImages.bagE, 700, 875),
    href: "/accessories",
  },
];

export function MainCategorySection() {
  return (
    <Container as="section" className="py-12 sm:py-16 lg:py-24">
      <SectionHeader eyebrow={"Categories"} heading={"Shop by Category"} />
      {/*
        Two across on a phone, three on a tablet, all five in one row once there
        is room. The card is a 4:5 portrait with its title over the image, which
        stays legible at half a phone's width — a single column would push the
        last categories far below the fold.
      */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-5 lg:gap-6">
        {categories.map((category) => (
          <CategoryCard
            key={category.href}
            image={category.image}
            name={category.name}
            exploreLabel={"Explore"}
            href={category.href}
          />
        ))}
      </div>
    </Container>
  );
}
