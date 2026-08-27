import Image from "next/image";
import Link from "next/link";
import { shopByStyleCategories } from "@/data/shopByStyle";
import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

export function ShopByStyleSection() {

  return (
    <Container as="section" className="py-12 sm:py-16 lg:py-24">
      <SectionHeader eyebrow={"Shop by Style"} heading={"Find Your Look"} />
      <div className="flex gap-3 md:gap-6 lg:gap-8 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-5">
        {shopByStyleCategories.map((style) => (
          <Link
            key={style.key}
            href={style.href}
            className="group relative w-[42%] sm:w-auto shrink-0 aspect-[4/5] overflow-hidden bg-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Image
              src={style.image}
              alt={style.label}
              fill
              sizes="(max-width: 768px) 45vw, 20vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent group-hover:from-ink/70 transition-colors duration-200" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <span className="text-white text-sm font-serif leading-snug">
                {style.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}
