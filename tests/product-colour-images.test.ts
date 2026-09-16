import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  colourIdForName,
  colourIdsWithImages,
  describeColourProblems,
  hasColourSpecificImages,
  mediaForColour,
  normaliseColourName,
  primaryImageForColour,
  type ColourGroupLike,
} from "../lib/product-colour-images";
import {
  colourChoices,
  defaultSelection,
  findVariant,
  resolveSelection,
  sizeChoices,
} from "../lib/product-variants";
import { adminProductColourDraftSchema, adminProductColourSchema } from "../lib/validation";
import { MAX_IMAGES_PER_PRODUCT } from "../lib/product-images";
import { screenImageCandidates } from "../lib/product-image-workflow";
import type { ProductImageMedia, ProductVariant } from "../types";

/**
 * Colour-specific product images.
 *
 * THE BUG THIS FEATURE FIXES
 * --------------------------
 * `product_images` belonged to a product and nothing else, so a product
 * photographed in Black, Maroon and Olive had one undifferentiated pile of
 * pictures. Selecting Maroon left the customer looking at the Black dress, and
 * the Black photograph went into their bag and onto their order.
 *
 * Images now point at a `product_colours` row by id. These tests pin the two
 * things that make that safe: the grouping is by ID and never by name or by
 * array position, and a product with no colour data behaves exactly as it did
 * before — which is the state every existing product is in.
 */

const BLACK_ID = "11111111-1111-4111-8111-111111111111";
const MAROON_ID = "22222222-2222-4222-8222-222222222222";
const OLIVE_ID = "33333333-3333-4333-8333-333333333333";

const BLACK = { name: "Black", hex: "#171717", id: BLACK_ID };
const MAROON = { name: "Maroon", hex: "#702D42", id: MAROON_ID };
const OLIVE = { name: "Olive", hex: "#556B2F", id: OLIVE_ID };

const image = (
  url: string,
  colourId: string | null,
  sortOrder = 0,
  isPrimary = false,
): ProductImageMedia => ({ url, alt: null, isPrimary, sortOrder, colourId });

/** The acceptance example: three colours, three photographs each, three sizes. */
const media: ProductImageMedia[] = [
  image("black-1.jpg", BLACK_ID, 0, true),
  image("black-2.jpg", BLACK_ID, 1),
  image("black-3.jpg", BLACK_ID, 2),
  image("maroon-1.jpg", MAROON_ID, 3),
  image("maroon-2.jpg", MAROON_ID, 4),
  image("maroon-3.jpg", MAROON_ID, 5),
  image("olive-1.jpg", OLIVE_ID, 6),
  image("olive-2.jpg", OLIVE_ID, 7),
  image("olive-3.jpg", OLIVE_ID, 8),
];

const matrix: ProductVariant[] = [
  { id: "v-m-black", size: "M", colour: BLACK, stock: 3, price: 2500, available: true },
  { id: "v-l-black", size: "L", colour: BLACK, stock: 4, price: 2500, available: true },
  { id: "v-xl-black", size: "XL", colour: BLACK, stock: 0, price: 2500, available: false },
  { id: "v-m-maroon", size: "M", colour: MAROON, stock: 2, price: 2500, available: true },
  { id: "v-l-maroon", size: "L", colour: MAROON, stock: 1, price: 2500, available: true },
  { id: "v-l-olive", size: "L", colour: OLIVE, stock: 5, price: 2700, available: true },
];

const urls = (entries: readonly ProductImageMedia[]) => entries.map((entry) => entry.url);

describe("the gallery follows the selected colour", () => {
  test("each colour shows its own photographs and no others", () => {
    assert.deepEqual(urls(mediaForColour(media, BLACK_ID)), [
      "black-1.jpg",
      "black-2.jpg",
      "black-3.jpg",
    ]);
    assert.deepEqual(urls(mediaForColour(media, MAROON_ID)), [
      "maroon-1.jpg",
      "maroon-2.jpg",
      "maroon-3.jpg",
    ]);
    assert.deepEqual(urls(mediaForColour(media, OLIVE_ID)), [
      "olive-1.jpg",
      "olive-2.jpg",
      "olive-3.jpg",
    ]);
  });

  test("selecting Maroon can never leave a Black photograph on screen", () => {
    const maroon = mediaForColour(media, MAROON_ID);
    assert.equal(
      maroon.some((entry) => entry.url.startsWith("black")),
      false,
    );
    assert.equal(
      maroon.every((entry) => entry.colourId === MAROON_ID),
      true,
    );
  });

  test("the colour is found by id, not by the name shown to the customer", () => {
    assert.equal(colourIdForName(matrix, "Maroon"), MAROON_ID);
    assert.equal(colourIdForName(matrix, "Olive"), OLIVE_ID);
    // A name nobody sells is not a colour; it must not resolve to a gallery.
    assert.equal(colourIdForName(matrix, "Sapphire"), null);
    assert.equal(colourIdForName(matrix, ""), null);
  });

  test("renaming a colour does not detach its photographs", () => {
    // The whole reason the link is an id: the customer-facing name can change.
    const renamed: ProductVariant[] = matrix.map((variant) =>
      variant.colour?.id === MAROON_ID
        ? { ...variant, colour: { ...variant.colour, name: "Deep Burgundy" } }
        : variant,
    );
    assert.equal(colourIdForName(renamed, "Deep Burgundy"), MAROON_ID);
    assert.deepEqual(urls(mediaForColour(media, colourIdForName(renamed, "Deep Burgundy"))), [
      "maroon-1.jpg",
      "maroon-2.jpg",
      "maroon-3.jpg",
    ]);
  });
});

describe("products that predate colours keep working", () => {
  const legacy = [image("a.jpg", null, 0, true), image("b.jpg", null, 1)];

  test("every image is general, and every colour shows all of them", () => {
    assert.equal(hasColourSpecificImages(legacy), false);
    assert.deepEqual(urls(mediaForColour(legacy, null)), ["a.jpg", "b.jpg"]);
    // A variant colour with no colour row yet — exactly what the backfill
    // leaves when an old variant name could not be matched.
    assert.deepEqual(urls(mediaForColour(legacy, undefined)), ["a.jpg", "b.jpg"]);
    assert.deepEqual(urls(mediaForColour(legacy, BLACK_ID)), ["a.jpg", "b.jpg"]);
  });

  test("a colour with no photographs of its own falls back to the general set", () => {
    // The administrator created Olive but has not photographed it yet.
    const mixed = [
      image("general.jpg", null, 0, true),
      image("black-1.jpg", BLACK_ID, 1),
    ];
    assert.deepEqual(urls(mediaForColour(mixed, OLIVE_ID)), ["general.jpg"]);
    assert.deepEqual(urls(mediaForColour(mixed, BLACK_ID)), ["black-1.jpg"]);
  });

  test("with no general images either, the gallery still renders something", () => {
    // Never an empty frame while the product has any photograph at all.
    assert.deepEqual(urls(mediaForColour(media, "44444444-4444-4444-8444-444444444444")), [
      "black-1.jpg",
      "black-2.jpg",
      "black-3.jpg",
      "maroon-1.jpg",
      "maroon-2.jpg",
      "maroon-3.jpg",
      "olive-1.jpg",
      "olive-2.jpg",
      "olive-3.jpg",
    ]);
  });

  test("a product with no photographs at all yields an empty list, not a crash", () => {
    assert.deepEqual(mediaForColour([], BLACK_ID), []);
    assert.equal(primaryImageForColour([], BLACK_ID), "");
    assert.equal(primaryImageForColour([], BLACK_ID, "placeholder.svg"), "placeholder.svg");
  });
});

describe("the bag and the order get the colour the customer chose", () => {
  test("the cart image is the selected colour's first photograph", () => {
    assert.equal(primaryImageForColour(media, OLIVE_ID), "olive-1.jpg");
    assert.equal(primaryImageForColour(media, MAROON_ID), "maroon-1.jpg");
    assert.equal(primaryImageForColour(media, BLACK_ID), "black-1.jpg");
  });

  test("Buy Now and Add to Cart build the same image from the same selection", () => {
    // Both call buildCartItem(), so this pins the shared derivation: the image
    // is a function of the selection, not of the product's primary image.
    const selection = resolveSelection(matrix, { size: "L", colour: "Olive" }, "colour");
    const cartImage = primaryImageForColour(media, colourIdForName(matrix, selection.colour));
    assert.equal(selection.colour, "Olive");
    assert.equal(cartImage, "olive-1.jpg");
  });

  test("a colour with no photographs still puts a real image in the bag", () => {
    const mixed = [image("general.jpg", null, 0, true), image("black-1.jpg", BLACK_ID, 1)];
    assert.equal(primaryImageForColour(mixed, OLIVE_ID), "general.jpg");
  });
});

describe("choosing a colour does not break what can be bought", () => {
  test("the default selection and its gallery agree", () => {
    const selection = defaultSelection(matrix);
    assert.equal(selection.size, "M");
    assert.equal(selection.colour, "Black");
    // One source of truth: the gallery is derived from the same selection the
    // purchase is, so they cannot disagree on which colour is being viewed.
    assert.deepEqual(urls(mediaForColour(media, colourIdForName(matrix, selection.colour))), [
      "black-1.jpg",
      "black-2.jpg",
      "black-3.jpg",
    ]);
  });

  test("picking a colour moves the size to one that exists in it", () => {
    // Olive is only made in L. Selecting it from M must not leave (M, Olive).
    const next = resolveSelection(matrix, { size: "M", colour: "Olive" }, "colour");
    assert.deepEqual(next, { size: "L", colour: "Olive" });
    assert.notEqual(findVariant(matrix, next.size, next.colour), null);
  });

  test("no impossible size and colour combination becomes purchasable", () => {
    assert.equal(findVariant(matrix, "M", "Olive"), null);
    assert.equal(findVariant(matrix, "XL", "Maroon"), null);

    const sizes = sizeChoices(matrix, "Olive");
    assert.deepEqual(sizes, [
      { size: "M", selectable: false },
      { size: "L", selectable: true },
      { size: "XL", selectable: false },
    ]);
  });

  test("colour swatches carry their id, so the gallery can be keyed on it", () => {
    const choices = colourChoices(matrix, "L");
    assert.deepEqual(
      choices.map((choice) => [choice.name, choice.id, choice.selectable]),
      [
        ["Black", BLACK_ID, true],
        ["Maroon", MAROON_ID, true],
        ["Olive", OLIVE_ID, true],
      ],
    );
    // XL exists only in Black, so the other two are offered but not selectable.
    assert.deepEqual(
      colourChoices(matrix, "XL").map((choice) => choice.selectable),
      [false, false, false],
    );
  });
});

describe("the admin panel refuses colours that would collide", () => {
  const draft = (name: string, images = 1): ColourGroupLike => ({
    name,
    images: Array.from({ length: images }, (_, index) => ({ key: `${name}-${index}` })),
  });

  test("two spellings of the same colour are rejected before anything is created", () => {
    // "Black" and "black" would otherwise become two colours with two
    // galleries, identical to the customer.
    const problem = describeColourProblems([draft("Black"), draft("black")]);
    assert.match(problem ?? "", /same colour/i);
    assert.equal(normaliseColourName("  BLACK "), "black");
  });

  test("a colour with no name or no photographs is refused", () => {
    assert.match(describeColourProblems([draft("")]) ?? "", /name/i);
    assert.match(describeColourProblems([draft("Olive", 0)]) ?? "", /photograph/i);
    assert.match(describeColourProblems([]) ?? "", /at least one colour/i);
  });

  test("a valid set of colours passes", () => {
    assert.equal(
      describeColourProblems([draft("Black"), draft("Maroon"), draft("Olive")]),
      null,
    );
  });

  test("the same rules are enforced by the schema the server runs", () => {
    const duplicate = adminProductColourDraftSchema.safeParse([
      { key: "a", nameEn: "Black", colourHex: "#171717" },
      { key: "b", nameEn: " black ", colourHex: "#000000" },
    ]);
    assert.equal(duplicate.success, false);

    const badHex = adminProductColourSchema.safeParse({
      productId: BLACK_ID,
      nameEn: "Black",
      colourHex: "black",
    });
    assert.equal(badHex.success, false);

    const good = adminProductColourSchema.safeParse({
      productId: BLACK_ID,
      nameEn: "  Olive Green  ",
      colourHex: "#556B2F",
    });
    assert.equal(good.success, true);
    // Trimmed before it reaches the database, so the unique index sees one form.
    assert.equal(good.success && good.data.nameEn, "Olive Green");
  });
});

describe("the image limit counts every colour together", () => {
  test("twelve is the product limit, not a per-colour one", () => {
    // Three colours of five would be fifteen images; the picker screens the
    // thirteenth rather than letting the server refuse it after the product row
    // already exists.
    const existing = Array.from({ length: 10 }, (_, index) => ({
      name: `have-${index}.jpg`,
      size: 1024,
      type: "image/jpeg",
    }));
    const { accepted, rejected } = screenImageCandidates(existing, [
      { name: "new-1.jpg", size: 1024, type: "image/jpeg" },
      { name: "new-2.jpg", size: 1024, type: "image/jpeg" },
      { name: "new-3.jpg", size: 1024, type: "image/jpeg" },
    ]);
    assert.equal(existing.length + accepted.length, MAX_IMAGES_PER_PRODUCT);
    assert.equal(rejected.length, 1);
  });
});

describe("colour ownership of images is explicit", () => {
  test("only colours that actually own photographs are reported", () => {
    const ids = colourIdsWithImages([
      image("general.jpg", null),
      image("black-1.jpg", BLACK_ID),
      image("black-2.jpg", BLACK_ID),
    ]);
    assert.deepEqual([...ids], [BLACK_ID]);
  });

  test("deleting one colour's photographs leaves the others alone", () => {
    // What the delete action does to the array the page is holding.
    const remaining = media.filter((entry) => entry.colourId !== MAROON_ID);
    assert.deepEqual(urls(mediaForColour(remaining, BLACK_ID)), [
      "black-1.jpg",
      "black-2.jpg",
      "black-3.jpg",
    ]);
    assert.deepEqual(urls(mediaForColour(remaining, OLIVE_ID)), [
      "olive-1.jpg",
      "olive-2.jpg",
      "olive-3.jpg",
    ]);
    // Maroon now falls back rather than showing nothing.
    assert.equal(mediaForColour(remaining, MAROON_ID).length > 0, true);
  });

  test("a deleted colour leaves its images as general ones, not orphans", () => {
    // ON DELETE SET NULL in migration 0025, modelled here.
    const afterColourDeleted = media.map((entry) =>
      entry.colourId === OLIVE_ID ? { ...entry, colourId: null } : entry,
    );
    assert.deepEqual(urls(mediaForColour(afterColourDeleted, OLIVE_ID)), [
      "olive-1.jpg",
      "olive-2.jpg",
      "olive-3.jpg",
    ]);
    assert.deepEqual(urls(mediaForColour(afterColourDeleted, BLACK_ID)), [
      "black-1.jpg",
      "black-2.jpg",
      "black-3.jpg",
    ]);
  });
});
