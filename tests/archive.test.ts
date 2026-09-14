import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ROLE_PERMISSIONS, roleHasPermission, type AppRole } from "../lib/permissions";
import {
  ARCHIVE_PERMISSION,
  ARCHIVE_TYPES,
  describeArchiveError,
  isArchiveType,
  orderDeletionWarning,
  purgeNeedsTypedConfirmation,
} from "../lib/archive";

const migration = readFile(new URL("../supabase/migrations/0023_archive_and_trash.sql", import.meta.url), "utf8");
const orderMigration = readFile(new URL("../supabase/migrations/0024_archive_and_delete_orders.sql", import.meta.url), "utf8");

/** The body of one `create or replace function public.<name>(` in a migration. */
async function functionBody(name: string, source: Promise<string> = migration): Promise<string> {
  const sql = await source;
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
      for (const type of ARCHIVE_TYPES.filter((t) => t !== "order")) {
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

  test("only an administrator can archive, restore or delete an order", () => {
    assert.equal(ARCHIVE_PERMISSION.order, "archive.manage");
    assert.equal(roleHasPermission("admin", ARCHIVE_PERMISSION.order), true);
    for (const role of ["manager", "staff", "fulfilment", "support", "customer"] as const) {
      assert.equal(roleHasPermission(role, ARCHIVE_PERMISSION.order), false, role);
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
    for (const type of ARCHIVE_TYPES.filter((t) => t !== "order")) {
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
    assert.equal(isArchiveType("payment"), false);
    assert.equal(isArchiveType("order"), true);
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

describe("order deletion", () => {
  test("every entry point checks archive.manage first", async () => {
    for (const name of ["purge_archived_order", "admin_purge_archived_order", "admin_restore_archived_item", "admin_purge_archived_item"]) {
      const body = await functionBody(name, orderMigration);
      const check = body.indexOf("perform public.require_permission('archive.manage');");
      assert.ok(check > 0, `${name} requires archive.manage`);
      assert.ok(check < body.search(/\b(update|delete from|return public\.)/), `${name} checks before acting`);
    }
    const archive = await functionBody("admin_archive_item", orderMigration);
    assert.match(archive, /if p_type <> 'order' then\s+return public\.archive_catalogue_archive_item/);
    assert.ok(
      archive.indexOf("require_permission('archive.manage')") < archive.indexOf("update public.orders"),
      "order archiving checks archive.manage before writing",
    );
  });

  test("the internal helpers and order data cannot be reached through the API", async () => {
    const sql = await orderMigration;
    for (const helper of [
      "purge_archived_order(uuid, boolean)",
      "archive_catalogue_purge_item(text, uuid)",
      "archive_catalogue_restore_item(text, uuid)",
      "archive_catalogue_archive_item(text, uuid)",
    ]) {
      assert.ok(sql.includes(`revoke execute on function public.${helper} from public, anon, authenticated;`), helper);
    }
    assert.match(sql, /revoke execute on function public\.admin_purge_archived_order\(uuid, boolean\) from public, anon;/);
    assert.match(
      sql,
      /revoke delete on table public\.orders, public\.order_items, public\.order_tracking_events,\s+public\.order_internal_notes, public\.coupon_redemptions, public\.inventory_adjustments\s+from anon, authenticated;/,
    );
  });

  test("stock is returned once, only for orders still holding it", async () => {
    const body = await functionBody("purge_archived_order", orderMigration);
    assert.match(body, /should_restock := order_record\.stock_restored_at is null and \(/);
    assert.match(body, /order_record\.status in \('pending', 'confirmed', 'processing', 'packed'\)/);
    assert.match(body, /coalesce\(p_restock_shipped, false\) and order_record\.status in \('shipped', 'delivered'\)/);
    assert.match(body, /insert into public\.inventory_adjustments/);
  });

  test("coupon usage is released, reviews are kept, and the audit entry has no personal data", async () => {
    const body = await functionBody("purge_archived_order", orderMigration);
    assert.match(body, /set usage_count = greatest\(usage_count - redemption\.uses, 0\)/);
    assert.match(body, /update public\.reviews set order_item_id = null/);
    assert.doesNotMatch(body, /delete from public\.(reviews|profiles|products|product_variants|coupons)/);
    const audit = body.slice(body.indexOf("'order.purged'"));
    assert.doesNotMatch(audit, /customer_|shipping_address|email|phone/);
  });

  test("revenue is never stored, so no figure needs adjusting after a delete", async () => {
    const sql = await orderMigration;
    assert.doesNotMatch(sql, /update public\.(store_settings|analytics|dashboard)/);
    const hardening = await readFile(new URL("../supabase/migrations/0002_production_hardening.sql", import.meta.url), "utf8");
    const dashboard = hardening.slice(hardening.indexOf("create or replace function public.admin_dashboard_metrics()"));
    assert.match(
      dashboard,
      /'totalRevenue', \(\s+select coalesce\(sum\(total\), 0\) from public\.orders\s+where status not in \('cancelled', 'returned'\)/,
    );
  });

  test("an archived order is frozen until restored", async () => {
    const body = await functionBody("orders_archive_guard", orderMigration);
    assert.match(body, /raise exception 'order_archived'/);
    assert.match(body, /archive_require_restore_right\(\)/);
  });

  test("the warning uses the agreed wording", () => {
    assert.deepEqual(orderDeletionWarning(1), {
      title: "Permanently delete this order?",
      body: [
        "This will remove the order and update revenue, sales statistics, and related dashboard data. This action cannot be undone.",
      ],
    });
    assert.equal(orderDeletionWarning(23).title, "You are about to permanently delete 23 orders.");
    assert.deepEqual(orderDeletionWarning(23).body, [
      "Revenue and related statistics will be recalculated.",
      "This action cannot be undone.",
    ]);
    assert.equal(purgeNeedsTypedConfirmation(["order"]), true);
  });

  test("delete controls render only for archive.manage, and the actions check it server-side", async () => {
    const page = await readFile(new URL("../app/admin/orders/page.tsx", import.meta.url), "utf8");
    assert.match(page, /const canDelete = staff\.permissions\.includes\("archive\.manage"\);/);
    const detail = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
    assert.match(detail, /\{canDelete && \(\s+<OrderDeletePanel/);
    const table = await readFile(new URL("../components/admin/OrdersTable.tsx", import.meta.url), "utf8");
    assert.match(table, /\{canDelete && \(\s+<div/);
    const actions = await readFile(new URL("../lib/supabase/actions/archive.ts", import.meta.url), "utf8");
    assert.match(actions, /archiveOrdersAction[\s\S]{0,200}await requirePermission\(ARCHIVE_ADMIN_PERMISSION\)/);
    assert.match(actions, /deleteOrdersAction[\s\S]{0,200}await requirePermission\(ARCHIVE_ADMIN_PERMISSION\)/);
    assert.match(actions, /if \(confirmation\.trim\(\) !== PURGE_CONFIRMATION_WORD\)/);
  });
});
