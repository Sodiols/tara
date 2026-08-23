"use client";

import Image from "next/image";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";

export function BrandStorySection() {

  return (
    <section className="bg-cream">
      <Container className="py-12 sm:py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[4/5] order-2 lg:order-1">
          <Image
            src={img(stockImages.lifestyleA, 900, 1050)}
            alt={"Designed for your everyday story"}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="order-1 lg:order-2 max-w-lg">
          <h2 className="font-serif font-normal text-[32px] sm:text-4xl lg:text-[44px] leading-[1.1] text-ink mb-5">
            {"Designed for your everyday story"}
          </h2>
          <p className="font-sans font-normal text-muted text-base leading-relaxed mb-8">
            {"TARA brings together comfort, modern style, and thoughtful details for women across Bangladesh. Every collection is selected to help you feel confident, comfortable, and beautifully yourself."}
          </p>
          <LinkButton href="/about" variant="secondary" size="lg">
            {"Learn About TARA"}
          </LinkButton>
        </div>
        </div>
      </Container>
    </section>
  );
}
