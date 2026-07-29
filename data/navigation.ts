import type { LocalizedText } from "@/types";

export interface NavChildLink {
  label: LocalizedText;
  href: string;
}

export const collectionMenuHeading: LocalizedText = {
  en: "Shop Collections",
  bn: "কালেকশন দেখুন",
};

export const collectionLinks: NavChildLink[] = [
  { label: { en: "Eid Collection", bn: "ঈদ কালেকশন" }, href: "/collection/eid" },
  { label: { en: "Summer Collection", bn: "সামার কালেকশন" }, href: "/collection/summer" },
  { label: { en: "Winter Collection", bn: "উইন্টার কালেকশন" }, href: "/collection/winter" },
  { label: { en: "Festive Collection", bn: "ফেস্টিভ কালেকশন" }, href: "/collection/festive" },
  { label: { en: "New Arrivals", bn: "নতুন এসেছে" }, href: "/new-arrivals" },
  { label: { en: "All Collections", bn: "সব কালেকশন" }, href: "/collection" },
];
