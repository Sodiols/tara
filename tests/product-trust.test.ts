import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MEDIA_ROLES,
  MEDIA_ROLE_LABELS,
  isMediaRole,
  mediaRoleAlt,
  productTrustReport,
  type ProductTrustInput,
} from "../lib/product-trust";
import { imageAlt } from "../lib/product-media";

/**
 * Listing completeness.
 *
 * Two things are being protected here. The first is that the checklist tells
 * the truth — a listing with three photographs, a fabric line and stock should
 * not be nagged about anything, and one with none of those should be told
 * exactly what is missing.
 *
 * The second is that it stays ADVICE. Nothing in this module may be wired into
 * a code path that refuses a save: a draft is work in progress, and a warning
 * that blocks is a warning staff learn to defeat with a full stop in a text box.
 */

const migration = readFile(
  new URL("../supabase/migrations/0026_launch_offer_and_first_party_analytics.sql", import.meta.url),
  "utf8",
);

function input(overrides: Partial<ProductTrustInput> = {}): ProductTrustInput {
  return {
    description: "A silk kameez cut for everyday wear, with a matching dupatta and salwar.",
    fabric: "Silk",
    careInstructions: "Dry clean only.",
    status: "active",
    images: [
      { isPrimary: true, role: "front", altText: "Front" },
      { isPrimary: false, role: "back", altText: "Back" },
      { isPrimary: false, role: "fabric", altText: "Fabric" },
    ],
    variants: [{ size: "38", colourName: "Maroon", stock: 4, isActive: true }],
    colourCount: 1,
    videoUrl: null,
    shop: { deliveryStated: true, exchangeStated: true },
    ...overrides,
  };
}

function check(report: ReturnType<typeof productTrustReport>, id: string) {
  const found = report.checks.find((entry) => entry.id === id);
  assert.ok(found, `no check called ${id}`);
  return found;
}

describe("a complete listing", () => {
  test("passes everything that matters", () => {
    const report = productTrustReport(input());
    assert.equal(report.missingRequired, 0);
    assert.deepEqual(report.missingViews, ["Design detail"]);
  });

  test("an optional gap does not become a required one", () => {
    const report = productTrustReport(input({ videoUrl: null }));
    assert.equal(check(report, "video").ok, false);
    assert.equal(check(report, "video").severity, "recommended");
    assert.equal(report.missingRequired, 0);
  });
});

describe("what an incomplete listing is told", () => {
  test("no photographs at all", () => {
    const report = productTrustReport(input({ images: [] }));
    assert.equal(check(report, "main-image").ok, false);
    assert.equal(check(report, "multiple-images").ok, false);
    assert.equal(check(report, "view-front").ok, false);
    assert.equal(check(report, "view-back").ok, false);
    assert.ok(report.missingRequired >= 4);
  });

  test("one photograph is not enough to sell clothing from", () => {
    const report = productTrustReport(
      input({ images: [{ isPrimary: true, role: "front", altText: "Front" }] }),
    );
    assert.equal(check(report, "main-image").ok, true);
    assert.equal(check(report, "multiple-images").ok, false);
  });

  test("photographs with no main image", () => {
    const report = productTrustReport(
      input({
        images: [
          { isPrimary: false, role: "front", altText: null },
          { isPrimary: false, role: "back", altText: null },
          { isPrimary: false, role: null, altText: null },
        ],
      }),
    );
    assert.equal(check(report, "main-image").ok, false);
    assert.equal(check(report, "image-alt").ok, false);
  });

  test("a blank fabric line and a one-word description", () => {
    const report = productTrustReport(input({ fabric: "  ", description: "Nice." }));
    assert.equal(check(report, "fabric").ok, false);
    assert.equal(check(report, "description").ok, false);
  });

  test("no variants means no sizes and no stock", () => {
    const report = productTrustReport(input({ variants: [], colourCount: 0 }));
    assert.equal(check(report, "sizes").ok, false);
    assert.equal(check(report, "stock").ok, false);
    assert.equal(check(report, "colours").ok, false);
  });

  test("an inactive variant is not stock", () => {
    const report = productTrustReport(
      input({ variants: [{ size: "38", colourName: "Maroon", stock: 9, isActive: false }] }),
    );
    assert.equal(check(report, "stock").ok, false);
  });

  test("everything sold out is a listing that cannot be ordered", () => {
    const report = productTrustReport(
      input({ variants: [{ size: "38", colourName: "Maroon", stock: 0, isActive: true }] }),
    );
    assert.equal(check(report, "stock").ok, false);
    assert.equal(check(report, "sizes").ok, true);
  });

  test("the shop's own delivery and exchange wording is part of a product page", () => {
    const report = productTrustReport(
      input({ shop: { deliveryStated: false, exchangeStated: false } }),
    );
    assert.equal(check(report, "delivery-information").ok, false);
    assert.equal(check(report, "exchange-information").ok, false);
    assert.match(check(report, "delivery-information").hint, /Store settings/);
  });

  test("every failure says what to do about it", () => {
    const report = productTrustReport(input({ images: [], variants: [], fabric: null }));
    for (const failure of report.checks.filter((entry) => !entry.ok)) {
      assert.ok(failure.hint.length > 20, `${failure.id} has no useful hint`);
    }
  });
});

describe("the score", () => {
  test("is the share of checks that pass", () => {
    const complete = productTrustReport(input({ videoUrl: "https://example.com/v.mp4" }));
    const empty = productTrustReport(
      input({
        images: [],
        variants: [],
        colourCount: 0,
        description: "",
        fabric: "",
        careInstructions: "",
        videoUrl: null,
        shop: { deliveryStated: false, exchangeStated: false },
      }),
    );
    assert.ok(complete.score > empty.score);
    assert.equal(empty.score, 0);
    assert.ok(complete.score >= 90);
  });
});

describe("photograph roles", () => {
  test("the labels cover every role, and the roles match the database", async () => {
    for (const role of MEDIA_ROLES) {
      assert.ok(MEDIA_ROLE_LABELS[role], `no label for ${role}`);
    }

    const sql = await migration;
    const constraint = /media_role in \(([^)]+)\)/.exec(sql);
    assert.ok(constraint, "the media_role constraint is missing from the migration");
    const allowed = [...constraint[1].matchAll(/'([a-z]+)'/g)].map((match) => match[1]);
    assert.deepEqual([...MEDIA_ROLES].sort(), allowed.sort());
  });

  test("an unknown role is not one", () => {
    assert.equal(isMediaRole("front"), true);
    assert.equal(isMediaRole("hero"), false);
    assert.equal(isMediaRole(null), false);
  });

  test("a role describes a photograph nobody has written alt text for", () => {
    assert.equal(mediaRoleAlt("back"), "back view");
    // "Other" says nothing useful, so it says nothing.
    assert.equal(mediaRoleAlt("other"), null);
    assert.equal(mediaRoleAlt(null), null);
  });

  test("staff-written alt text still wins over the role", () => {
    const media = { url: "/a.jpg", alt: "The dupatta, draped", isPrimary: false, sortOrder: 1, colourId: null, role: "back" as const };
    assert.equal(imageAlt(media, "Silk Kameez", 1), "The dupatta, draped");
  });

  test("the first image is still the product's own name", () => {
    const media = { url: "/a.jpg", alt: null, isPrimary: true, sortOrder: 0, colourId: null, role: "front" as const };
    assert.equal(imageAlt(media, "Silk Kameez", 0), "Silk Kameez");
  });

  test("a later image with a role describes itself rather than repeating the name", () => {
    const media = { url: "/b.jpg", alt: null, isPrimary: false, sortOrder: 1, colourId: null, role: "fabric" as const };
    assert.equal(imageAlt(media, "Silk Kameez", 1), "Silk Kameez, fabric close up");
  });

  test("a later image with no role and no alt text stays silent", () => {
    const media = { url: "/c.jpg", alt: null, isPrimary: false, sortOrder: 2, colourId: null };
    assert.equal(imageAlt(media, "Silk Kameez", 2), "");
  });
});

describe("completeness is advice, never a gate", () => {
  test("nothing in the admin action layer refuses a save because of it", async () => {
    const actions = await readFile(
      new URL("../lib/supabase/actions/admin.ts", import.meta.url),
      "utf8",
    );
    // The module may name the roles (it validates one when a photograph is
    // labelled) but must never consult the report to decide whether to write.
    assert.doesNotMatch(actions, /productTrustReport/);
  });

  test("the migration adds the column as optional, with no backfill", async () => {
    const sql = await migration;
    assert.match(sql, /add column if not exists media_role text;/);
    assert.doesNotMatch(sql, /update public\.product_images\s+set media_role/);
  });
});

describe("the fabric details actually reach the page", () => {
  test("search_catalogue names the field unstitchedDetails, and the mapper reads it", async () => {
    const sql = await readFile(
      new URL(
        "../supabase/migrations/0026_launch_offer_and_first_party_analytics.sql",
        import.meta.url,
      ),
      "utf8",
    );
    // The column was never renamed — 0014 renamed the wording customers read,
    // not the schema — so the catalogue payload still calls it this.
    assert.match(sql, /'unstitchedDetails', p\.unstitched_details/);

    const mapper = await readFile(
      new URL("../lib/supabase/queries/products.ts", import.meta.url),
      "utf8",
    );
    // Reading only `row.unreadyDetails` is the bug: the key does not exist in
    // the payload, so the Fabric Information accordion rendered on no product.
    assert.match(mapper, /unreadyDetails\(row\.unstitchedDetails/);
  });
});

