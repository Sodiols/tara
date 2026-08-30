import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * A guard against reintroducing the hydration fault.
 *
 * THE BUG
 * -------
 * A `loading.tsx` puts its route's page inside a Suspense boundary. On this
 * Next.js 16 / React 19 combination, that boundary's content is streamed and
 * painted but never hydrated: the boundary comment ends up `$~` instead of `$`,
 * and every client component inside it stays inert.
 *
 * On the catalogue routes that meant the filters, the sort dropdown, add to
 * cart and the wishlist did nothing at all — the page looked perfect and no
 * error was logged anywhere. Products and copy were still in the server HTML,
 * so it was invisible to crawlers and to any check that reads the markup.
 *
 * HOW IT WAS PROVED
 * -----------------
 * One production build, one variable: `/two-piece` with its loading.tsx removed
 * hydrated; `/hijab` with its loading.tsx present, in the same build, did not.
 * It is not the CSP (removing `strict-dynamic` changed nothing), not chunk
 * loading (every chunk 200s), and not fixable with `force-dynamic`.
 *
 * WHY A TEST CAN CHECK THIS
 * -------------------------
 * A unit test cannot hydrate a page. What it CAN do is assert the structural
 * precondition: no `loading.tsx` under a route whose page is interactive. That
 * is exactly the mistake this guards, and it fails loudly the moment someone
 * adds one back for the nicer loading state.
 *
 * If a future Next.js release fixes the underlying bug, delete this file and
 * the loading states can come back — but verify hydration in a production
 * build first, because nothing else will tell you.
 */

const APP_DIR = path.join(process.cwd(), "app");

function loadingFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      loadingFiles(full, found);
    } else if (entry === "loading.tsx" || entry === "loading.jsx") {
      found.push(path.relative(process.cwd(), full).split(path.sep).join("/"));
    }
  }
  return found;
}

describe("route-level loading boundaries", () => {
  test("no route reintroduces a loading.tsx", () => {
    const found = loadingFiles(APP_DIR);
    assert.deepEqual(
      found,
      [],
      `A loading.tsx wraps its page in a Suspense boundary that does not hydrate ` +
        `on this Next/React version, leaving every control on the page inert. ` +
        `Found: ${found.join(", ")}. See the note at the top of this file.`,
    );
  });

  test("the skeleton modules that only served those boundaries are gone", () => {
    // Kept as an explicit assertion rather than a silent deletion: if someone
    // restores loading.tsx they will need these back, and this says so.
    for (const dead of [
      "components/product/ProductListingSkeleton.tsx",
      "components/ui/LoadingSkeleton.tsx",
    ]) {
      assert.throws(
        () => statSync(path.join(process.cwd(), dead)),
        `${dead} was removed with the loading boundaries; restore it only alongside them`,
      );
    }
  });
});
