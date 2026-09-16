import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UPLOAD_MAX_DIMENSION, targetDimensions } from "../lib/client-image-resize";

describe("upload downscaling", () => {
  test("a camera original is reduced to the longest edge the site can use", () => {
    assert.deepEqual(targetDimensions(4000, 5000), { width: 1920, height: 2400 });
    assert.deepEqual(targetDimensions(6000, 4000), { width: 2400, height: 1600 });
  });

  test("an image already small enough keeps its size", () => {
    assert.deepEqual(targetDimensions(1200, 1600), { width: 1200, height: 1600 });
    assert.deepEqual(targetDimensions(UPLOAD_MAX_DIMENSION, 1000), { width: UPLOAD_MAX_DIMENSION, height: 1000 });
  });

  test("a 3:4 portrait keeps enough width for the zoom view on a high-density screen", () => {
    assert.ok(targetDimensions(3000, 4000).width >= 1600);
  });
});

describe("render budget", () => {
  test("below-the-fold homepage sections are deferred, the first screen is not", async () => {
    const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

    /*
     * Read the page component's own JSX, not the whole file.
     *
     * The sections that need data are async server components declared above
     * the default export, so searching the file found `<BestSellersSection`
     * in its wrapper rather than in the page tree. What the budget actually
     * cares about is the order the page RENDERS in, which is this block.
     */
    const tree = page.slice(page.indexOf("export default function HomePage"));
    const hero = tree.indexOf("<HeroSection />");
    const bestSellers = tree.indexOf("<BestSellers");
    const firstDeferred = tree.indexOf('className="defer-render');
    assert.ok(hero > 0 && bestSellers > hero, "hero and best sellers render first");
    assert.ok(firstDeferred > bestSellers, "nothing above Best Sellers is deferred");

    const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
    assert.match(css, /\.defer-render \{\s+content-visibility: auto;\s+contain-intrinsic-size: auto var\(--defer-render-size, 900px\);/);
  });

  test("the hero does not wait for a database query", async () => {
    const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

    /*
     * The homepage used to open with `await Promise.all([...])`, so the hero —
     * which needs none of that data — was held behind three queries: 581ms to
     * first byte on a cold data cache against 68ms warm. The page component is
     * synchronous now and every query lives inside a Suspense boundary, so the
     * shell and the LCP photograph flush immediately.
     *
     * Asserted structurally because nothing else will notice if someone moves a
     * query back up: the page still renders correctly, just half a second later.
     */
    const tree = page.slice(page.indexOf("export default function HomePage"));
    assert.doesNotMatch(
      page,
      /export default async function HomePage/,
      "the page component must not be async: awaiting here blocks the hero",
    );
    assert.ok(
      tree.indexOf("<Suspense") > 0,
      "data-dependent sections stream behind their own Suspense boundaries",
    );
    assert.ok(
      tree.indexOf("<HeroSection />") < tree.indexOf("<Suspense"),
      "the hero renders before anything that waits on data",
    );
  });

  test("the Supabase SDK is not part of the header's first render", async () => {
    const header = await readFile(new URL("../components/layout/Header.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(header, /^import .*@\/lib\/supabase\/client/m);
    assert.match(header, /requestIdleCallback\(load/);
    const mobile = await readFile(new URL("../components/layout/MobileNavigation.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(mobile, /@\/lib\/supabase\/client/);
  });
});
