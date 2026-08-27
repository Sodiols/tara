import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";

export function HeroSection() {

  return (
    <section className="relative bg-cream overflow-hidden">
      <Container>
        <div className="grid lg:grid-cols-2 items-center gap-10 lg:gap-0 min-h-[620px] md:min-h-[660px] lg:min-h-[720px]">
          <div className="relative z-10 py-10 lg:py-0 max-w-lg">
            <p className="font-sans font-semibold text-xs tracking-[0.08em] uppercase text-wine mb-4">
              {"TARA"}
            </p>
            <h1 className="font-serif font-normal text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.08] text-ink">
              {"Timeless style."}
              <br />
              <span className="italic">{"Made for you."}</span>
            </h1>
            <p className="font-sans font-normal text-muted mt-6 text-base leading-relaxed max-w-sm">
              {"Refined clothing and accessories for everyday confidence."}
            </p>
            <div className="flex flex-wrap gap-4 mt-9">
              <LinkButton href="/new-arrivals" size="lg">
                {"Unready Three Piece"}
              </LinkButton>
              <LinkButton href="/collection" variant="secondary" size="lg">
                {"Two Piece"}
              </LinkButton>
            </div>
          </div>

          <div className="relative h-[440px] sm:h-[520px] lg:h-full lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[52%]">
            <Image
              src="/images/hero/tara-hero.jpg"
              alt="Woman wearing a beige TARA three piece with maroon embroidery and a matching dupatta"
              fill
              priority
              quality={75}
              sizes="(max-width: 1024px) 100vw, 52vw"
              // Anchored to the top rather than the centre. This panel is
              // portrait while the photograph is landscape, so on tablet widths
              // the crop takes its 62px out of the height — centring it would
              // clip the model's head. Anchoring top spends that crop on the
              // hem instead, and on desktop the height fills exactly so the
              // vertical anchor costs nothing.
              className="object-cover object-[center_top]"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
