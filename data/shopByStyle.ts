import { img, stockImages } from "@/lib/images";

export interface StyleCategory {
  key: string;
  label: string;
  image: string;
  href: string;
}

export const shopByStyleCategories: StyleCategory[] = [
  { key: "everyday", label: "Everyday Wear", image: img(stockImages.portraitI, 500, 620), href: "/collection?style=everyday" },
  { key: "office", label: "Office Wear", image: img(stockImages.portraitK, 500, 620), href: "/collection?style=office" },
  { key: "festive", label: "Festive Wear", image: img(stockImages.portraitJ, 500, 620), href: "/collection?style=festive" },
  { key: "cotton", label: "Comfortable Cotton", image: img(stockImages.portraitB, 500, 620), href: "/collection?style=cotton" },
  { key: "newSeason", label: "New Season Colours", image: img(stockImages.portraitC, 500, 620), href: "/collection?style=new-season" },
];
