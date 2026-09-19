import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  colourDeleteBlocker,
  describePlan,
  draftFromRows,
  planChanges,
  planIsEmpty,
  validateDraft,
  type EditorDraft,
} from "../lib/product-editor-draft";
import type { Tables } from "../types/database";

/**
 * The product editor holds every change until Save changes.
 *
 * What these protect:
 *
 *   1. Opening a product is not a change: an untouched editor has nothing to save.
 *   2. Every kind of edit shows up in the plan, so the Save button and the
 *      "Unsaved changes" bar can never miss one — and Discard (the saved copy)
 *      has nothing left over.
 *   3. After a write is folded into the saved copy it is not sent again, which
 *      is what makes a retry after a failed step safe.
 *   4. Stock only ever moves through the audited adjustment.
 */

const COLOUR = "11111111-1111-4111-8111-111111111111";
const IMAGE_A = "22222222-2222-4222-8222-222222222222";
const IMAGE_B = "33333333-3333-4333-8333-333333333333";
const VARIANT = "44444444-4444-4444-8444-444444444444";

const colour = {
  id: COLOUR,
  product_id: "p",
  name_en: "Black",
  colour_hex: "#000000",
  is_active: true,
  sort_order: 0,
} as unknown as Tables<"product_colours">;

const image = (id: string, sort: number, primary: boolean) =>
  ({
    id,
    product_id: "p",
    image_url: `https://example.test/${id}.jpg`,
    alt_en: "",
    media_role: null,
    product_colour_id: COLOUR,
    sort_order: sort,
    is_primary: primary,
  }) as unknown as Tables<"product_images">;

const variant = {
  id: VARIANT,
  product_id: "p",
  sku: "TARA1-M-BLACK",
  size: "M",
  colour_en: "Black",
  colour_hex: "#000000",
  product_colour_id: COLOUR,
  price_override: null,
  low_stock_threshold: 3,
  is_active: true,
  stock_quantity: 5,
} as unknown as Tables<"product_variants">;

const fresh = () =>
  draftFromRows({ colours: [colour], images: [image(IMAGE_A, 0, true), image(IMAGE_B, 1, false)], variants: [variant] });

function edit(change: (draft: EditorDraft) => EditorDraft) {
  const saved = fresh();
  return { saved, draft: change(structuredClone(saved)) };
}

describe("an untouched product", () => {
  test("has nothing to save", () => {
    const saved = fresh();
    assert.ok(planIsEmpty(planChanges(saved, structuredClone(saved))));
  });

  test("a variant from before colours opens on the colour with its name", () => {
    const legacy = { ...variant, product_colour_id: null } as Tables<"product_variants">;
    const draft = draftFromRows({ colours: [colour], images: [], variants: [legacy] });
    assert.equal(draft.variants[0].colourKey, COLOUR);
  });
});

describe("every kind of change is noticed", () => {
  test("renaming a colour", () => {
    const { saved, draft } = edit((d) => ({ ...d, colours: [{ ...d.colours[0], name: "Jet Black" }] }));
    assert.equal(planChanges(saved, draft).colourWrites.length, 1);
  });

  test("turning a colour off", () => {
    const { saved, draft } = edit((d) => ({ ...d, colours: [{ ...d.colours[0], isActive: false }] }));
    assert.equal(planChanges(saved, draft).colourWrites.length, 1);
  });

  test("re-ordering photographs, or choosing another main one", () => {
    const swapped = edit((d) => ({ ...d, images: [d.images[1], d.images[0]] }));
    assert.equal(planChanges(swapped.saved, swapped.draft).reorder, true);
    const main = edit((d) => ({ ...d, primaryKey: IMAGE_B }));
    assert.equal(planChanges(main.saved, main.draft).reorder, true);
  });

  test("deleting a photograph, and describing one", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      images: [{ ...d.images[0], deleted: true }, { ...d.images[1], alt: "Back view" }],
    }));
    const plan = planChanges(saved, draft);
    assert.equal(plan.imageDeletes.length, 1);
    assert.equal(plan.imageUpdates.length, 1);
    assert.equal(plan.imageUpdates[0].alt, true);
  });

  test("a new photograph is an upload", () => {
    const file = { name: "a.jpg", size: 10, type: "image/jpeg" } as File;
    const { saved, draft } = edit((d) => ({
      ...d,
      images: [
        ...d.images,
        { key: "new-image-1", id: null, url: "blob:x", file, colourKey: null, role: "", alt: "", deleted: false },
      ],
    }));
    assert.equal(planChanges(saved, draft).imageUploads.length, 1);
  });

  test("switching a variant off, and changing its price", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      variants: [{ ...d.variants[0], isActive: false, priceOverride: "2500" }],
    }));
    assert.equal(planChanges(saved, draft).variantWrites.length, 1);
  });

  test("the bar names what is waiting", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      colours: [{ ...d.colours[0], name: "Jet Black" }],
      variants: [{ ...d.variants[0], isActive: false }],
    }));
    assert.deepEqual(describePlan(planChanges(saved, draft), true), ["product details", "1 colour", "1 variant"]);
  });
});

describe("stock", () => {
  test("a stock change is its own step, not a variant write", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      variants: [{ ...d.variants[0], stockChange: { newQuantity: "9", reason: "restock", note: "" } }],
    }));
    const plan = planChanges(saved, draft);
    assert.equal(plan.stockChanges.length, 1);
    assert.equal(plan.variantWrites.length, 0);
  });

  test("opening Adjust stock without changing the number is not a change", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      variants: [{ ...d.variants[0], stockChange: { newQuantity: "5", reason: "restock", note: "" } }],
    }));
    assert.ok(planIsEmpty(planChanges(saved, draft)));
  });

  test("the editor never writes a quantity except through adjustInventoryAction", async () => {
    const source = await readFile(new URL("../components/admin/ProductEditor.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(source, /stock_quantity/);
    assert.match(source, /adjustInventoryAction\(formData\)/);
    // An existing variant's save never carries a stock figure.
    assert.match(source, /if \(!id\) formData\.set\("initialStock"/);
  });
});

describe("checked before anything is written", () => {
  test("a bad or duplicated SKU is caught", () => {
    const bad = validateDraft({
      ...fresh(),
      variants: [{ ...fresh().variants[0], sku: "has spaces" }],
    });
    assert.match(bad.variants.get(VARIANT) ?? "", /SKU/);

    const base = fresh().variants[0];
    const twice = validateDraft({
      ...fresh(),
      variants: [base, { ...base, key: "new-variant-1", id: null }],
    });
    assert.equal(twice.variants.size, 2);
  });

  test("two spellings of one colour are refused", () => {
    const d = fresh();
    const problems = validateDraft({
      ...d,
      colours: [...d.colours, { ...d.colours[0], key: "new-colour-1", id: null, name: " black " }],
    });
    assert.match(problems.colours ?? "", /same colour/);
  });

  test("a stock change needs a whole number", () => {
    const d = fresh();
    const problems = validateDraft({
      ...d,
      variants: [{ ...d.variants[0], stockChange: { newQuantity: "2.5", reason: "restock", note: "" } }],
    });
    assert.equal(problems.variants.size, 1);
  });

  test("a colour with saved variants cannot be deleted", () => {
    assert.match(colourDeleteBlocker(fresh(), COLOUR) ?? "", /Turn it off/);
  });
});

describe("a retry sends only what is left", () => {
  test("once a write is folded into the saved copy it is no longer planned", () => {
    const { saved, draft } = edit((d) => ({
      ...d,
      colours: [{ ...d.colours[0], name: "Jet Black" }],
      variants: [{ ...d.variants[0], isActive: false }],
    }));
    // The colour step succeeded; the variant step did not.
    const afterColour = { ...saved, colours: draft.colours };
    const plan = planChanges(afterColour, draft);
    assert.equal(plan.colourWrites.length, 0);
    assert.equal(plan.variantWrites.length, 1);
  });

  test("a new row that was created carries its id and is not created again", () => {
    const base = fresh().variants[0];
    const saved = fresh();
    const created = { ...base, key: "new-variant-1", id: "55555555-5555-4555-8555-555555555555", sku: "X-1" };
    const draft = { ...saved, variants: [...saved.variants, created] };
    const plan = planChanges({ ...saved, variants: [...saved.variants, created] }, draft);
    assert.equal(plan.variantWrites.length, 0);
  });
});

describe("the editor saves in one place", () => {
  test("no panel on the edit screen writes on its own", async () => {
    for (const file of ["EditorColours.tsx", "EditorImages.tsx", "EditorVariants.tsx"]) {
      const source = await readFile(
        new URL(`../components/admin/product-editor/${file}`, import.meta.url),
        "utf8",
      );
      assert.doesNotMatch(source, /@\/lib\/supabase\/actions/, `${file} calls the server directly`);
    }
  });
});
