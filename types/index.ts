export type Locale = "bn" | "en";

export type ProductCategory =
  | "unstitched-three-piece"
  | "ready-three-piece"
  | "accessories"
  | "collection";

export interface LocalizedText {
  en: string;
  bn: string;
}

export interface ColourOption {
  name: LocalizedText;
  hex: string;
}

export interface ReviewSummary {
  rating: number;
  count: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: LocalizedText;
}

export interface UnstitchedDetails {
  kameezFabric: LocalizedText;
  salwarFabric: LocalizedText;
  dupattaFabric: LocalizedText;
  workDetails: LocalizedText;
  fabricLength: LocalizedText;
  colourInfo: LocalizedText;
}

export interface ReadyMadeDetails {
  sizeMeasurements: { size: string; chest: string; waist: string; length: string }[];
  modelHeight: LocalizedText;
  modelWearingSize: string;
  fitInformation: LocalizedText;
}

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  category: ProductCategory;
  price: number;
  previousPrice?: number;
  images: string[];
  colours: ColourOption[];
  sizes: string[];
  fabric: LocalizedText;
  stock: number;
  tags: string[];
  collection: string;
  isNew: boolean;
  isSale: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  rating: number;
  reviewCount: number;
  productCode: string;
  careInstructions: LocalizedText;
  unstitchedDetails?: UnstitchedDetails;
  readyMadeDetails?: ReadyMadeDetails;
  reviews: Review[];
}

export interface CartItem {
  productId: string;
  slug: string;
  name: LocalizedText;
  image: string;
  price: number;
  size: string;
  colour: string;
  quantity: number;
}

export interface WishlistItem {
  productId: string;
  slug: string;
  name: LocalizedText;
  image: string;
  price: number;
  previousPrice?: number;
}
