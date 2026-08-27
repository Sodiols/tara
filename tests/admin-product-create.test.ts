import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_UPLOAD_CONCURRENCY,
  MAX_IMAGE_UPLOAD_CONCURRENCY,
  describePartialUpload,
  moveByKey,
  orderedImageIds,
  outstandingUploads,
  primaryImageId,
  resolvePrimaryKey,
  runImageUploadQueue,
  screenImageCandidates,
  type UploadOutcome,
} from "../lib/product-image-workflow";
import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
} from "../lib/product-images";
import { suggestVariantSku } from "../lib/product-sku";
import { adminProductSchema, missingForActiveProduct } from "../lib/validation";

/**
 * Creating a product.
 *
 * The create screen holds the chosen files in the browser, creates the product
 * row, then uploads those files one request at a time. Everything that makes
 * that safe rather than merely convenient is pure and is tested here: the
 * product must never be created twice, an image must never be uploaded twice,
 * the order and the main image the administrator chose before the product
 * existed must survive, and a failure half way through must leave both the
 * product and the successful uploads alone.
 */

const jpeg = (name: string, size = 1024) => ({ name, size, type: "image/jpeg" });

describe("choosing product images", () => {
  test("accepts a normal multi-file pick", () => {
    const { accepted, rejected } = screenImageCandidates(
      [],
      [jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")],
    );
    assert.deepEqual(
      accepted.map((file) => file.name),
      ["a.jpg", "b.jpg", "c.jpg"],
    );
    assert.deepEqual(rejected, []);
  });

  test("the limit counts everything already chosen, not just this pick", () => {
    // Two separate picks of seven must not produce fourteen images: the second
    // pick sees the first one's files and stops at the limit.
    const first = screenImageCandidates(
      [],
      Array.from({ length: 7 }, (_, index) => jpeg(`first-${index}.jpg`)),
    );
    const second = screenImageCandidates(
      first.accepted,
      Array.from({ length: 7 }, (_, index) => jpeg(`second-${index}.jpg`)),
    );

    assert.equal(first.accepted.length, 7);
    assert.equal(second.accepted.length, MAX_IMAGES_PER_PRODUCT - 7);
    assert.equal(second.rejected.length, 7 - (MAX_IMAGES_PER_PRODUCT - 7));
    assert.match(second.rejected[0], /limit is 12 images/);
  });

  test("a lower limit is honoured, which is how the editor counts stored images", () => {
    // A product with eight images may only be sent four more.
    const { accepted, rejected } = screenImageCandidates(
      [],
      Array.from({ length: 6 }, (_, index) => jpeg(`${index}.jpg`)),
      MAX_IMAGES_PER_PRODUCT - 8,
    );
    assert.equal(accepted.length, 4);
    assert.equal(rejected.length, 2);
  });

  test("rejects the wrong type, the oversized and the empty — and says which", () => {
    const { accepted, rejected } = screenImageCandidates(
      [],
      [
        { name: "brochure.pdf", size: 2048, type: "application/pdf" },
        { name: "script.svg", size: 2048, type: "image/svg+xml" },
        { name: "huge.jpg", size: MAX_IMAGE_BYTES + 1, type: "image/jpeg" },
        { name: "empty.png", size: 0, type: "image/png" },
        jpeg("good.jpg"),
      ],
    );

    assert.deepEqual(
      accepted.map((file) => file.name),
      ["good.jpg"],
    );
    assert.equal(rejected.length, 4);
    assert.match(rejected[0], /brochure\.pdf/);
    // SVG stays refused: it is a document format that can carry script, and the
    // bucket is public.
    assert.match(rejected[1], /script\.svg/);
    assert.match(rejected[2], /larger than 5 MB/);
    assert.match(rejected[3], /empty/);
  });

  test("the same file picked twice is added once, silently", () => {
    const first = screenImageCandidates([], [jpeg("front.jpg", 900)]);
    const second = screenImageCandidates(first.accepted, [jpeg("front.jpg", 900)]);
    assert.equal(second.accepted.length, 0);
    assert.deepEqual(second.rejected, []);
  });
});

describe("arranging images before the product exists", () => {
  const items = [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }];

  test("A B C D can be rearranged to C A D B", () => {
    // The administrator's arrangement is what `sort_order` has to end up as.
    let next = moveByKey(items, "c", -1); // A C B D
    next = moveByKey(next, "c", -1); // C A B D
    next = moveByKey(next, "d", -1); // C A D B
    assert.deepEqual(
      next.map((item) => item.key),
      ["c", "a", "d", "b"],
    );
  });

  test("a move off either end changes nothing at all", () => {
    assert.equal(moveByKey(items, "a", -1), items);
    assert.equal(moveByKey(items, "d", 1), items);
    assert.equal(moveByKey(items, "missing", 1), items);
  });

  test("the first image is the main image until one is chosen", () => {
    assert.equal(resolvePrimaryKey(items, null), "a");
    assert.equal(resolvePrimaryKey(items, "c"), "c");
    // Reordering does not un-choose it.
    assert.equal(resolvePrimaryKey(moveByKey(items, "c", -1), "c"), "c");
  });

  test("removing the chosen main image falls back to the first", () => {
    const remaining = items.filter((item) => item.key !== "c");
    assert.equal(resolvePrimaryKey(remaining, "c"), "a");
    assert.equal(resolvePrimaryKey([], "c"), null);
  });

  test("the ids sent to the database follow the arrangement, not the upload order", () => {
    const stored = [
      { key: "c", imageId: "id-c" },
      { key: "a", imageId: "id-a" },
      { key: "d", imageId: "id-d" },
      { key: "b", imageId: "id-b" },
    ];
    assert.deepEqual(orderedImageIds(stored), ["id-c", "id-a", "id-d", "id-b"]);
    assert.equal(primaryImageId(stored, "d"), "id-d");
  });

  test("an image that failed is left out of the order and cannot be the primary", () => {
    const stored = [
      { key: "a", imageId: "id-a" },
      { key: "b", imageId: null },
      { key: "c", imageId: "id-c" },
    ];
    assert.deepEqual(orderedImageIds(stored), ["id-a", "id-c"]);
    // Falling back to null leaves the primary the database already set on the
    // first stored image, so the product still has exactly one.
    assert.equal(primaryImageId(stored, "b"), null);
    assert.equal(primaryImageId(stored, null), null);
  });
});

describe("the upload queue", () => {
  const list = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ key: `image-${index}` }));

  const succeed = (imageId: string): UploadOutcome => ({ ok: true, imageId });

  test("uploads in order, one at a time", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let peak = 0;

    await runImageUploadQueue({
      items: list(6),
      upload: async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        order.push(item.key);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return succeed(`stored-${item.key}`);
      },
    });

    assert.deepEqual(order, list(6).map((item) => item.key));
    assert.equal(peak, IMAGE_UPLOAD_CONCURRENCY);
  });

  test("never runs more than two at once, however many are asked for", async () => {
    let inFlight = 0;
    let peak = 0;

    await runImageUploadQueue({
      items: list(8),
      concurrency: 12,
      upload: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return succeed("stored");
      },
    });

    assert.equal(peak, MAX_IMAGE_UPLOAD_CONCURRENCY);
  });

  test("reports progress as image N of M", async () => {
    const lines: string[] = [];
    await runImageUploadQueue({
      items: list(3),
      onProgress: ({ position, total, completed }) =>
        lines.push(`${position}/${total} done:${completed}`),
      upload: async () => succeed("stored"),
    });

    assert.equal(lines[0], "1/3 done:0");
    assert.equal(lines.at(-1), "3/3 done:3");
  });

  test("one failure does not abandon the rest, and is recorded against its own file", async () => {
    const results = await runImageUploadQueue({
      items: list(6),
      upload: async (item) =>
        item.key === "image-3"
          ? { ok: false, error: "The file could not be stored. Try again." }
          : succeed(`stored-${item.key}`),
    });

    assert.equal(results.size, 6);
    assert.equal(results.get("image-3")?.ok, false);
    assert.equal(results.get("image-4")?.ok, true);
    assert.equal([...results.values()].filter((outcome) => outcome.ok).length, 5);
  });

  test("a thrown upload becomes a failed image rather than a lost queue", async () => {
    const results = await runImageUploadQueue({
      items: list(3),
      upload: async (item) => {
        if (item.key === "image-0") throw new Error("network down");
        return succeed("stored");
      },
    });

    assert.equal(results.size, 3);
    assert.equal(results.get("image-0")?.ok, false);
    assert.match(results.get("image-0")?.error ?? "", /try again/i);
  });

  test("an empty queue does no work", async () => {
    let calls = 0;
    const results = await runImageUploadQueue({
      items: [],
      upload: async () => {
        calls += 1;
        return succeed("stored");
      },
    });
    assert.equal(calls, 0);
    assert.equal(results.size, 0);
  });
});

describe("retrying after a partial failure", () => {
  test("only the images that failed are sent again", async () => {
    // Six chosen, five stored, the sixth failed. The retry must upload one
    // file — not six — because re-sending the successful five would put five
    // duplicate rows and five duplicate objects behind the same product.
    const afterFirstAttempt = [
      { key: "a", imageId: "id-a" },
      { key: "b", imageId: "id-b" },
      { key: "c", imageId: "id-c" },
      { key: "d", imageId: "id-d" },
      { key: "e", imageId: "id-e" },
      { key: "f", imageId: null },
    ];

    const retried = outstandingUploads(afterFirstAttempt);
    assert.deepEqual(
      retried.map((item) => item.key),
      ["f"],
    );

    const attempted: string[] = [];
    const results = await runImageUploadQueue({
      items: retried,
      upload: async (item) => {
        attempted.push(item.key);
        return { ok: true, imageId: "id-f" };
      },
    });

    assert.deepEqual(attempted, ["f"]);
    assert.equal(results.get("f")?.imageId, "id-f");
  });

  test("nothing is left outstanding once everything has an id", () => {
    assert.deepEqual(outstandingUploads([{ key: "a", imageId: "id-a" }]), []);
  });

  test("the partial-failure sentence names both numbers", () => {
    assert.equal(
      describePartialUpload(5, 6),
      "5 of 6 images uploaded. 1 image could not be uploaded.",
    );
    assert.equal(
      describePartialUpload(0, 3),
      "0 of 3 images uploaded. 3 images could not be uploaded.",
    );
    assert.equal(describePartialUpload(3, 3), "3 images uploaded.");
  });
});

describe("what a draft may leave blank", () => {
  const base = {
    productCode: "TARA2401",
    nameEn: "Silk Kameez",
    categoryId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f",
    basePrice: "3200",
  };

  test("a draft can be saved before the fabric and description are written", () => {
    // Otherwise staff type a full stop into the field to get past the error,
    // which is worse than an empty column.
    const parsed = adminProductSchema.safeParse({
      ...base,
      status: "draft",
      fabricEn: "",
      descriptionEn: "",
    });
    assert.equal(parsed.success, true);
  });

  test("an active product may not", () => {
    const missingFabric = adminProductSchema.safeParse({
      ...base,
      status: "active",
      fabricEn: "",
      descriptionEn: "A refined silk kameez for everyday elegance.",
    });
    assert.equal(missingFabric.success, false);

    const missingDescription = adminProductSchema.safeParse({
      ...base,
      status: "active",
      fabricEn: "Silk",
      descriptionEn: "Short",
    });
    assert.equal(missingDescription.success, false);

    const complete = adminProductSchema.safeParse({
      ...base,
      status: "active",
      fabricEn: "Silk",
      descriptionEn: "A refined silk kameez for everyday elegance.",
    });
    assert.equal(complete.success, true);
  });

  test("activating from the product list is held to the same rule", () => {
    // The list can flip a draft to active without the form ever running, so the
    // storefront requirement is restated where that happens.
    assert.deepEqual(
      missingForActiveProduct({ description_en: "", fabric_en: "" }),
      ["a description", "the fabric"],
    );
    assert.deepEqual(
      missingForActiveProduct({
        description_en: "A refined silk kameez for everyday elegance.",
        fabric_en: "Silk",
      }),
      [],
    );
  });
});

describe("suggested variant SKUs", () => {
  test("builds the house style from the product code, size and colour", () => {
    assert.equal(suggestVariantSku("TARA2401", "M", "Wine"), "TARA2401-M-WINE");
    assert.equal(suggestVariantSku("tara2401", "l", "deep wine"), "TARA2401-L-DEEP-WINE");
  });

  test("never widens what the SKU schema accepts", () => {
    // Anything outside [A-Z0-9] becomes a hyphen, so a suggestion can never be
    // a code the server would then refuse.
    assert.match(suggestVariantSku("TARA/24 01", "M/L", "Wine & Gold"), /^[A-Z0-9-]+$/);
    assert.ok(suggestVariantSku("A".repeat(40), "MEDIUM", "BURGUNDY").length <= 40);
  });

  test("stays out of the way when there is nothing useful to suggest", () => {
    assert.equal(suggestVariantSku("", "M", "Wine"), "");
    assert.equal(suggestVariantSku("TARA2401", "", ""), "");
  });
});
