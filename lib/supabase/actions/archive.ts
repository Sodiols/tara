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
  if (seen.has("product") || seen.has("category") || seen.has("collection") || seen.has("review")) {
    updateTag("catalogue");
    revalidatePath("/", "layout");
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
