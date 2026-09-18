import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  addSizes,
  blockingItems,
  buildVariantRows,
  builderReadiness,
  cleanSize,
  includedVariants,
  outstandingVariants,
  parseSizeList,
  validateVariantRows,
  type ReadinessInput,
  type VariantRow,
} from "../lib/product-builder";
import { describeColourNameProblems } from "../lib/product-colour-images";

/**
 * The Product Builder — Admin → Products → Add product, on one screen.
 *
 * What these protect:
 *
 *   1. Reshaping the variant grid (adding a size, removing a colour) never
 *      throws away a SKU, a stock figure or a price somebody typed.
 *   2. A variant that has been CREATED is never sent again and never changes
 *      under the administrator — its stock can only move through Inventory.
 *   3. "Ready to publish" means exactly what the server will accept, plus the
 *      builder's own standard (a photograph, a colour, a variant).
 *   4. The server side really is resumable: the batch action finds what already
 *      exists and does not create it a second time.
 */

const BLACK = { key: "colour-1", name: "Black", hex: "#000000" };
const MAROON = { key: "colour-2", name: "Maroon", hex: "#702D42" };

function grid(sizes: string[], colours = [BLACK], previous: VariantRow[] = []) {
  return buildVariantRows({ colours, sizes, previous, productCode: "TARA2401" });
}

describe("sizes", () => {
  test("typed sizes are cleaned and de-duplicated in any case", () => {
    assert.deepEqual(addSizes(["S", "M"], ["m", "L", " l ", "XL"]), ["S", "M", "L", "XL"]);
  });

  test("an old spelling is normalised the way checkout normalises it", () => {
    assert.equal(cleanSize("Unstitched"), "Unready");
    assert.equal(cleanSize("   "), null);
  });

  test("a list can be pasted with commas or new lines", () => {
    assert.deepEqual(parseSizeList("38, 40,42\n44"), ["38", "40", "42", "44"]);
  });
});

describe("the variant grid", () => {
  test("every colour in every size, with a house-style SKU", () => {
    const rows = grid(["S", "M"], [BLACK, MAROON]);
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((row) => row.sku),
      ["TARA2401-S-BLACK", "TARA2401-M-BLACK", "TARA2401-S-MAROON", "TARA2401-M-MAROON"],
    );
    assert.ok(rows.every((row) => row.openingStock === "0" && row.variantId === null));
  });

  test("adding a size keeps what was typed in the existing rows", () => {
    const first = grid(["S"]).map((row) => ({
      ...row,
      sku: "MY-OWN-SKU",
      skuEdited: true,
      openingStock: "7",
      priceOverride: "1500",
    }));
    const next = grid(["S", "M"], [BLACK], first);
    const small = next.find((row) => row.size === "S");
    assert.equal(small?.sku, "MY-OWN-SKU");
    assert.equal(small?.openingStock, "7");
    assert.equal(small?.priceOverride, "1500");
    assert.equal(next.length, 2);
  });

  test("an unedited SKU follows the product code as it is typed", () => {
    const first = grid(["S"]);
    const next = buildVariantRows({
      colours: [BLACK],
      sizes: ["S"],
      previous: first,
      productCode: "TARA9999",
    });
    assert.equal(next[0].sku, "TARA9999-S-BLACK");
  });

  test("removing a size drops rows that do not exist yet", () => {
    const next = grid(["S"], [BLACK], grid(["S", "M"]));
    assert.deepEqual(next.map((row) => row.size), ["S"]);
  });

  test("a CREATED row survives its size being removed, and is never re-sent", () => {
    const created = grid(["S", "M"]).map((row) =>
      row.size === "M" ? { ...row, variantId: "11111111-1111-4111-8111-111111111111" } : row,
    );
    const next = grid(["S"], [BLACK], created);
    assert.ok(next.some((row) => row.size === "M" && row.variantId));
    assert.deepEqual(
      outstandingVariants(next).map((row) => row.size),
      ["S"],
      "only the row that does not exist yet is sent",
    );
  });

  test("a created row keeps its SKU even if the product code changes", () => {
    const created = grid(["S"]).map((row) => ({ ...row, variantId: "id-1" }));
    const next = buildVariantRows({
      colours: [BLACK],
      sizes: ["S"],
      previous: created,
      productCode: "CHANGED",
    });
    assert.equal(next[0].sku, "TARA2401-S-BLACK");
  });

  test("an excluded row is neither sent nor counted", () => {
    const rows = grid(["S", "M"]).map((row) => (row.size === "M" ? { ...row, excluded: true } : row));
    assert.equal(outstandingVariants(rows).length, 1);
    assert.equal(includedVariants(rows).length, 1);
  });
});

describe("validating rows before anything is sent", () => {
  test("a bad SKU is caught against the same rule the server uses", () => {
    const rows = grid(["S"]).map((row) => ({ ...row, sku: "no spaces allowed" }));
    assert.match(validateVariantRows(rows).get(rows[0].key) ?? "", /letters, numbers/);
  });

  test("two rows with one SKU are both marked", () => {
    const rows = grid(["S", "M"]).map((row) => ({ ...row, sku: "SAME-SKU" }));
    const problems = validateVariantRows(rows);
    assert.equal(problems.size, 2);
  });

  test("stock and thresholds must be whole, non-negative numbers", () => {
    const rows = grid(["S"]).map((row) => ({ ...row, openingStock: "-1" }));
    assert.match(validateVariantRows(rows).get(rows[0].key) ?? "", /Opening stock/);
    const fractional = grid(["S"]).map((row) => ({ ...row, openingStock: "2.5" }));
    assert.equal(validateVariantRows(fractional).size, 1);
  });

  test("created rows are not re-validated — they are not sent", () => {
    const rows = grid(["S"]).map((row) => ({ ...row, sku: "", variantId: "id-1" }));
    assert.equal(validateVariantRows(rows).size, 0);
  });
});

describe("colour names", () => {
  test("every colour needs a name, and two spellings of one colour are refused", () => {
    assert.match(describeColourNameProblems([{ name: "Black" }, { name: " " }]) ?? "", /name/);
    assert.match(
      describeColourNameProblems([{ name: "Black" }, { name: " black " }]) ?? "",
      /same colour/,
    );
    assert.equal(describeColourNameProblems([{ name: "Black" }, { name: "Maroon" }]), null);
  });
});

describe("readiness", () => {
  const complete: ReadinessInput = {
    name: "Silk Kameez",
    productCode: "TARA2401",
    categoryId: "cat",
    basePrice: "2500",
    description: "A silk kameez with a matching dupatta.",
    fabric: "Silk",
    careInstructions: "Dry clean only.",
    seoTitle: "",
    seoDescription: "",
    colourNames: ["Black"],
    imageCount: 3,
    coloursWithoutImages: [],
    photographsPerColour: false,
    variantCount: 4,
    totalOpeningStock: 12,
  };

  test("a complete product has nothing blocking", () => {
    assert.deepEqual(blockingItems(builderReadiness(complete)), []);
  });

  test("the two server rules for a live product are required here too", () => {
    const blocking = blockingItems(
      builderReadiness({ ...complete, description: "Short", fabric: "" }),
    ).map((item) => item.id);
    assert.ok(blocking.includes("description"));
    assert.ok(blocking.includes("fabric"));
  });

  test("no photograph, no colour or no variant blocks publishing", () => {
    for (const change of [{ imageCount: 0 }, { colourNames: [] }, { variantCount: 0 }]) {
      assert.ok(blockingItems(builderReadiness({ ...complete, ...change })).length > 0);
    }
  });

  test("an unnamed colour blocks, with a message that says so", () => {
    const item = builderReadiness({ ...complete, colourNames: ["Black", ""] }).find(
      (entry) => entry.id === "colours",
    );
    assert.equal(item?.ok, false);
    assert.match(item?.hint ?? "", /Every colour needs a name/);
  });

  test("zero stock and missing SEO are warnings, never blockers", () => {
    const items = builderReadiness({ ...complete, totalOpeningStock: 0 });
    assert.equal(items.find((item) => item.id === "stock")?.ok, false);
    assert.equal(items.find((item) => item.id === "stock")?.required, false);
    assert.equal(items.find((item) => item.id === "seo")?.required, false);
    assert.deepEqual(blockingItems(items), []);
  });

  test("every item points somewhere to fix it", () => {
    for (const item of builderReadiness(complete)) {
      assert.ok(item.section, `${item.id} has no section`);
      assert.ok(item.hint.length > 10, `${item.id} has no useful hint`);
    }
  });
});

describe("the server side is resumable and keeps the audit rules", () => {
  const actions = readFile(new URL("../lib/supabase/actions/admin.ts", import.meta.url), "utf8");

  const body = async (name: string) => {
    const source = await actions;
    const start = source.indexOf(`export async function ${name}(`);
    assert.ok(start > 0, `${name} is missing`);
    const next = source.indexOf("\nexport async function ", start + 10);
    return source.slice(start, next === -1 ? undefined : next);
  };

  test("the variant batch is behind catalogue.manage", async () => {
    assert.match(await body("createProductVariantsAction"), /await requirePermission\("catalogue\.manage"\)/);
  });

  test("a SKU already on this product is reported, not re-created", async () => {
    const source = await body("createProductVariantsAction");
    assert.match(source, /existingBySku\.get\(input\.sku\)/);
    assert.match(source, /if \(alreadyHere\) \{\s+ids\[row\.key\] = alreadyHere;\s+continue;/);
  });

  test("it only ever INSERTS — never updates an existing variant's stock", async () => {
    const source = await body("createProductVariantsAction");
    assert.match(source, /\.from\("product_variants"\)\s+\.insert\(/);
    assert.doesNotMatch(source, /\.update\(/, "stock after creation must go through the audited adjustment");
  });

  test("the colour comes from the colour row, and must belong to this product", async () => {
    const source = await body("createProductVariantsAction");
    assert.match(source, /\.eq\("product_id", product\.data\)/);
    assert.match(source, /colourEn: colour\.name_en/);
    assert.match(source, /product_colour_id: colour\.id/);
  });

  test("a colour created on an earlier attempt is renamed in place, not duplicated", async () => {
    const source = await body("createProductColoursAction");
    assert.match(source, /const ownId = colour\.id/);
    assert.match(source, /\.update\(\{[\s\S]{0,200}name_en: parsed\.data\.nameEn/);
    assert.match(source, /\.eq\("id", ownId\)\s+\.eq\("product_id", product\.data\)/);
  });
});

describe("a failed save never wipes what was typed", () => {
  test("ActionForm submits through onSubmit, not the action prop React resets", async () => {
    const source = await readFile(new URL("../components/admin/AdminForm.tsx", import.meta.url), "utf8");
    const form = source.slice(source.indexOf("export function ActionForm("));
    assert.doesNotMatch(form.slice(0, form.indexOf("export function ActionButton")), /<form[^>]*\baction=\{/);
    assert.match(form, /onSubmit=\{\(event\) => \{\s+event\.preventDefault\(\);/);
  });

  test("the builder never submits on Enter — only its buttons save", async () => {
    const source = await readFile(
      new URL("../components/admin/product-builder/ProductBuilder.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /onSubmit=\{\(event\) => event\.preventDefault\(\)\}/);
    assert.doesNotMatch(source, /type="submit"/);
  });

  test("the product is always written as a draft until the publish stage", async () => {
    const source = await readFile(
      new URL("../components/admin/product-builder/ProductBuilder.tsx", import.meta.url),
      "utf8",
    );
    const stageOne = source.slice(source.indexOf('enter("product")'), source.indexOf('enter("colours")'));
    assert.match(stageOne, /formData\.set\("status", "draft"\)/);
    assert.match(source, /setProductStatusAction\(product\.id, "active"\)/);
  });
});
