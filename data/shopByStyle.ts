import { img, stockImages } from "@/lib/images";

export interface StyleCategory {
  key: string;
  translationKey: string;
  image: string;
  href: string;
}

export const shopByStyleCategories: StyleCategory[] = [
  { key: "everyday", translationKey: "everydayWear", image: img(stockImages.portraitI, 500, 620), href: "/collection?style=everyday" },
  { key: "office", translationKey: "officeWear", image: img(stockImages.portraitK, 500, 620), href: "/collection?style=office" },
  { key: "festive", translationKey: "festiveWear", image: img(stockImages.portraitJ, 500, 620), href: "/collection?style=festive" },
  { key: "cotton", translationKey: "comfortableCotton", image: img(stockImages.portraitB, 500, 620), href: "/collection?style=cotton" },
  { key: "newSeason", translationKey: "newSeasonColours", image: img(stockImages.portraitC, 500, 620), href: "/collection?style=new-season" },
];
