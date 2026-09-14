import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Every product listing route must decide its robots directive from the URL.
 *
 * WHY A SOURCE-LEVEL TEST
 * -----------------------
 * `listingMetadata()` is well covered in seo.test.ts: given filter parameters it
 * returns noindex, follow; given none it leaves the page indexable. That was
 * never the problem. The problem was routes that did not call it.
 *
 * /collection, /new-arrivals and the four seasonal collection pages each
 * exported metadata that could not see the query string — a constant `metadata`
 * export, or a `generateMetadata()` that ignored `searchParams` — so every
 * size × colour × price × sort × page permutation of them was an indexable page.
 * The category routes had it right all along, which is exactly how the gap went
 * unnoticed: the helper worked, and five routes simply were not using it.
 *
 * So this asserts the wiring rather than the helper: a route that renders a
 * product listing must generate its metadata per request, and must hand the
 * search parameters to something that understands them.
 */

const appDir = path.resolve(import.meta.dirname, "..", "app");

async function pageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return pageFiles(full);
      return entry.name === "page.tsx" ? [full] : [];
    }),
  );
  return nested.flat();
}

const route = (file: string) =>
  "/" + path.relative(appDir, path.dirname(file)).split(path.sep).join("/");

/** Helpers that take search parameters and apply the faceted-navigation rule. */
const URL_AWARE_HELPERS = /\b(listingMetadata|categoryMetadata|collectionMetadata)\b/;

describe("listing routes apply the faceted-navigation robots rule", () => {
  test("no listing route exports metadata that cannot see the query string", async () => {
    const offenders: string[] = [];
    let listings = 0;

    for (const file of await pageFiles(appDir)) {
      const source = await readFile(file, "utf8");
      const isListing = /<(ProductListingSection|CategoryListingPage)\b/.test(source);
      if (!isListing) continue;
      listings += 1;

      // A page that refuses indexing outright — search results — is stronger
      // than the faceted rule, not weaker, and may keep a constant export.
      const alwaysNoindex = /index:\s*false/.test(source);
      if (alwaysNoindex) continue;

      const staticExport = /export\s+const\s+metadata\s*[:=]/.test(source);
      const generated =
        /export\s+(async\s+)?function\s+generateMetadata\b/.test(source) ||
        /export\s+const\s+generateMetadata\b/.test(source);
      const usesHelper = URL_AWARE_HELPERS.test(source);
      const readsParams = /searchParams/.test(source);

      if (staticExport || !generated || !usesHelper || !readsParams) {
        offenders.push(
          `${route(file)} (static=${staticExport} generated=${generated} ` +
            `helper=${usesHelper} searchParams=${readsParams})`,
        );
      }
    }

    // Guards against the scan silently matching nothing and passing vacuously.
    assert.ok(listings >= 8, `expected at least 8 listing routes, found ${listings}`);
    assert.deepEqual(
      offenders,
      [],
      "These listing routes would serve every filtered, sorted and paginated " +
        "variant as an indexable page. Use listingMetadata() (or categoryMetadata / " +
        "collectionMetadata) inside generateMetadata, passing searchParams.",
    );
  });
});
