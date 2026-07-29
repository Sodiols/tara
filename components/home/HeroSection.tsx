"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/i18n";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative bg-cream overflow-hidden">
      <Container>
        <div className="grid lg:grid-cols-2 items-center gap-10 lg:gap-0 min-h-[620px] md:min-h-[660px] lg:min-h-[720px]">
          <div className="relative z-10 py-10 lg:py-0 max-w-lg">
            <p className="font-sans font-semibold text-xs tracking-[0.08em] uppercase text-wine mb-4">
              {t("common.brand")}
            </p>
            <h1 className="font-serif font-normal text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.08] text-ink">
              {t("hero.heading1")}
              <br />
              <span className="italic">{t("hero.heading2")}</span>
            </h1>
            <p className="font-sans font-normal text-muted mt-6 text-base leading-relaxed max-w-sm">
              {t("hero.subtext")}
            </p>
            <div className="flex flex-wrap gap-4 mt-9">
              <LinkButton href="/new-arrivals" size="lg">
                {t("hero.primaryCta")}
              </LinkButton>
              <LinkButton href="/collection" variant="secondary" size="lg">
                {t("hero.secondaryCta")}
              </LinkButton>
            </div>
          </div>

          <div className="relative h-[440px] sm:h-[520px] lg:h-full lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[52%]">
            <Image
              src={img(stockImages.heroWoman, 1000, 1250)}
              alt="Woman wearing an elegant embroidered three piece outfit from TARA"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover object-[center_15%]"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
