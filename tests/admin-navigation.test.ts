import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { PERMISSIONS, ROLE_PERMISSIONS, roleHasPermission } from "../lib/permissions";

/**
 * The back-office navigation.
 *
 * The sidebar is only a map — every page and every action checks its own
 * permission on the server — but a map that shows a fulfilment account the
 * Staff page is still a mistake. These read the navigation's source and check
 * it against the permission model.
 */

const shell = readFile(new URL("../components/admin/AdminShell.tsx", import.meta.url), "utf8");

/** Every `{ href, label, …, permission }` entry, in order. */
async function navItems() {
  const source = await shell;
  const block = source.slice(source.indexOf("const NAV_GROUPS"), source.indexOf("const COUNT_LABELS"));
  const items: { group: string; href: string; permission: string | null }[] = [];
  let group = "";
  for (const line of block.split("\n")) {
    // Group labels are the only `label:` at four spaces of indentation; an
    // item's label is nested deeper.
    const groupMatch = /^ {4}label: "([^"]+)",\s*$/.exec(line);
    if (groupMatch) group = groupMatch[1];
    const href = /href: "([^"]+)"/.exec(line);
    if (href) items.push({ group, href: href[1], permission: null });
    const permission = /permission: "([^"]+)"/.exec(line);
    if (permission && items.length) items[items.length - 1].permission = permission[1];
  }
  return items;
}

describe("admin navigation", () => {
  test("is grouped the way the shop works", async () => {
    const groups = [...new Set((await navItems()).map((item) => item.group))];
    assert.deepEqual(groups, [
      "Home",
      "Sales",
      "Catalogue",
      "Marketing",
      "Customer care",
      "Insights",
      "Administration",
    ]);
  });

  test("every section it links to is guarded by a permission that exists", async () => {
    for (const item of await navItems()) {
      if (item.href === "/admin") continue; // the dashboard: any staff member
      assert.ok(item.permission, `${item.href} has no permission`);
      assert.ok(
        (PERMISSIONS as readonly string[]).includes(item.permission),
        `${item.href} uses unknown permission ${item.permission}`,
      );
    }
  });

  test("administration stays with the roles that already had it", async () => {
    const byHref = new Map((await navItems()).map((item) => [item.href, item.permission]));
    assert.equal(byHref.get("/admin/settings"), "settings.manage");
    assert.equal(byHref.get("/admin/staff"), "staff.manage");
    assert.equal(byHref.get("/admin/audit-log"), "audit.view");
    assert.equal(byHref.get("/admin/archive"), "archive.manage");
    for (const permission of ["settings.manage", "staff.manage", "audit.view", "archive.manage"] as const) {
      for (const role of ["manager", "fulfilment", "support", "customer"] as const) {
        assert.equal(roleHasPermission(role, permission), false, `${role} must not see ${permission}`);
      }
    }
  });

  test("fulfilment sees orders and stock, not the catalogue or staff", async () => {
    const visible = (await navItems())
      .filter((item) => !item.permission || ROLE_PERMISSIONS.fulfilment.includes(item.permission as never))
      .map((item) => item.href);
    assert.ok(visible.includes("/admin/orders"));
    assert.ok(visible.includes("/admin/inventory"));
    for (const hidden of ["/admin/products", "/admin/staff", "/admin/settings", "/admin/customers"]) {
      assert.ok(!visible.includes(hidden), `fulfilment should not see ${hidden}`);
    }
  });

  test("support sees orders, customers and messages", async () => {
    const visible = (await navItems())
      .filter((item) => !item.permission || ROLE_PERMISSIONS.support.includes(item.permission as never))
      .map((item) => item.href);
    for (const shown of ["/admin/orders", "/admin/customers", "/admin/messages"]) {
      assert.ok(visible.includes(shown), `support should see ${shown}`);
    }
    for (const hidden of ["/admin/inventory", "/admin/products", "/admin/reviews"]) {
      assert.ok(!visible.includes(hidden), `support should not see ${hidden}`);
    }
  });

  test("every admin page is authorised on the server, not just hidden", async () => {
    // A page either checks a permission itself, or reads through the admin
    // query modules — whose every exported reader checks one (next test).
    const root = path.resolve(import.meta.dirname, "..", "app", "admin");
    const pages: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name === "page.tsx") pages.push(full);
      }
    };
    await walk(root);
    assert.ok(pages.length >= 20);

    const guarded =
      /requirePermission\(|requireStaff\(|from "@\/lib\/supabase\/queries\/(admin|launch-offer|marketing)"/;
    for (const page of pages) {
      const source = await readFile(page, "utf8");
      assert.match(source, guarded, `${path.relative(root, page)} has no server-side guard`);
    }
  });

  test("every exported admin reader checks a permission before it reads", async () => {
    const modules = ["admin", "launch-offer", "marketing"];
    for (const name of modules) {
      const source = await readFile(
        new URL(`../lib/supabase/queries/${name}.ts`, import.meta.url),
        "utf8",
      );
      const functions = source.split("\nexport async function ").slice(1);
      assert.ok(functions.length > 0, `${name}.ts exports no readers`);
      for (const fn of functions) {
        const fnName = fn.slice(0, fn.indexOf("("));
        // Navigation counts run inside the admin layout, which has already
        // required a staff session, and each count is scoped to the caller's
        // own permissions and RLS.
        if (fnName === "getAdminNavCounts") continue;
        const bodyStart = fn.indexOf("{");
        const firstStatements = fn.slice(bodyStart, bodyStart + 400);
        assert.match(
          firstStatements,
          /await require(Permission|Staff)\(/,
          `${name}.ts: ${fnName} reads without checking a permission first`,
        );
      }
    }
  });
});
