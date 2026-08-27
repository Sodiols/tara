/**
 * The four categories that have a hand-built storefront route.
 *
 * A product's `category` field holds the real category slug from the database,
 * which staff can create freely in /admin/categories — so it is NOT limited to
 * these four. Use `ProductCategory` only where one of the built-in routes is
 * genuinely meant; use `product.categoryName` to display a category to a
 * customer.
 */
export type ProductCategory =
  | "unstitched-three-piece"
  | "ready-three-piece"
  | "hijab"
  | "accessories"
  | "collection";

/** Any category slug, including ones created by staff after launch. */
export type CategorySlug = string;

export interface ColourOption {
  name: string;
  hex: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
}

export interface UnstitchedDetails {
  kameezFabric: string;
  salwarFabric: string;
  dupattaFabric: string;
  workDetails: string;
  fabricLength: string;
  colourInfo: string;
}

export interface ReadyMadeDetails {
  sizeMeasurements: { size: string; chest: string; waist: string; length: string }[];
  modelHeight: string;
  modelWearingSize: string;
  fitInformation: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** The category's slug. Not restricted to the four built-in routes. */
  category: CategorySlug;
  /**
   * The category's English display name, read from the database.
   * Optional because the offline seed catalogue predates it; when absent, the
   * label is derived from the slug.
   */
  categoryName?: string;
  price: number;
  previousPrice?: number;
  images: string[];
  colours: ColourOption[];
  sizes: string[];
  fabric: string;
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
  careInstructions: string;
  unstitchedDetails?: UnstitchedDetails;
  readyMadeDetails?: ReadyMadeDetails;
  reviews: Review[];
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  size: string;
  colour: string;
  quantity: number;
}

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  previousPrice?: number;
}
