import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ROLE_PERMISSIONS, roleHasPermission, type AppRole } from "../lib/permissions";
import {
  ARCHIVE_PERMISSION,
  ARCHIVE_TYPES,
  describeArchiveError,
  isArchiveType,
  purgeNeedsTypedConfirmation,
} from "../lib/archive";

const migration = readFile(new URL("../supabase/migrations/0023_archive_and_trash.sql", import.meta.url), "utf8");

/** The body of one `create or replace function public.<name>(` in the migration. */
async function functionBody(name: string): Promise<string> {
  const sql = await migration;
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end);
}

describe("archive permissions", () => {
  test("only an administrator can see the archive, restore or permanently delete", () => {
    assert.equal(roleHasPermission("admin", "archive.manage"), true);
    for (const role of ["manager", "staff", "fulfilment", "support", "customer"] as const) {
      assert.equal(roleHasPermission(role, "archive.manage"), false, role);
    }
  });

  test("managers and legacy staff can still archive what they manage today", () => {
    for (const role of ["manager", "staff"] as const) {
      for (const type of ARCHIVE_TYPES) {
        assert.equal(roleHasPermission(role, ARCHIVE_PERMISSION[type]), true, `${role} archives ${type}`);
      }
    }
    // Fulfilment and support never managed the catalogue, coupons or reviews.
    for (const role of ["fulfilment", "support"] as const) {
      for (const type of ARCHIVE_TYPES) {
        assert.equal(roleHasPermission(role, ARCHIVE_PERMISSION[type]), false, `${role} archives ${type}`);
      }
    }
  });

  test("the database's role_permissions() matches lib/permissions.ts for every role", async () => {
    const body = await functionBody("role_permissions");
    for (const role of Object.keys(ROLE_PERMISSIONS) as AppRole[]) {
      if (role === "customer") continue;
      const match = body.match(new RegExp(`when '${role}' then array\\[([^\\]]*)\\]`));
      assert.ok(match, `${role} is listed in SQL`);
      const sqlPermissions = [...match[1].matchAll(/'([a-z.]+)'/g)].map((m) => m[1]).sort();
      assert.deepEqual(sqlPermissions, [...ROLE_PERMISSIONS[role]].sort(), role);
    }
  });
});

describe("archive database rules", () => {
  test("restore and purge check archive.manage before doing anything", async () => {
    for (const name of ["admin_restore_archived_item", "admin_purge_archived_item"]) {
      const body = await functionBody(name);
      const check = body.indexOf("perform public.require_permission('archive.manage');");
      assert.ok(check > 0, `${name} requires archive.manage`);
      assert.ok(check < body.search(/\b(update|delete from)\b/), `${name} checks before writing`);
      assert.match(body, /security definer/);
    }
  });

  test("archiving needs the permission that already governs each type", async () => {
    const body = await functionBody("admin_archive_item");
    for (const type of ARCHIVE_TYPES) {
      assert.match(
        body,
        new RegExp(`when '${type}' then\\s+perform public\\.require_permission\\('${ARCHIVE_PERMISSION[type].replace(".", "\\.")}'\\)`),
        type,
      );
    }
  });

  test("taking anything out of the archive by any other route is limited to administrators", async () => {
    assert.match(await functionBody("archive_require_restore_right"), /has_permission\('archive\.manage'\)/);
    for (const guard of ["products_archive_guard", "flag_archive_guard", "reviews_archive_guard"]) {
      assert.match(await functionBody(guard), /archive_require_restore_right\(\)/, guard);
    }
  });

  test("records tied to orders or still in use are kept, never deleted", async () => {
    const body = await functionBody("admin_purge_archived_item");
    assert.match(body, /from public\.order_items where product_id = p_id\)\s+then\s+raise exception 'retained_order_history'/);
    assert.match(body, /from public\.coupon_redemptions where coupon_id = p_id\)/);
    assert.match(body, /from public\.products where category_id = p_id\)\s+then\s+raise exception 'retained_in_use'/);
    assert.match(body, /from public\.products where collection_id = p_id\)\s+then\s+raise exception 'retained_in_use'/);
    // Each check comes before the delete it protects.
    assert.ok(body.indexOf("retained_order_history") < body.indexOf("delete from public.products where id = p_id"));
    // Orders, customers and payments are not archivable types at all.
    assert.doesNotMatch(body, /delete from public\.(orders|order_items|profiles|coupon_redemptions|admin_audit_log)/);
  });

  test("purge is written to the existing audit log", async () => {
    assert.match(await functionBody("admin_purge_archived_item"), /log_admin_action\(\s*p_type \|\| '\.purged'/);
    assert.match(await functionBody("archive_register"), /log_admin_action\(\s*p_type \|\| '\.archived'/);
  });

  test("no API session can delete catalogue rows directly, or write the registry", async () => {
    const sql = await migration;
    assert.match(
      sql,
      /revoke delete on table public\.products, public\.categories, public\.collections, public\.product_variants\s+from anon, authenticated;/,
    );
    assert.match(sql, /create policy archived_items_admin_read on public\.archived_items for select\s+using \(public\.has_permission\('archive\.manage'\)\);/);
    assert.match(sql, /revoke all on table public\.archived_items from anon, authenticated;/);
    assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*archived_items/);
    for (const name of ["admin_archive_item", "admin_restore_archived_item", "admin_purge_archived_item"]) {
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\(text, uuid\\) from public, anon;`), name);
    }
  });
});

describe("archive UI rules", () => {
  test("bulk deletes and product or coupon deletes need the typed confirmation", () => {
    assert.equal(purgeNeedsTypedConfirmation(["review"]), false);
    assert.equal(purgeNeedsTypedConfirmation(["category"]), false);
    assert.equal(purgeNeedsTypedConfirmation(["product"]), true);
    assert.equal(purgeNeedsTypedConfirmation(["coupon"]), true);
    assert.equal(purgeNeedsTypedConfirmation(["review", "category"]), true);
  });

  test("database refusals read as plain language", () => {
    assert.match(describeArchiveError("retained_order_history", "purge"), /past orders/);
    assert.match(describeArchiveError("retained_in_use", "purge"), /still assigned/);
    assert.match(describeArchiveError("permission_denied:archive.manage", "restore"), /Only an administrator/);
    assert.equal(isArchiveType("order"), false);
    assert.equal(isArchiveType("product"), true);
  });

  test("the Archive & Trash link is shown only to holders of archive.manage", async () => {
    const shell = await readFile(new URL("../components/admin/AdminShell.tsx", import.meta.url), "utf8");
    assert.match(shell, /href: "\/admin\/archive", label: "Archive & Trash", icon: Archive, permission: "archive\.manage"/);
    const query = await readFile(new URL("../lib/supabase/queries/admin.ts", import.meta.url), "utf8");
    assert.match(query, /export async function getArchivedItems[\s\S]{0,200}await requirePermission\("archive\.manage"\)/);
    const actions = await readFile(new URL("../lib/supabase/actions/archive.ts", import.meta.url), "utf8");
    assert.match(actions, /restoreArchivedItemsAction[\s\S]{0,120}await requirePermission\(ARCHIVE_ADMIN_PERMISSION\)/);
    assert.match(actions, /purgeArchivedItemsAction[\s\S]{0,160}await requirePermission\(ARCHIVE_ADMIN_PERMISSION\)/);
  });
});
