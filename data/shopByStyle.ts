import { img, stockImages } from "@/lib/images";

/**
 * The five style states of the homepage's "Find Your Look" scroll story.
 *
 * ROUTES ARE REAL, AND THEY USED NOT TO BE
 * ----------------------------------------
 * Every `href` below is a page that exists under app/ and that filters the
 * catalogue to something narrower than the whole shop.
 *
 * They previously all pointed at `/collection?style=<key>`. That is not a
 * broken link in the 404 sense, which is why it survived so long — but `style`
 * is not one of the parameters `productFiltersFromParams()` in
 * lib/catalogue-filters.ts parses, so the query string was discarded and all
 * five cards landed the shopper on the identical unfiltered listing.
 *
 * The two collection routes carry the same condition as the collection menu in
 * data/navigation.ts: /collection/[slug] calls notFound() when the collection
 * has been deactivated or is out of season. That is deliberate everywhere else
 * on the site and this section does not get an exception.
 *
 * `?fabric=Cotton` was considered for Comfortable Cotton and rejected: the
 * fabric filter is an exact match on the free-text `products.fabric_en` a
 * member of staff typed, so one product saved as "cotton" or "Soft Cotton"
 * would produce an empty listing behind a promoted link.
 *
 * PHOTOGRAPHY
 * -----------
 * Drawn from the shared library in lib/images.ts, every id of which has been
 * individually checked — see the note there. New ids are not invented here:
 * an unseen Unsplash id is exactly the mismatched or logo-bearing photograph
 * that note exists to prevent.
 *
 * These now run full bleed behind the copy, which is a far harder job than
 * sitting in a panel, and the set was re-chosen against it rather than carried
 * over. What a photograph has to survive here is a wide desktop crop that keeps
 * less than half its height, with type over the left third:
 *
 *   - four of the five are studio shots against a plain sweep, which is what
 *     leaves the left of the frame able to carry typography;
 *   - in every one the model stands centre or right of centre, so the copy is
 *     never over her face;
 *   - `portraitD` was tried for New Season Colours and dropped: a gloved hand
 *     and a striped carrier bag sit in its lower left, which is exactly where
 *     the paragraph and the progress rail land;
 *   - `portraitC` is out because FeaturedBanner shows it directly above this
 *     section, and `portraitA` is a rail of clothes with no model in it.
 *
 * Two of them also changed places. The softly draped frame opens as Everyday
 * Wear, and the airy daylight dress moved to Comfortable Cotton, which is the
 * fabric it visibly is. Together the set runs muted rose, ivory, deep red, warm
 * peach, plum: one tonal sequence rather than five unrelated photographs.
 *
 * They are requested large. A full-bleed background is asked for at up to
 * 100vw on a high-density desktop screen, and the source has to have the pixels
 * for that or next/image is upscaling a thumbnail across the whole viewport.
 * Only the server fetches this size; what reaches the browser is whatever
 * `sizes` asks for, re-encoded to AVIF or WebP.
 */

/** Where to hold the crop, per breakpoint. See the note in app/globals.css. */
export interface StyleFocus {
  /** Below 768px: a tall stage, so the horizontal value is the one that matters. */
  mobile: string;
  /** 768px and up. */
  tablet: string;
  /** 1024px and up: a wide stage, so the vertical value is the one that matters. */
  desktop: string;
}

export interface StyleStory {
  /** Stable identity for React keys. */
  id: string;
  /** The style itself. Read out by the live region as the state changes. */
  title: string;
  description: string;
  /** Uppercased in CSS, so it stays readable here and in search results. */
  buttonLabel: string;
  /** A real route under app/. */
  href: string;
  image: string;
  /**
   * Describes what the photograph is showing a shopper. Deliberately about the
   * styling rather than the individual garment: these are library photographs
   * standing in for TARA campaign work, and an alt naming a specific neckline
   * would be wrong the moment one is swapped.
   */
  imageAlt: string;
  focus: StyleFocus;
}

export const styleStories: readonly StyleStory[] = [
  {
    id: "everyday",
    title: "Everyday Wear",
    description:
      "Easy, graceful pieces designed to move naturally through your everyday moments.",
    buttonLabel: "Everyday Wear",
    href: "/two-piece",
    image: img(stockImages.portraitB, 2000, 2500),
    imageAlt: "A model in a softly draped dress in a muted rose tone",
    focus: { mobile: "58% 50%", tablet: "54% 26%", desktop: "50% 14%" },
  },
  {
    id: "office",
    title: "Office Wear",
    description:
      "Polished styles that bring comfort, confidence and quiet elegance to the working day.",
    buttonLabel: "Office Wear",
    href: "/three-piece",
    image: img(stockImages.portraitJ, 2000, 2500),
    imageAlt: "A model in a structured ivory blazer, styled for the working day",
    focus: { mobile: "50% 50%", tablet: "50% 26%", desktop: "50% 16%" },
  },
  {
    id: "festive",
    title: "Festive Wear",
    description:
      "Refined statement pieces created for celebrations, gatherings and memorable occasions.",
    buttonLabel: "Festive Wear",
    href: "/collection/festive",
    image: img(stockImages.heroWoman, 2000, 2500),
    imageAlt: "A model in a richly coloured saree with a gold border",
    focus: { mobile: "52% 50%", tablet: "51% 24%", desktop: "50% 14%" },
  },
  {
    id: "cotton",
    title: "Comfortable Cotton",
    description:
      "Soft, breathable styles made for effortless comfort from morning to evening.",
    buttonLabel: "Comfortable Cotton",
    href: "/collection/summer",
    image: img(stockImages.portraitI, 2000, 2500),
    imageAlt:
      "A model in a relaxed, ankle-length cotton dress, photographed in warm daylight",
    focus: { mobile: "70% 50%", tablet: "62% 30%", desktop: "50% 20%" },
  },
  {
    id: "new-season",
    title: "New Season Colours",
    description:
      "Fresh tones and considered silhouettes chosen to bring something new to your wardrobe.",
    buttonLabel: "New Season Colours",
    href: "/new-arrivals",
    image: img(stockImages.portraitH, 2000, 2500),
    imageAlt: "A model in a deep plum dress against a soft lilac backdrop",
    // Held low deliberately: higher and this is a jewellery shot, and the
    // garment — which is the reason the frame is here — falls out of the crop.
    focus: { mobile: "62% 50%", tablet: "58% 30%", desktop: "50% 26%" },
  },
];
