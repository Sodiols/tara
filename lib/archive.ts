import type { Permission } from "./permissions";

/**
 * Archive & Trash — the rules both the admin UI and the server actions share.
 *
 * The database is the authority (supabase/migrations/0023_archive_and_trash.sql):
 * it re-checks every permission, refuses a purge that would break order history,
 * and only lets an administrator take anything out of the archive. This module
 * exists so the UI offers only what will succeed, and so an error from the
 * database becomes a sentence a person can act on.
 */

export const ARCHIVE_TYPES = ["order", "product", "category", "collection", "coupon", "review"] as const;
export type ArchiveType = (typeof ARCHIVE_TYPES)[number];

export function isArchiveType(value: unknown): value is ArchiveType {
  return typeof value === "string" && (ARCHIVE_TYPES as readonly string[]).includes(value);
}

export const ARCHIVE_TYPE_LABELS: Record<ArchiveType, string> = {
  order: "Order",
  product: "Product",
  category: "Category",
  collection: "Collection",
  coupon: "Coupon",
  review: "Review",
};

/** The filter chips on the Archive page. */
export const ARCHIVE_FILTERS: { value: "" | ArchiveType; label: string }[] = [
  { value: "", label: "All" },
  { value: "order", label: "Orders" },
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "collection", label: "Collections" },
  { value: "coupon", label: "Coupons" },
  { value: "review", label: "Reviews" },
];

/** Who may move an item of each type INTO the archive. */
export const ARCHIVE_PERMISSION: Record<ArchiveType, Permission> = {
  // Orders are financial records: archiving one is an administrator's call too.
  order: "archive.manage",
  product: "catalogue.manage",
  category: "catalogue.manage",
  collection: "catalogue.manage",
  coupon: "coupons.manage",
  review: "reviews.moderate",
};

/** Seeing the archive, restoring and permanently deleting: administrators only. */
export const ARCHIVE_ADMIN_PERMISSION: Permission = "archive.manage";

/** The word typed to confirm a permanent delete that needs a second step. */
export const PURGE_CONFIRMATION_WORD = "DELETE";

/**
 * Orders, products and coupons are the records revenue, stock and redemptions
 * are built from, so deleting one needs the typed confirmation, as does any
 * bulk delete. A single archived category, collection or review needs only the
 * modal.
 */
export function purgeNeedsTypedConfirmation(types: readonly ArchiveType[]): boolean {
  return types.length > 1 || types.some((type) => type === "order" || type === "product" || type === "coupon");
}

/** The warning shown before permanently deleting orders. */
export function orderDeletionWarning(count: number): { title: string; body: string[] } {
  if (count === 1) {
    return {
      title: "Permanently delete this order?",
      body: [
        "This will remove the order and update revenue, sales statistics, and related dashboard data. This action cannot be undone.",
      ],
    };
  }
  return {
    title: `You are about to permanently delete ${count} orders.`,
    body: ["Revenue and related statistics will be recalculated.", "This action cannot be undone."],
  };
}

export const MAX_BULK_ARCHIVE_ITEMS = 50;

/** Maps a database error raised by the archive functions to plain language. */
export function describeArchiveError(message: string, action: "archive" | "restore" | "purge"): string {
  if (message.includes("retained_order_history")) {
    return "Kept for records: it is linked to past orders, so it stays archived and hidden instead of being deleted.";
  }
  if (message.includes("retained_in_use")) {
    return "Kept: products are still assigned to it. Move or delete those products first.";
  }
  if (message.includes("not_archived")) return "That item is no longer in the archive.";
  if (message.includes("order_archived")) return "This order is archived. Restore it before changing it.";
  if (message.includes("item_not_found")) return "That item no longer exists.";
  if (message.includes("permission_denied") || message.includes("42501")) {
    return action === "archive"
      ? "Your role cannot archive this item."
      : "Only an administrator can restore or permanently delete archived items.";
  }
  if (action === "purge") return "Could not permanently delete this item.";
  return action === "restore" ? "Could not restore this item." : "Could not archive this item.";
}
