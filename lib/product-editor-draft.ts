import type { Tables } from "@/types/database";
import { cleanSize } from "./product-builder";
import { describeColourNameProblems, normaliseColourName } from "./product-colour-images";

/**
 * The product editor's unsaved changes.
 *
 * NOTHING IS WRITTEN UNTIL "SAVE CHANGES"
 * ---------------------------------------
 * Every change on the edit screen — a renamed colour, a new photograph, a
 * variant switched off, a stock correction — is held here, in the browser, and
 * the product in the database does not move until the administrator presses
 * the one Save changes button. Discard puts everything back.
 *
 * The editor keeps two copies of this shape: `saved`, what the database holds,
 * and `draft`, what is on screen. `planChanges(saved, draft)` is the list of
 * writes that turns one into the other. After each write succeeds the editor
 * folds it into `saved`, so if the fourth step fails, pressing Save changes
 * again sends only what is still different — never a second colour, a second
 * upload or a second variant.
 *
 * Kept free of React and the DOM so the test runner can load it.
 */

type ColourRow = Tables<"product_colours">;
type ImageRow = Tables<"product_images">;
type VariantRow = Tables<"product_variants">;

export interface ColourDraft {
  /** The row id for a colour that exists; a generated key for a new one. */
  key: string;
  id: string | null;
  name: string;
  hex: string;
  isActive: boolean;
  deleted: boolean;
}

export interface ImageDraft {
  key: string;
  id: string | null;
  /** The stored URL, or a blob: preview for a file that is not uploaded yet. */
  url: string;
  /** Present only for a photograph that has not been uploaded yet. */
  file: File | null;
  /** A colour KEY (not id), so a photograph can belong to a colour that is also new. */
  colourKey: string | null;
  role: string;
  alt: string;
  deleted: boolean;
}

/** A stock correction, applied through the audited inventory adjustment. */
export interface StockChange {
  newQuantity: string;
  reason: string;
  note: string;
}

export interface VariantDraft {
  key: string;
  id: string | null;
  size: string;
  /**
   * The colour key, for a product with colours. Null for a variant that still
   * carries its colour as free text, which is how products worked before
   * colours existed — `colourName` and `colourHex` then say what it is.
   */
  colourKey: string | null;
  colourName: string;
  colourHex: string;
  sku: string;
  priceOverride: string;
  lowStockThreshold: string;
  isActive: boolean;
  /** Only for a variant that does not exist yet. */
  openingStock: string;
  /** The stock the database holds. Read-only here. */
  stock: number;
  stockChange: StockChange | null;
}

export interface EditorDraft {
  colours: ColourDraft[];
  /** In gallery order. */
  images: ImageDraft[];
  primaryKey: string | null;
  variants: VariantDraft[];
}

export function draftFromRows({
  colours,
  images,
  variants,
}: {
  colours: readonly ColourRow[];
  images: readonly ImageRow[];
  variants: readonly VariantRow[];
}): EditorDraft {
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const colourByName = new Map(colours.map((colour) => [normaliseColourName(colour.name_en), colour.id]));
  return {
    colours: colours.map((colour) => ({
      key: colour.id,
      id: colour.id,
      name: colour.name_en,
      hex: colour.colour_hex.toUpperCase(),
      isActive: colour.is_active,
      deleted: false,
    })),
    images: ordered.map((image) => ({
      key: image.id,
      id: image.id,
      url: image.image_url,
      file: null,
      colourKey: image.product_colour_id,
      role: image.media_role ?? "",
      alt: image.alt_en ?? "",
      deleted: false,
    })),
    primaryKey: (ordered.find((image) => image.is_primary) ?? ordered[0])?.id ?? null,
    variants: variants.map((variant) => ({
      key: variant.id,
      id: variant.id,
      size: variant.size,
      // A variant created before its product had colours still opens on the
      // colour with the same name, as the old variant form did.
      colourKey:
        variant.product_colour_id ?? colourByName.get(normaliseColourName(variant.colour_en)) ?? null,
      colourName: variant.colour_en,
      colourHex: variant.colour_hex.toUpperCase(),
      sku: variant.sku,
      priceOverride: variant.price_override === null ? "" : String(variant.price_override),
      lowStockThreshold: String(variant.low_stock_threshold),
      isActive: variant.is_active,
      openingStock: "0",
      stock: variant.stock_quantity,
      stockChange: null,
    })),
  };
}

// --- What needs writing ----------------------------------------------------

export interface SavePlan {
  colourWrites: ColourDraft[];
  colourDeletes: ColourDraft[];
  imageDeletes: ImageDraft[];
  imageUploads: ImageDraft[];
  imageUpdates: { image: ImageDraft; colour: boolean; role: boolean; alt: boolean }[];
  /** The gallery order or the main image differs from what is stored. */
  reorder: boolean;
  variantWrites: VariantDraft[];
  stockChanges: VariantDraft[];
}

const sameText = (a: string, b: string) => a.trim() === b.trim();

function colourChanged(saved: ColourDraft, draft: ColourDraft) {
  return (
    !sameText(saved.name, draft.name) ||
    saved.hex.toUpperCase() !== draft.hex.toUpperCase() ||
    saved.isActive !== draft.isActive
  );
}

function variantChanged(saved: VariantDraft, draft: VariantDraft) {
  return (
    !sameText(saved.size, draft.size) ||
    saved.colourKey !== draft.colourKey ||
    (draft.colourKey === null &&
      (!sameText(saved.colourName, draft.colourName) ||
        saved.colourHex.toUpperCase() !== draft.colourHex.toUpperCase())) ||
    saved.sku.trim().toUpperCase() !== draft.sku.trim().toUpperCase() ||
    !sameText(saved.priceOverride, draft.priceOverride) ||
    !sameText(saved.lowStockThreshold, draft.lowStockThreshold) ||
    saved.isActive !== draft.isActive
  );
}

/** A stock change that would actually move the number. */
export function hasStockChange(variant: VariantDraft): boolean {
  if (!variant.id || !variant.stockChange) return false;
  const next = variant.stockChange.newQuantity.trim();
  return next !== "" && Number(next) !== variant.stock;
}

export function planChanges(saved: EditorDraft, draft: EditorDraft): SavePlan {
  const savedColours = new Map(saved.colours.map((colour) => [colour.key, colour]));
  const savedImages = new Map(saved.images.map((image) => [image.key, image]));
  const savedVariants = new Map(saved.variants.map((variant) => [variant.key, variant]));

  const colourWrites = draft.colours.filter((colour) => {
    if (colour.deleted) return false;
    const before = savedColours.get(colour.key);
    return !colour.id || !before || colourChanged(before, colour);
  });
  const colourDeletes = draft.colours.filter((colour) => colour.deleted && colour.id);

  const imageDeletes = draft.images.filter((image) => image.deleted && image.id);
  const imageUploads = draft.images.filter((image) => !image.deleted && !image.id && image.file);
  const imageUpdates = draft.images.flatMap((image) => {
    if (image.deleted || !image.id) return [];
    const before = savedImages.get(image.key);
    if (!before) return [];
    const change = {
      image,
      colour: before.colourKey !== image.colourKey,
      role: before.role !== image.role,
      alt: !sameText(before.alt, image.alt),
    };
    return change.colour || change.role || change.alt ? [change] : [];
  });

  const liveKeys = (images: readonly ImageDraft[]) =>
    images.filter((image) => !image.deleted).map((image) => image.key);
  const savedOrder = liveKeys(saved.images);
  const draftOrder = liveKeys(draft.images);
  const reorder =
    imageUploads.length > 0 ||
    imageDeletes.length > 0 ||
    savedOrder.join("|") !== draftOrder.join("|") ||
    (draftOrder.length > 0 && saved.primaryKey !== draft.primaryKey);

  const variantWrites = draft.variants.filter((variant) => {
    const before = savedVariants.get(variant.key);
    return !variant.id || !before || variantChanged(before, variant);
  });
  const stockChanges = draft.variants.filter(hasStockChange);

  return {
    colourWrites,
    colourDeletes,
    imageDeletes,
    imageUploads,
    imageUpdates,
    reorder,
    variantWrites,
    stockChanges,
  };
}

/** One line per kind of change, for the bar at the bottom of the screen. */
export function describePlan(plan: SavePlan, detailsChanged: boolean): string[] {
  const lines: string[] = [];
  const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  if (detailsChanged) lines.push("product details");
  const colours = plan.colourWrites.length + plan.colourDeletes.length;
  if (colours) lines.push(count(colours, "colour"));
  const photos = plan.imageUploads.length + plan.imageDeletes.length + plan.imageUpdates.length;
  if (photos) lines.push(count(photos, "photograph"));
  else if (plan.reorder) lines.push("photograph order");
  if (plan.variantWrites.length) lines.push(count(plan.variantWrites.length, "variant"));
  if (plan.stockChanges.length) lines.push(count(plan.stockChanges.length, "stock change"));
  return lines;
}

export function planIsEmpty(plan: SavePlan): boolean {
  return (
    plan.colourWrites.length === 0 &&
    plan.colourDeletes.length === 0 &&
    plan.imageDeletes.length === 0 &&
    plan.imageUploads.length === 0 &&
    plan.imageUpdates.length === 0 &&
    !plan.reorder &&
    plan.variantWrites.length === 0 &&
    plan.stockChanges.length === 0
  );
}

// --- Checking before anything is sent --------------------------------------

export interface DraftProblems {
  /** One sentence about the colours, or null. */
  colours: string | null;
  /** Problems by variant key. */
  variants: Map<string, string>;
}

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

/**
 * What would be refused, found before the first write.
 *
 * The server checks all of it again. Checking here means a typo in the fifth
 * variant stops the save before the product details, the colours and the
 * photographs have been written — so a save either goes through or points at
 * the problem, rather than half-applying.
 */
export function validateDraft(draft: EditorDraft): DraftProblems {
  const live = draft.colours.filter((colour) => !colour.deleted);
  let colours = describeColourNameProblems(live);
  if (!colours) {
    const badHex = live.find((colour) => !/^#[0-9A-Fa-f]{6}$/.test(colour.hex));
    if (badHex) colours = `The swatch for ${badHex.name.trim()} is not a colour.`;
  }

  const variants = new Map<string, string>();
  const skus = new Map<string, string>();
  const colourKeys = new Set(live.map((colour) => colour.key));

  for (const variant of draft.variants) {
    const sku = variant.sku.trim().toUpperCase();
    const problem = (() => {
      if (!cleanSize(variant.size)) return "Enter a size.";
      if (variant.colourKey !== null && !colourKeys.has(variant.colourKey)) {
        return "Choose a colour for this variant.";
      }
      if (variant.colourKey === null && !variant.colourName.trim()) return "Enter a colour.";
      if (!sku) return "Enter a SKU.";
      if (sku.length < 2 || sku.length > 40 || !SKU_PATTERN.test(sku)) {
        return "SKU: use 2 to 40 letters, numbers, dots, underscores or hyphens.";
      }
      if (!variant.id) {
        const opening = Number(variant.openingStock.trim() || "0");
        if (!Number.isInteger(opening) || opening < 0 || opening > 1_000_000) {
          return "Opening stock must be a whole number, 0 or more.";
        }
      }
      if (variant.priceOverride.trim()) {
        const price = Number(variant.priceOverride);
        if (!Number.isFinite(price) || price < 0) return "The price override must be a number, 0 or more.";
      }
      const threshold = Number(variant.lowStockThreshold.trim() || "3");
      if (!Number.isInteger(threshold) || threshold < 0 || threshold > 10_000) {
        return "The low stock threshold must be a whole number.";
      }
      if (variant.stockChange && hasStockChange(variant)) {
        const next = Number(variant.stockChange.newQuantity);
        if (!Number.isInteger(next) || next < 0 || next > 1_000_000) {
          return "New stock must be a whole number, 0 or more.";
        }
        if (!variant.stockChange.reason) return "Choose a reason for the stock change.";
      }
      return null;
    })();

    if (problem) {
      variants.set(variant.key, problem);
      continue;
    }
    const clash = skus.get(sku);
    if (clash) {
      variants.set(variant.key, "Two variants have the same SKU.");
      variants.set(clash, "Two variants have the same SKU.");
      continue;
    }
    skus.set(sku, variant.key);
  }

  return { colours, variants };
}

/** Whether a colour can be deleted, or the sentence that explains why not. */
export function colourDeleteBlocker(draft: EditorDraft, colourKey: string): string | null {
  const used = draft.variants.filter((variant) => variant.colourKey === colourKey);
  if (used.some((variant) => variant.id)) {
    return "Variants customers can buy use this colour, so it cannot be deleted. Turn it off instead — orders, SKUs and stock history stay intact.";
  }
  return null;
}
