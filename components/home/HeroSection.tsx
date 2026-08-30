import { HeroCarousel } from "./HeroCarousel";

/**
 * The homepage hero.
 *
 * A server component holding the shape of the section; only the carousel inside
 * it is a client component, because autoplay and pointer gestures need state
 * and nothing else here does.
 *
 * NO HERO COPY, ON PURPOSE
 * ------------------------
 * There is no headline, no paragraph and no pair of buttons. The five category
 * cards are the navigation and the call to action at once — a shopper arriving
 * on the homepage is choosing what to look at, and a sentence about timeless
 * style sits between them and that choice.
 *
 * THE HEIGHT IS CLAMPED, NOT 100vh
 * --------------------------------
 * A full-height hero pushes everything the shop actually sells below the fold.
 * This takes roughly two thirds of the viewport and is bounded at both ends:
 * the minimum keeps the composition from collapsing on a short laptop window,
 * and the maximum stops it becoming a billboard on a tall desktop monitor.
 */
export function HeroSection() {
  return (
    <section
      aria-label="Shop by category"
      className={[
        "relative w-full overflow-hidden bg-taraIvory",
        // Phone: a little shorter, with a floor that keeps the centre card and
        // its label comfortably clear of the fold.
        "h-[clamp(440px,58vh,560px)]",
        // Desktop: the 65vh target, bounded 500-700px.
        "lg:h-[clamp(500px,65vh,700px)]",
        "px-4 py-6 sm:px-6 lg:py-8",
      ].join(" ")}
    >
      <HeroCarousel />
    </section>
  );
}
