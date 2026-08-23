import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { safeReturnPath } from "../lib/safe-redirect";
import {
  ROLE_PERMISSIONS,
  isStaffRole,
  permissionsForRole,
  roleHasPermission,
} from "../lib/permissions";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
  nextPipelineStatus,
} from "../lib/order-status";

/**
 * Authorisation and redirect safety.
 *
 * These mirror rules the database enforces independently. If one of these ever
 * fails it means the admin UI would offer an action the server would refuse —
 * or, worse, hide one it would allow.
 */

describe("safeReturnPath — open redirect protection", () => {
  const hostile = [
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "http://evil.com/path",
    "javascript:alert(1)",
    "//evil.com/account",
    " //evil.com",
    "/ /evil.com",
    "/\thttps://evil.com",
    "/\nSet-Cookie: a=b",
    "/\r\nLocation: https://evil.com",
    "data:text/html,<script>",
    "mailto:someone@example.com",
  ];

  for (const value of hostile) {
    test(`rejects ${JSON.stringify(value)}`, () => {
      assert.equal(safeReturnPath(value), "/account");
    });
  }

  const safe = [
    "/account",
    "/account/orders",
    "/admin/orders?status=pending",
    "/product/silk-kameez",
    "/bag",
    "/account/orders/TARA-20260101-001000",
  ];

  for (const value of safe) {
    test(`allows ${value}`, () => {
      assert.equal(safeReturnPath(value), value);
    });
  }

  test("falls back for empty, null and undefined", () => {
    assert.equal(safeReturnPath(null), "/account");
    assert.equal(safeReturnPath(undefined), "/account");
    assert.equal(safeReturnPath(""), "/account");
    assert.equal(safeReturnPath("   "), "/account");
  });

  test("honours a custom fallback", () => {
    assert.equal(safeReturnPath("//evil.com", "/admin"), "/admin");
  });

  test("rejects an absurdly long value", () => {
    assert.equal(safeReturnPath(`/${"a".repeat(600)}`), "/account");
  });
});

describe("role permissions", () => {
  test("a customer has no back-office permission at all", () => {
    assert.deepEqual(permissionsForRole("customer"), []);
    assert.equal(isStaffRole("customer"), false);
  });

  test("an unknown or spoofed role grants nothing", () => {
    assert.deepEqual(permissionsForRole("superuser"), []);
    assert.deepEqual(permissionsForRole(undefined), []);
    assert.deepEqual(permissionsForRole(null), []);
    assert.deepEqual(permissionsForRole({ role: "admin" }), []);
    assert.equal(isStaffRole("root"), false);
  });

  test("only an admin can manage staff, settings and the audit log", () => {
    for (const permission of ["staff.manage", "settings.manage", "audit.view"] as const) {
      assert.equal(roleHasPermission("admin", permission), true, `admin ${permission}`);
      for (const role of ["manager", "staff", "fulfilment", "support", "customer"] as const) {
        assert.equal(roleHasPermission(role, permission), false, `${role} ${permission}`);
      }
    }
  });

  test("fulfilment staff cannot edit the catalogue or read customers", () => {
    assert.equal(roleHasPermission("fulfilment", "catalogue.manage"), false);
    assert.equal(roleHasPermission("fulfilment", "customers.view"), false);
    assert.equal(roleHasPermission("fulfilment", "coupons.manage"), false);
    // …but can do their actual job.
    assert.equal(roleHasPermission("fulfilment", "orders.fulfil"), true);
    assert.equal(roleHasPermission("fulfilment", "inventory.adjust"), true);
  });

  test("support staff cannot move stock, cancel orders, or change prices", () => {
    assert.equal(roleHasPermission("support", "inventory.adjust"), false);
    assert.equal(roleHasPermission("support", "orders.cancel"), false);
    assert.equal(roleHasPermission("support", "orders.payment"), false);
    assert.equal(roleHasPermission("support", "catalogue.manage"), false);
    assert.equal(roleHasPermission("support", "orders.view"), true);
    assert.equal(roleHasPermission("support", "messages.manage"), true);
  });

  test("the legacy 'staff' role keeps working and matches manager", () => {
    assert.deepEqual([...ROLE_PERMISSIONS.staff], [...ROLE_PERMISSIONS.manager]);
    assert.equal(isStaffRole("staff"), true);
  });
});

describe("order status state machine", () => {
  test("cancelled and returned are terminal", () => {
    assert.equal(isTerminal("cancelled"), true);
    assert.equal(isTerminal("returned"), true);
    assert.deepEqual(ORDER_TRANSITIONS.cancelled, []);
    assert.deepEqual(ORDER_TRANSITIONS.returned, []);
  });

  test("an order cannot move backwards", () => {
    assert.equal(canTransition("delivered", "pending"), false);
    assert.equal(canTransition("shipped", "packed"), false);
    assert.equal(canTransition("packed", "processing"), false);
    assert.equal(canTransition("confirmed", "pending"), false);
  });

  test("an order cannot skip a fulfilment step", () => {
    assert.equal(canTransition("pending", "shipped"), false);
    assert.equal(canTransition("pending", "delivered"), false);
    assert.equal(canTransition("confirmed", "packed"), false);
  });

  test("the happy path is walkable end to end", () => {
    const path = [
      "pending",
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "delivered",
    ] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      assert.equal(
        canTransition(path[index], path[index + 1]),
        true,
        `${path[index]} → ${path[index + 1]}`,
      );
      assert.equal(nextPipelineStatus(path[index]), path[index + 1]);
    }
    assert.equal(nextPipelineStatus("delivered"), null);
  });

  test("a delivered order is returned, never cancelled", () => {
    assert.equal(canTransition("delivered", "cancelled"), false);
    assert.equal(canTransition("delivered", "returned"), true);
  });

  test("only a shipped or delivered order can be returned", () => {
    assert.equal(canTransition("pending", "returned"), false);
    assert.equal(canTransition("confirmed", "returned"), false);
    assert.equal(canTransition("processing", "returned"), false);
    assert.equal(canTransition("packed", "returned"), false);
    assert.equal(canTransition("shipped", "returned"), true);
  });

  test("cancelling requires orders.cancel, not merely orders.fulfil", () => {
    const fulfilmentOnly = allowedTransitions("pending", ["orders.view", "orders.fulfil"]);
    assert.deepEqual(fulfilmentOnly, ["confirmed"]);

    const withCancel = allowedTransitions("pending", ["orders.fulfil", "orders.cancel"]);
    assert.deepEqual(withCancel.sort(), ["cancelled", "confirmed"]);
  });

  test("support staff are offered no transition at all", () => {
    for (const status of ["pending", "confirmed", "processing", "packed", "shipped"] as const) {
      assert.deepEqual(
        allowedTransitions(status, permissionsForRole("support")),
        [],
        `support should not move a ${status} order`,
      );
    }
  });

  test("every declared transition names a permission that exists", () => {
    for (const [from, options] of Object.entries(ORDER_TRANSITIONS)) {
      for (const option of options) {
        assert.ok(
          ROLE_PERMISSIONS.admin.includes(option.permission),
          `${from} → ${option.to} uses unknown permission ${option.permission}`,
        );
      }
    }
  });
});
