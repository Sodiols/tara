"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/i18n";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";

export function FeaturedBanner() {
  const { t } = useLanguage();

  return (
    <section className="relative bg-beige py-12 sm:py-16 lg:py-24">
      <Container>
        <div className="grid lg:grid-cols-2 items-center gap-8 lg:gap-14">
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[4/5]">
            <Image
              src={img(stockImages.portraitC, 900, 1125)}
              alt={t("featuredBanner.heading")}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="max-w-md">
            <p className="font-sans font-semibold text-[11px] sm:text-xs tracking-[0.08em] uppercase text-wine mb-3">
              {t("categories.collectionName")}
            </p>
            <h2 className="font-serif font-normal text-[32px] sm:text-4xl lg:text-[44px] leading-[1.1] text-ink mb-4">
              {t("featuredBanner.heading")}
            </h2>
            <p className="font-sans font-normal text-muted text-base leading-relaxed mb-8">
              {t("featuredBanner.subtext")}
            </p>
            <LinkButton href="/collection" size="lg">
              {t("featuredBanner.cta")}
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
