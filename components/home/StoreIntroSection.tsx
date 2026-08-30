import Link from "next/link";
import { Container } from "@/components/layout/Container";

/**
 * The homepage's H1.
 *
 * The hero is a wordless composition on purpose — five photographs and nothing
 * over them — which left the homepage with no H1 at all. A page that never
 * states what it is relies entirely on the title tag, and a customer arriving
 * from a search for "women's clothing Bangladesh" landed on a carousel with no
 * sentence confirming they were in the right shop.
 *
 * So this sits between the hero and the category grid: one heading, two lines
 * of plain description, and links into the categories that already exist. It is
 * not an SEO block bolted onto the design — it uses the same Container, the
 * same Bodoni heading and the same wine eyebrow as every other homepage
 * section, and it says something a shopper genuinely wants to read on arrival.
 *
 * Deliberately NOT done: repeating "women's clothing Bangladesh" three times,
 * listing every city in the country, or hiding a keyword paragraph behind
 * `sr-only`. The heading states the subject once; the sentence names the real
 * product range and where the shop is. That is all the page can honestly say.
 */
export function StoreIntroSection() {
  return (
    <Container as="section" className="pt-10 sm:pt-14 lg:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-wine">
          {"TARA"}
        </p>
        <h1 className="mt-3 font-serif text-[1.75rem] leading-tight text-ink sm:text-4xl">
          {"Women's Clothing Online in Bangladesh"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
          {
            "TARA makes unready three piece, three piece and two piece sets, hijab and accessories for everyday wear. We are based in Zakiganj, Sylhet, and deliver across Bangladesh with cash on delivery."
          }
        </p>
        {/*
          Real links rather than decoration: these are the four category pages
          that most need to be reachable from the homepage in plain HTML, with
          the category's own name as the anchor text.
        */}
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-sans text-[13px]">
          {[
            { href: "/unready-three-piece", label: "Unready Three Piece" },
            { href: "/three-piece", label: "Three Piece" },
            { href: "/two-piece", label: "Two Piece" },
            { href: "/hijab", label: "Hijab" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-wine underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </p>
      </div>
    </Container>
  );
}
