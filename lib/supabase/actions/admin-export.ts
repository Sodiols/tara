"use server";

import { requirePermission } from "../auth";
import { createClient } from "../server";
import { logFailure } from "@/lib/logger";

/**
 * CSV export for the newsletter list.
 *
 * Kept in its own module because it returns a payload rather than an
 * ActionResult, and because export is the one admin operation that moves
 * personal data out of the system — worth having in a file you can audit on
 * its own.
 */

type ExportResult =
  | { ok: true; csv: string; filename: string; count: number }
  | { ok: false; message: string };

/**
 * Escapes a value for CSV.
 *
 * Fields beginning with =, +, - or @ are prefixed with a single quote: without
 * that, an address like `=cmd|...` is executed as a formula when the file is
 * opened in Excel. The list is user-submitted, so this matters.
 */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function exportNewsletterCsvAction(activeOnly: boolean): Promise<ExportResult> {
  await requirePermission("newsletter.manage");

  const supabase = await createClient();
  let query = supabase
    .from("newsletter_subscribers")
    .select("email,is_active,created_at,unsubscribed_at,source")
    .order("created_at", { ascending: false })
    .limit(20000);

  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    logFailure("admin.newsletter_export_failed", error);
    return { ok: false, message: "The export could not be generated." };
  }

  // No language column: the store is English only, so it carried no
  // information and migration 0011 removed the field it came from.
  const header = ["email", "status", "subscribed_at", "unsubscribed_at", "source"];
  const lines = [header.join(",")];

  for (const row of data ?? []) {
    lines.push(
      [
        csvCell(row.email),
        csvCell(row.is_active ? "active" : "unsubscribed"),
        csvCell(row.created_at),
        csvCell(row.unsubscribed_at ?? ""),
        csvCell(row.source),
      ].join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    // A BOM so Excel opens UTF-8 correctly on Windows.
    csv: `﻿${lines.join("\r\n")}`,
    filename: `tara-newsletter-${activeOnly ? "active" : "all"}-${stamp}.csv`,
    count: data?.length ?? 0,
  };
}
