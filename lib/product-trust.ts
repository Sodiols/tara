import type { ProductMediaRole } from "@/types/database";

/**
 * Is this listing good enough to sell clothing from?
 *
 * WHY THIS EXISTS
 * ---------------
 * A customer buying a kameez online cannot touch the fabric, cannot see the
 * back, and cannot try the size. Everything they have is what the listing says
 * — so a listing with one photograph, no fabric line and no size information is
 * not a small gap in the back office, it is the reason the order does not
 * happen. This module turns "is it finished?" into a list somebody can work
 * through.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not block anything. A draft is work in progress and being warned that
 * a half-entered product is half-entered teaches staff to type a full stop into
 * a field to make a message go away. `adminProductSchema` already refuses to
 * ACTIVATE a product with no description or no fabric; this is advice about
 * everything else, and saving is never prevented.
 *
 * It also does not invent anything. A missing photograph is reported as a
 * missing photograph — the storefront shows a neutral placeholder — and is
 * never filled in with stock fashion photography of a garment TARA does not
 * sell.
 */

/** What a product photograph can be said to show. Mirrors migration 0026. */
export const MEDIA_ROLES = [
  "front",
  "back",
  "side",
  "fabric",
  "detail",
  "bottom",
  "dupatta",
  "model",
  "other",
] as const satisfies readonly ProductMediaRole[];

export const MEDIA_ROLE_LABELS: Record<ProductMediaRole, string> = {
  front: "Front view",
  back: "Back view",
  side: "Three quarter or side view",
  fabric: "Fabric close up",
  detail: "Design detail",
  bottom: "Trouser or bottom piece",
  dupatta: "Dupatta or orna",
  model: "On the model",
  other: "Other",
};

/** A short phrase for alt text, when nobody has written any. */
export function mediaRoleAlt(role: ProductMediaRole | null | undefined): string | null {
  if (!role || role === "other") return null;
  return MEDIA_ROLE_LABELS[role].toLowerCase();
}

export function isMediaRole(value: unknown): value is ProductMediaRole {
  return typeof value === "string" && (MEDIA_ROLES as readonly string[]).includes(value);
}

export type TrustSeverity = "required" | "recommended";

export interface TrustCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: TrustSeverity;
  /** What to do about it, in one sentence. Shown only when the check fails. */
  hint: string;
}

export interface ProductTrustInput {
  description: string | null;
  fabric: string | null;
  careInstructions: string | null;
  status: "draft" | "active" | "archived";
  images: { isPrimary: boolean; role: ProductMediaRole | null; altText: string | null }[];
  variants: { size: string; colourName: string; stock: number; isActive: boolean }[];
  colourCount: number;
  videoUrl: string | null;
  /**
   * Whether the shop itself has stated its delivery estimate and exchange
   * window. These are store settings, not product fields — but a product page
   * shows them, so a listing is not complete if the shop has left them blank.
   */
  shop: { deliveryStated: boolean; exchangeStated: boolean };
}

export interface TrustReport {
  checks: TrustCheck[];
  /** Passed checks out of all checks, 0-100. */
  score: number;
  missingRequired: number;
  /** Roles no photograph claims yet, as labels. */
  missingViews: string[];
}

/**
 * The photographs a clothing listing is expected to have.
 *
 * Front and back are required because they are the two a customer asks for
 * first. The fabric close-up is next, because texture is the thing a
 * photograph is worst at conveying and the thing an exchange is most often
 * about. The rest are recommended and depend on the garment — a hijab has no
 * trouser piece.
 */
const EXPECTED_VIEWS: { role: ProductMediaRole; severity: TrustSeverity }[] = [
  { role: "front", severity: "required" },
  { role: "back", severity: "required" },
  { role: "fabric", severity: "recommended" },
  { role: "detail", severity: "recommended" },
];

export function productTrustReport(input: ProductTrustInput): TrustReport {
  const activeVariants = input.variants.filter((variant) => variant.isActive);
  const sizes = new Set(activeVariants.map((variant) => variant.size).filter(Boolean));
  const inStock = activeVariants.reduce((total, variant) => total + variant.stock, 0);
  const labelledRoles = new Set(
    input.images.map((image) => image.role).filter((role): role is ProductMediaRole => !!role),
  );

  const checks: TrustCheck[] = [
    {
      id: "main-image",
      label: "Main image",
      ok: input.images.some((image) => image.isPrimary),
      severity: "required",
      hint: "Upload a photograph and mark it as the main image. Until then the storefront shows a neutral placeholder.",
    },
    {
      id: "multiple-images",
      label: "Several photographs",
      ok: input.images.length >= 3,
      severity: "required",
      hint: "Three or more. One photograph of a garment is not enough to decide from.",
    },
    {
      id: "image-alt",
      label: "Photograph descriptions",
      ok:
        input.images.length > 0 &&
        input.images.every((image) => (image.altText ?? "").trim().length > 0),
      severity: "recommended",
      hint: "Describe each photograph. It is what a screen reader reads out and what a search engine indexes.",
    },
    {
      id: "description",
      label: "Description",
      ok: (input.description ?? "").trim().length >= 40,
      severity: "required",
      hint: "Write at least a couple of sentences about the piece.",
    },
    {
      id: "fabric",
      label: "Fabric information",
      ok: (input.fabric ?? "").trim().length >= 2,
      severity: "required",
      hint: "Say what it is made of. This is the question customers ask most.",
    },
    {
      id: "care",
      label: "Care instructions",
      ok: (input.careInstructions ?? "").trim().length >= 5,
      severity: "recommended",
      hint: "How to wash it. Shown in the product accordion.",
    },
    {
      id: "sizes",
      label: "Sizes configured",
      ok: sizes.size > 0,
      severity: "required",
      hint: "Add the variants this product is sold in. Nothing can be bought without them.",
    },
    {
      id: "colours",
      label: "Colour information",
      ok: input.colourCount > 0 || activeVariants.some((variant) => variant.colourName),
      severity: "recommended",
      hint: "Define the colourways, then attach each colour's photographs to it.",
    },
    {
      id: "stock",
      label: "Stock",
      ok: inStock > 0,
      severity: "required",
      hint: "Every variant is at zero, so the product cannot be ordered. Adjust stock from Inventory.",
    },
    {
      id: "video",
      label: "Product video",
      ok: Boolean(input.videoUrl?.trim()),
      severity: "recommended",
      hint: "Optional. A short clip of the fabric moving answers more questions than another photograph.",
    },
    {
      id: "delivery-information",
      label: "Delivery information",
      ok: input.shop.deliveryStated,
      severity: "required",
      hint: "Shop-wide: fill in the delivery estimates under Store settings.",
    },
    {
      id: "exchange-information",
      label: "Exchange information",
      ok: input.shop.exchangeStated,
      severity: "required",
      hint: "Shop-wide: set the exchange window under Store settings.",
    },
  ];

  for (const view of EXPECTED_VIEWS) {
    checks.push({
      id: `view-${view.role}`,
      label: MEDIA_ROLE_LABELS[view.role],
      ok: labelledRoles.has(view.role),
      severity: view.severity,
      hint: `No photograph is marked as the ${MEDIA_ROLE_LABELS[view.role].toLowerCase()}. Choose it on one of the images below.`,
    });
  }

  const passed = checks.filter((check) => check.ok).length;

  return {
    checks,
    score: checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100),
    missingRequired: checks.filter((check) => !check.ok && check.severity === "required").length,
    missingViews: EXPECTED_VIEWS.filter((view) => !labelledRoles.has(view.role)).map(
      (view) => MEDIA_ROLE_LABELS[view.role],
    ),
  };
}
