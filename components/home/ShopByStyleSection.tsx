import { styleStories } from "@/data/shopByStyle";
import { StyleStoryStage } from "./StyleStoryStage";

/**
 * "Shop by Style / Find Your Look".
 *
 * A server component holding nothing but the data, the same split the hero
 * uses: the five style stories are content and belong on the server, and only
 * the pinned stage that reveals them needs to be a client component.
 *
 * This replaced a row of five equal cards. Five categories shown at one fifth
 * of the width each is a menu, not a look — nothing in it was big enough to
 * sell a garment, and every link went to the same unfiltered listing. The
 * replacement gives one style the whole screen at a time, full bleed, and
 * sends each one somewhere different; see data/shopByStyle.ts for where, and
 * why.
 */
export function ShopByStyleSection() {
  return <StyleStoryStage stories={styleStories} />;
}
