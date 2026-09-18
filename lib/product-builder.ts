import { ONE_SIZE, UNREADY_SIZE, normaliseSizeValue } from "./product-size";
import { suggestVariantSku } from "./product-sku";

/**
 * The Product Builder's rules, with no React and no database in them.
 *
 * Adding a product used to be two screens: fill in the product, press Create,
 * land on the editor and then go looking for where variants live. The builder
 * makes it one — and the parts of that which are easy to get wrong (turning
 * colours and sizes into variant rows without losing what somebody already
 * typed, deciding whether a product is ready to go live, naming the stage that
 * failed) live here, where tests/product-builder.test.ts can pin them down.
 */

// --- Sizes -----------------------------------------------------------------

/** The sizes offered as one-tap chips. Anything else is typed. */
export const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

/** Sizes for products that are not sold by size. */
export const PLACEHOLDER_SIZE_PRESETS = [ONE_SIZE, UNREADY_SIZE] as const;

/**
 * Cleans a typed size and returns null for one that should not be added.
 *
 * Normalised through the same function checkout uses, so "Unstitched" typed by
 * habit becomes "Unready" here rather than creating a variant the storefront
 * then renames.
 */
export function cleanSize(value: string): string | null {
  const trimmed = normaliseSizeValue(value.replace(/\s+/g, " "));
  if (!trimmed || trimmed.length > 40) return null;
  return trimmed;
}

/** Adds sizes to a list, ignoring duplicates in any letter case. */
export function addSizes(current: readonly string[], additions: readonly string[]): string[] {
  const seen = new Set(current.map((size) => size.toLowerCase()));
  const next = [...current];
  for (const raw of additions) {
    const size = cleanSize(raw);
    if (!size || seen.has(size.toLowerCase())) continue;
    seen.add(size.toLowerCase());
    next.push(size);
  }
  return next;
}

/** Splits "S, M, L" or "38 40 42" into sizes. */
export function parseSizeList(input: string): string[] {
  return input
    .split(/[,;\n]+|\s{2,}/)
    .flatMap((part) => (part.includes(",") ? part.split(",") : [part]))
    .map((part) => part.trim())
    .filter(Boolean);
}

// --- Variant rows ----------------------------------------------------------

/** A colour as the builder knows it: the draft's key, and what it is called. */
export interface BuilderColour {
  key: string;
  name: string;
  hex: string;
}

/** One size-and-colour combination, before and after it exists. */
export interface VariantRow {
  /** `${colourKey}::${size}` — stable while the colour and size exist. */
  key: string;
  colourKey: string;
  size: string;
  sku: string;
  /** True once somebody typed in the SKU field; the suggestion stops then. */
  skuEdited: boolean;
  openingStock: string;
  priceOverride: string;
  lowStockThreshold: string;
  isActive: boolean;
  /** Left out of the product without being deleted from the grid. */
  excluded: boolean;
  /** `product_variants.id` once created. A created row is never sent again. */
  variantId: string | null;
  error: string | null;
}

export function variantRowKey(colourKey: string, size: string): string {
  return `${colourKey}::${size.toLowerCase()}`;
}

/**
 * The variant grid for a set of colours and sizes.
 *
 * EVERY COMBINATION, AND NOTHING TYPED IS LOST. Adding a size adds a row per
 * colour; removing a colour removes its rows. A row that already existed —
 * with a SKU somebody typed, an opening stock, a price — is carried across
 * untouched, so reshaping the grid never throws away work.
 *
 * A row that has been CREATED is kept even if its colour or size is taken out
 * of the selection: it exists in the database now, and silently dropping it
 * from the screen would hide a real variant rather than remove one. Removing a
 * variant after it exists is the editor's job.
 *
 * SKUs are suggested from the product code, size and colour — the same house
 * style the editor uses — until somebody types their own.
 */
export function buildVariantRows({
  colours,
  sizes,
  previous,
  productCode,
}: {
  colours: readonly BuilderColour[];
  sizes: readonly string[];
  previous: readonly VariantRow[];
  productCode: string;
}): VariantRow[] {
  const byKey = new Map(previous.map((row) => [row.key, row]));
  const rows: VariantRow[] = [];

  for (const colour of colours) {
    for (const size of sizes) {
      const key = variantRowKey(colour.key, size);
      const existing = byKey.get(key);
      const suggested = suggestVariantSku(productCode, size, colour.name.trim());

      if (existing) {
        rows.push({
          ...existing,
          size,
          sku: existing.skuEdited || existing.variantId ? existing.sku : suggested,
        });
        byKey.delete(key);
      } else {
        rows.push({
          key,
          colourKey: colour.key,
          size,
          sku: suggested,
          skuEdited: false,
          openingStock: "0",
          priceOverride: "",
          lowStockThreshold: "3",
          isActive: true,
          excluded: false,
          variantId: null,
          error: null,
        });
      }
    }
  }

  // Created rows the new selection no longer covers. Kept, and kept last.
  for (const row of byKey.values()) {
    if (row.variantId) rows.push(row);
  }

  return rows;
}

/** The rows that will be sent: included, and not already created. */
export function outstandingVariants(rows: readonly VariantRow[]): VariantRow[] {
  return rows.filter((row) => !row.excluded && !row.variantId);
}

/** The rows that are, or will be, part of the product. */
export function includedVariants(rows: readonly VariantRow[]): VariantRow[] {
  return rows.filter((row) => !row.excluded || row.variantId);
}

/**
 * Problems a row has before it is sent, keyed by row key.
 *
 * The server checks all of this again — the SKU pattern, uniqueness across the
 * whole store, the numbers — so this exists to point at the row now rather than
 * after a round trip.
 */
export function validateVariantRows(rows: readonly VariantRow[]): Map<string, string> {
  const problems = new Map<string, string>();
  const skus = new Map<string, string>();

  for (const row of outstandingVariants(rows)) {
    const sku = row.sku.trim().toUpperCase();
    if (!sku) {
      problems.set(row.key, "Enter a SKU.");
      continue;
    }
    // The same rule as the `sku` schema in lib/validation.ts, which the server
    // applies again.
    if (sku.length < 2 || sku.length > 40 || !/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
      problems.set(row.key, "Use 2 to 40 letters, numbers, dots, underscores or hyphens.");
      continue;
    }
    const clash = skus.get(sku);
    if (clash) {
      problems.set(row.key, "Two variants have the same SKU.");
      problems.set(clash, "Two variants have the same SKU.");
      continue;
    }
    skus.set(sku, row.key);

    const stock = Number(row.openingStock || "0");
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
      problems.set(row.key, "Opening stock must be a whole number, 0 or more.");
      continue;
    }
    if (row.priceOverride.trim()) {
      const price = Number(row.priceOverride);
      if (!Number.isFinite(price) || price < 0) {
        problems.set(row.key, "The price override must be a number, 0 or more.");
        continue;
      }
    }
    const threshold = Number(row.lowStockThreshold || "3");
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 10_000) {
      problems.set(row.key, "The low stock threshold must be a whole number.");
    }
  }

  return problems;
}

// --- Readiness -------------------------------------------------------------

export type BuilderSection =
  | "basics"
  | "media"
  | "variants"
  | "details"
  | "merchandising"
  | "review";

export interface ReadinessItem {
  id: string;
  label: string;
  ok: boolean;
  /** Required to publish. A draft may be missing anything. */
  required: boolean;
  /** Where to go to fix it. */
  section: BuilderSection;
  /** The first field to focus, when there is one. */
  fieldId?: string;
  hint: string;
}

export interface ReadinessInput {
  name: string;
  productCode: string;
  categoryId: string;
  basePrice: string;
  description: string;
  fabric: string;
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
  colourNames: string[];
  imageCount: number;
  /** Colours with photographs of their own, when photographing per colour. */
  coloursWithoutImages: string[];
  photographsPerColour: boolean;
  variantCount: number;
  totalOpeningStock: number;
}

/**
 * What stands between this product and the storefront.
 *
 * REQUIRED means publishing is refused until it is fixed. The two text rules
 * are the ones the server itself enforces for an active product —
 * `missingForActiveProduct()` and the refinements on `adminProductSchema` — so
 * the checklist can never let through something the database then rejects.
 * The rest (a photograph, a colour, a variant) are the builder's own standard:
 * a product page with nothing to buy, or nothing to look at, is not ready, even
 * though an older product might have gone live without them.
 *
 * RECOMMENDED items are shown but never block. A product with zero opening
 * stock is allowed to go live — it will say "Out of Stock" — but the checklist
 * says so first, because that is rarely what somebody meant.
 */
export function builderReadiness(input: ReadinessInput): ReadinessItem[] {
  const price = Number(input.basePrice);
  const namedColours = input.colourNames.filter((name) => name.trim());

  return [
    {
      id: "name",
      label: "Product name",
      ok: input.name.trim().length >= 2,
      required: true,
      section: "basics",
      fieldId: "nameEn",
      hint: "Give the product a name of at least two characters.",
    },
    {
      id: "code",
      label: "Product code",
      ok: input.productCode.trim().length >= 2,
      required: true,
      section: "basics",
      fieldId: "productCode",
      hint: "Enter the product code, e.g. TARA2401.",
    },
    {
      id: "category",
      label: "Category selected",
      ok: Boolean(input.categoryId),
      required: true,
      section: "basics",
      fieldId: "categoryId",
      hint: "Choose which category the product belongs to.",
    },
    {
      id: "price",
      label: "Price added",
      ok: input.basePrice.trim() !== "" && Number.isFinite(price) && price >= 0,
      required: true,
      section: "basics",
      fieldId: "basePrice",
      hint: "Enter the selling price.",
    },
    {
      id: "description",
      label: "Description added",
      ok: input.description.trim().length >= 10,
      required: true,
      section: "basics",
      fieldId: "descriptionEn",
      hint: "Write at least a sentence — it is shown on the product page.",
    },
    {
      id: "colours",
      label: "Colours configured",
      ok: namedColours.length > 0 && namedColours.length === input.colourNames.length,
      required: true,
      section: "media",
      hint:
        input.colourNames.length > namedColours.length
          ? "Every colour needs a name."
          : "Add at least one colour. Variants are built from the colours.",
    },
    {
      id: "images",
      label: "Images uploaded",
      ok: input.imageCount > 0,
      required: true,
      section: "media",
      hint: "Add at least one photograph. The first becomes the product's cover.",
    },
    {
      id: "colour-images",
      label: "Every colour photographed",
      ok: !input.photographsPerColour || input.coloursWithoutImages.length === 0,
      required: false,
      section: "media",
      hint: `No photographs yet for ${input.coloursWithoutImages.join(", ")}. Customers who pick it will see the general photographs.`,
    },
    {
      id: "variants",
      label: "Variants created",
      ok: input.variantCount > 0,
      required: true,
      section: "variants",
      hint: "Choose at least one size so there is something to buy.",
    },
    {
      id: "stock",
      label: "Stock entered",
      ok: input.variantCount > 0 && input.totalOpeningStock > 0,
      required: false,
      section: "variants",
      hint: "Every variant starts at zero, so the product will show as out of stock.",
    },
    {
      id: "fabric",
      label: "Fabric information added",
      ok: input.fabric.trim().length >= 2,
      required: true,
      section: "details",
      fieldId: "fabricEn",
      hint: "Say what it is made of — the question customers ask most.",
    },
    {
      id: "care",
      label: "Care instructions",
      ok: input.careInstructions.trim().length >= 5,
      required: false,
      section: "details",
      fieldId: "careInstructionsEn",
      hint: "Optional. How to wash it.",
    },
    {
      id: "seo",
      label: "Search engine listing",
      ok: Boolean(input.seoTitle.trim() || input.seoDescription.trim()),
      required: false,
      section: "merchandising",
      fieldId: "seoTitle",
      hint: "Optional. Without one, the name and description are used.",
    },
  ];
}

/** The required items that are not done. Empty means it can be published. */
export function blockingItems(items: readonly ReadinessItem[]): ReadinessItem[] {
  return items.filter((item) => item.required && !item.ok);
}

// --- The save pipeline -----------------------------------------------------

/**
 * The stages a save runs through, in order.
 *
 * Named so the action bar can say exactly where a failure happened — "Failed
 * while uploading images" is something a person can act on; "Could not save"
 * is not.
 */
export type SaveStage =
  | "product"
  | "colours"
  | "images"
  | "order"
  | "variants"
  | "publish";

export const SAVE_STAGE_LABELS: Record<SaveStage, { running: string; failed: string }> = {
  product: { running: "Saving product…", failed: "Saving the product details failed." },
  colours: { running: "Creating colours…", failed: "Creating the colours failed." },
  images: { running: "Uploading images…", failed: "Some images could not be uploaded." },
  order: { running: "Arranging images…", failed: "The image order could not be saved." },
  variants: { running: "Creating variants…", failed: "Some variants could not be created." },
  publish: { running: "Publishing…", failed: "The product was saved but could not be published." },
};
