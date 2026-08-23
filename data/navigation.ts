export interface NavChildLink {
  label: string;
  href: string;
}

export const collectionMenuHeading = "Shop Collections";

export const collectionLinks: NavChildLink[] = [
  { label: "Eid Collection", href: "/collection/eid" },
  { label: "Summer Collection", href: "/collection/summer" },
  { label: "Winter Collection", href: "/collection/winter" },
  { label: "Festive Collection", href: "/collection/festive" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "All Collections", href: "/collection" },
];
