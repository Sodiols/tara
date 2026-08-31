import type { StaticImageData } from "next/image";
import eid from "@/public/images/collections/eid.webp";
import summer from "@/public/images/collections/summer.webp";
import winter from "@/public/images/collections/winter.webp";
import festive from "@/public/images/collections/festive.webp";
import newArrivals from "@/public/images/collections/new-arrivals.webp";

export interface CollectionEditorialItem {
  id: string;
  name: string;
  label: string;
  image: StaticImageData;
  alt: string;
  href: string;
  collectionSlug?: string;
  objectPosition: string;
}

/** Same canonical destinations as data/navigation.ts; never query-only edits. */
export const collectionEditorials: readonly CollectionEditorialItem[] = [
  {
    id: "eid", name: "Eid", label: "Eid edit", image: eid,
    alt: "A model in an ivory embroidered kameez, matching trousers and a delicate gold-edged dupatta",
    href: "/collection/eid", collectionSlug: "eid", objectPosition: "50% 50%",
  },
  {
    id: "summer", name: "Summer", label: "Summer edit", image: summer,
    alt: "A model in a light sage botanical-print three piece and airy dupatta in courtyard sunlight",
    href: "/collection/summer", collectionSlug: "summer", objectPosition: "50% 50%",
  },
  {
    id: "winter", name: "Winter", label: "Winter edit", image: winter,
    alt: "A model in a cocoa kameez and trousers, layered with a softly embroidered oatmeal shawl",
    href: "/collection/winter", collectionSlug: "winter", objectPosition: "50% 50%",
  },
  {
    id: "festive", name: "Festive", label: "Festive edit", image: festive,
    alt: "A model wearing a deep wine three piece with fine gold embroidery and a sheer matching dupatta",
    href: "/collection/festive", collectionSlug: "festive", objectPosition: "50% 50%",
  },
  {
    id: "new-arrivals", name: "New Arrivals", label: "New arrivals", image: newArrivals,
    alt: "A model in a contemporary dusty rose kameez with tonal embroidery, straight trousers and a flowing dupatta",
    href: "/new-arrivals", objectPosition: "50% 50%",
  },
];
