"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../auth";
import { createClient } from "../server";
import type { ActionResult } from "./auth";
import {
  ARCHIVE_ADMIN_PERMISSION,
  ARCHIVE_PERMISSION,
  ARCHIVE_TYPES,
  ARCHIVE_TYPE_LABELS,
  MAX_BULK_ARCHIVE_ITEMS,
  PURGE_CONFIRMATION_WORD,
  describeArchiveError,
  purgeNeedsTypedConfirmation,
  type ArchiveType,
} from "@/lib/archive";
import { logFailure } from "@/lib/logger";

/**
 * Archive & Trash mutations.
 *
 * Archiving needs the permission that already governs the item (catalogue,
 * coupons, reviews). Restoring and permanently deleting need archive.manage,
 * which only administrators hold. Each check here is repeated inside the
 * database function it calls, so calling that function directly with a
 * manager's session fails in exactly the same way.
 */

const itemSchema = z.object({
  type: z.enum(ARCHIVE_TYPES),
  id: z.string().uuid(),
});

const itemsSchema = z.array(itemSchema).min(1).max(MAX_BULK_ARCHIVE_ITEMS);

type ArchiveItem = z.infer<typeof itemSchema>;

/** Every screen an archive, restore or purge can change. */
function revalidateFor(types: Iterable<ArchiveType>) {
  const seen = new Set(types);
  revalidatePath("/admin/archive");
  if (seen.has("order") || seen.has("product") || seen.has("category") || seen.has("collection") || seen.has("review")) {
    // Every page below the root layout -- the storefront, the dashboard, the
    // analytics, customer pages -- renders from fresh data on its next request,
    // and the catalogue cache is dropped because deleting an order can return
    // stock and change what is available to buy.
    updateTag("catalogue");
    revalidatePath("/", "layout");
  }
  if (seen.has("order")) {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/analytics");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/coupons");
  }
  if (seen.has("product")) revalidatePath("/admin/products");
  if (seen.has("category")) revalidatePath("/admin/categories");
  if (seen.has("collection")) revalidatePath("/admin/collections");
  if (seen.has("coupon")) revalidatePath("/admin/coupons");
  if (seen.has("review")) revalidatePath("/admin/reviews");
}

export async function archiveItemAction(type: ArchiveType, id: string): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({ type, id });
  if (!parsed.success) return { ok: false, message: "Invalid item." };
  await requirePermission(ARCHIVE_PERMISSION[parsed.data.type]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_archive_item", {
    p_type: parsed.data.type,
    p_id: parsed.data.id,
  });
  if (error) {
    logFailure("admin.archive_item", error, { type: parsed.data.type });
    return { ok: false, message: describeArchiveError(error.message, "archive") };
  }

  revalidateFor([parsed.data.type]);
  return {
    ok: true,
    message: `${ARCHIVE_TYPE_LABELS[parsed.data.type]} archived. An administrator can restore it from Archive & Trash.`,
  };
}

interface BulkOutcome {
  item: ArchiveItem;
  ok: boolean;
  message?: string;
}

function summarise(outcomes: BulkOutcome[], verb: "restored" | "permanently deleted"): ActionResult<BulkOutcome[]> {
  const done = outcomes.filter((outcome) => outcome.ok).length;
  const failed = outcomes.filter((outcome) => !outcome.ok);
  if (failed.length === 0) {
    return {
      ok: true,
      message: done === 1 ? `Item ${verb}.` : `${done} items ${verb}.`,
      data: outcomes,
    };
  }
  // A partial result is reported as a failure so it is read, and it says what
  // happened to the rest rather than hiding the successes.
  const reasons = [...new Set(failed.map((outcome) => outcome.message).filter(Boolean))].join(" ");
  return {
    ok: false,
    message:
      outcomes.length === 1
        ? reasons || `Could not complete this action.`
        : `${done} of ${outcomes.length} ${verb}. ${failed.length} not: ${reasons}`,
  };
}

export async function restoreArchivedItemsAction(items: ArchiveItem[]): Promise<ActionResult<BulkOutcome[]>> {
  await requirePermission(ARCHIVE_ADMIN_PERMISSION);
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Select between 1 and 50 archived items." };

  const supabase = await createClient();
  const outcomes: BulkOutcome[] = [];
  for (const item of parsed.data) {
    const { error } = await supabase.rpc("admin_restore_archived_item", { p_type: item.type, p_id: item.id });
    if (error) logFailure("admin.archive_restore", error, { type: item.type });
    outcomes.push({ item, ok: !error, message: error ? describeArchiveError(error.message, "restore") : undefined });
  }

  revalidateFor(parsed.data.map((item) => item.type));
  return summarise(outcomes, "restored");
}

export async function purgeArchivedItemsAction(
  items: ArchiveItem[],
  confirmation: string,
): Promise<ActionResult<BulkOutcome[]>> {
  await requirePermission(ARCHIVE_ADMIN_PERMISSION);
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Select between 1 and 50 archived items." };

  // The confirmation is checked here as well as in the dialog, so a replayed or
  // hand-built request cannot skip the step the administrator is shown.
  const needsWord = purgeNeedsTypedConfirmation(parsed.data.map((item) => item.type));
  const typedWord = confirmation.trim() === PURGE_CONFIRMATION_WORD;
  const confirmed = typedWord || (!needsWord && confirmation === "confirmed");
  if (!confirmed) {
    return { ok: false, message: needsWord ? `Type ${PURGE_CONFIRMATION_WORD} to confirm.` : "Confirm the permanent delete first." };
  }

  const supabase = await createClient();
  const outcomes: BulkOutcome[] = [];
  const storagePaths: string[] = [];
  for (const item of parsed.data) {
    const { data, error } = await supabase.rpc("admin_purge_archived_item", { p_type: item.type, p_id: item.id });
    if (error) {
      logFailure("admin.archive_purge", error, { type: item.type });
      outcomes.push({ item, ok: false, message: describeArchiveError(error.message, "purge") });
      continue;
    }
    const paths = (data as { storagePaths?: unknown } | null)?.storagePaths;
    if (Array.isArray(paths)) storagePaths.push(...paths.filter((path): path is string => typeof path === "string" && path.length > 0));
    outcomes.push({ item, ok: true });
  }

  // Image files are removed only after their rows are gone, as deleteProductImageAction
  // does: an orphaned file is a tidy-up job, a row pointing at a missing file is a
  // broken image.
  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from("product-images").remove(storagePaths);
    if (error) logFailure("admin.archive_purge_storage_orphan", error, { files: storagePaths.length });
  }

  revalidateFor(parsed.data.map((item) => item.type));
  return summarise(outcomes, "permanently deleted");
}

// ---------------------------------------------------------------------------
// Orders (administrators only)
// ---------------------------------------------------------------------------

const orderIdsSchema = z.array(z.string().uuid()).min(1).max(MAX_BULK_ARCHIVE_ITEMS);

/** Moves orders into Archive & Trash. Reversible; they still count in revenue until deleted. */
export async function archiveOrdersAction(orderIds: string[]): Promise<ActionResult> {
  await requirePermission(ARCHIVE_ADMIN_PERMISSION);
  const parsed = orderIdsSchema.safeParse(orderIds);
  if (!parsed.success) return { ok: false, message: `Select between 1 and ${MAX_BULK_ARCHIVE_ITEMS} orders.` };

  const supabase = await createClient();
  let archived = 0;
  const reasons = new Set<string>();
  for (const id of parsed.data) {
    const { error } = await supabase.rpc("admin_archive_item", { p_type: "order", p_id: id });
    if (error) {
      logFailure("admin.order_archive", error);
      reasons.add(describeArchiveError(error.message, "archive"));
    } else {
      archived += 1;
    }
  }

  revalidateFor(["order"]);
  const total = parsed.data.length;
  if (archived === total) {
    return {
      ok: true,
      message: total === 1 ? "Order archived. Restore or delete it from Archive & Trash." : `${total} orders archived. Restore or delete them from Archive & Trash.`,
    };
  }
  return { ok: false, message: `${archived} of ${total} orders archived. ${[...reasons].join(" ")}` };
}

/**
 * Permanently deletes orders. Each one is archived first if it is not already,
 * so every deletion still passes through the Trash, then removed by
 * admin_purge_archived_order(), which returns stock that was still held,
 * releases coupon usage and writes a minimal audit entry.
 *
 * `restockShipped` additionally returns stock for shipped or delivered orders,
 * for test orders that were pushed through the pipeline; real shipped goods
 * have left the building, so it defaults to off.
 */
export async function deleteOrdersAction(
  orderIds: string[],
  confirmation: string,
  restockShipped = false,
): Promise<ActionResult<{ deleted: number; restocked: number }>> {
  await requirePermission(ARCHIVE_ADMIN_PERMISSION);
  const parsed = orderIdsSchema.safeParse(orderIds);
  if (!parsed.success) return { ok: false, message: `Select between 1 and ${MAX_BULK_ARCHIVE_ITEMS} orders.` };
  if (confirmation.trim() !== PURGE_CONFIRMATION_WORD) {
    return { ok: false, message: `Type ${PURGE_CONFIRMATION_WORD} to confirm.` };
  }

  const supabase = await createClient();
  let deleted = 0;
  let restocked = 0;
  const reasons = new Set<string>();
  for (const id of parsed.data) {
    const { data, error } = await supabase.rpc("admin_purge_archived_order", {
      p_id: id,
      p_restock_shipped: restockShipped === true,
    });
    if (error) {
      logFailure("admin.order_delete", error);
      reasons.add(describeArchiveError(error.message, "purge"));
      continue;
    }
    deleted += 1;
    if ((data as { restocked?: boolean } | null)?.restocked) restocked += 1;
  }

  revalidateFor(["order"]);
  const total = parsed.data.length;
  const stockNote = restocked > 0 ? ` Stock returned for ${restocked}.` : "";
  if (deleted === total) {
    return {
      ok: true,
      message: `${total === 1 ? "Order" : `${total} orders`} permanently deleted. Revenue and statistics are updated.${stockNote}`,
      data: { deleted, restocked },
    };
  }
  return {
    ok: false,
    message: `${deleted} of ${total} orders deleted.${stockNote} ${[...reasons].join(" ")}`,
  };
}
