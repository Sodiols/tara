/**
 * The five categories the homepage hero fans out.
 *
 * ROUTES ARE VERIFIED, NOT INVENTED
 * ---------------------------------
 * Every `href` below is a real page under app/, and every `name` is the exact
 * customer-facing wording `builtInCategoryLabels` in lib/utils.ts resolves the
 * slug to. The two are checked against each other by a test, so renaming a
 * category in one place and not the other fails the suite rather than shipping
 * a hero that disagrees with the navigation.
 *
 * A NOTE ON THE THREE-PIECE NAMES
 * -------------------------------
 * There are three of them and they are easy to confuse:
 *
 *   /unstitched-three-piece   "Unready Three Piece"   fabric, not made up
 *   /three-piece              "Three Piece"
 *   /ready-three-piece        "Two Piece"             renamed by migration 0014
 *
 * `/ready-three-piece` is the slug whose LABEL is now "Two Piece" — the words
 * "Ready Three Piece" are its former name and are no longer shown to anyone.
 * The slug is kept because it is a live URL, in the sitemap and bookmarked; see
 * migration 0007 for what a careless slug rename costs.
 *
 * THE ORDER IS THE FAN, LEFT TO RIGHT
 * -----------------------------------
 * Index 0 starts on the far left and index 4 on the far right, so the array
 * reads the way the composition looks. `HERO_INITIAL_INDEX` is the card that
 * starts in the centre.
 */
export interface HeroCategory {
  /** A real route under app/. */
  href: string;
  /** Customer-facing wording, matching lib/utils.ts. */
  name: string;
  /** Local asset under public/. Never a remote URL. */
  image: string;
  /** Describes the photograph, not the category — the link text already says that. */
  alt: string;
}

export const heroCategories: readonly HeroCategory[] = [
  {
    href: "/ready-three-piece",
    name: "Two Piece",
    image: "/images/hero/two-piece.jpg",
    alt: "Model wearing a TARA two piece set, kameez and bottom in a matched fabric",
  },
  {
    href: "/three-piece",
    name: "Three Piece",
    image: "/images/hero/three-piece.jpg",
    alt: "Model wearing a TARA three piece with the dupatta draped over one shoulder",
  },
  {
    href: "/unstitched-three-piece",
    name: "Unready Three Piece",
    image: "/images/hero/unready-three-piece.jpg",
    alt: "Unstitched TARA three piece fabric with its matching dupatta and bottom piece",
  },
  {
    href: "/hijab",
    name: "Hijab",
    image: "/images/hero/hijab.jpg",
    alt: "Model wearing a softly draped TARA hijab",
  },
  {
    href: "/accessories",
    name: "Accessories",
    image: "/images/hero/accessories.jpg",
    alt: "TARA accessories arranged on a warm neutral surface",
  },
] as const;

/**
 * "Unready Three Piece" opens in the centre — it is the category the shop leads
 * with, and it is the middle of the array so the opening composition is
 * symmetrical rather than starting mid-rotation.
 */
export const HERO_INITIAL_INDEX = 2;
