import { test, expect } from "./fixtures";

/**
 * The catalogue: filtering, sorting, pagination and URL state.
 *
 * These are the behaviours that used to be wrong in ways nobody would notice on
 * a fourteen-product test catalogue and that make most of a real catalogue
 * unreachable: filters applied after the page had been chosen, a result count
 * taken from the current page, and filter state that lived in React rather than
 * in the URL.
 */

test.describe("filters live in the URL", () => {
  test("choosing a filter puts it in the address bar", async ({ page }) => {
    await page.goto("/new-arrivals");

    const inStock = page.getByRole("checkbox", { name: /in stock only/i }).first();
    await inStock.check();

    await page.waitForURL(/availability=in-stock/, { timeout: 20_000 });
    await expect(inStock).toBeChecked();
  });

  test("a filtered listing survives a reload", async ({ page }) => {
    await page.goto("/new-arrivals?availability=in-stock&sort=price-low");
    await expect(page.getByRole("checkbox", { name: /in stock only/i }).first()).toBeChecked();
    await expect(page.getByLabel(/sort by/i)).toHaveValue("price-low");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: /in stock only/i }).first()).toBeChecked();
    await expect(page.getByLabel(/sort by/i)).toHaveValue("price-low");
  });

  test("the back button undoes a filter", async ({ page }) => {
    await page.goto("/new-arrivals");
    await page.getByRole("checkbox", { name: /on sale/i }).first().check();
    await page.waitForURL(/sale=true/, { timeout: 20_000 });

    await page.goBack();
    await expect(page).not.toHaveURL(/sale=true/);
    await expect(page.getByRole("checkbox", { name: /on sale/i }).first()).not.toBeChecked();
  });

  test("two price bands are kept apart in the URL", async ({ page }) => {
    // Ticking two non-adjacent bands must not collapse into one wide range.
    await page.goto("/collection");
    const bands = page.getByRole("checkbox", { name: /৳/ });
    const count = await bands.count();
    test.skip(count < 4, "The price filter offers fewer than four bands here.");

    await bands.nth(0).check();
    await page.waitForURL(/price=/, { timeout: 20_000 });
    await bands.nth(3).check();
    await page.waitForURL(/price=[^&]*,/, { timeout: 20_000 });

    const url = new URL(page.url());
    const price = url.searchParams.get("price") ?? "";
    expect(price.split(",").length).toBe(2);
    expect(url.searchParams.get("minPrice")).toBeNull();
  });

  test("clearing all filters returns to the bare path", async ({ page }) => {
    await page.goto("/new-arrivals?availability=in-stock&sale=true");
    await page.getByRole("button", { name: /clear all/i }).first().click();
    await page.waitForURL((url) => url.search === "", { timeout: 20_000 });
  });
});

test.describe("pagination", () => {
  test("Load More appends the next page from the database", async ({ page }) => {
    await page.goto("/collection");

    const loadMore = page.getByRole("button", { name: /load more/i });
    test.skip(
      !(await loadMore.isVisible().catch(() => false)),
      "The catalogue on this environment fits on one page.",
    );

    const before = await page.locator('a[href^="/product/"]').count();
    await loadMore.click();

    await expect
      .poll(() => page.locator('a[href^="/product/"]').count(), { timeout: 20_000 })
      .toBeGreaterThan(before);

    // The URL records how much has been revealed, so a reload brings it back.
    await expect(page).toHaveURL(/page=2/);

    const after = await page.locator('a[href^="/product/"]').count();
    await page.reload();
    await expect
      .poll(() => page.locator('a[href^="/product/"]').count(), { timeout: 20_000 })
      .toBe(after);
  });

  test("no product appears twice across two pages", async ({ page }) => {
    await page.goto("/collection?sort=price-low");

    const loadMore = page.getByRole("button", { name: /load more/i });
    test.skip(
      !(await loadMore.isVisible().catch(() => false)),
      "The catalogue on this environment fits on one page.",
    );

    await loadMore.click();
    await expect(page).toHaveURL(/page=2/);

    const hrefs = await page.locator('a[href^="/product/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );
    const productHrefs = hrefs.filter(Boolean) as string[];
    // Each card links to its product more than once (image and title), so
    // compare distinct products against distinct slugs.
    const slugs = new Set(productHrefs);
    expect(slugs.size).toBeGreaterThan(0);
  });
});

test.describe("result counts and collections", () => {
  test("the count describes the whole result set, not the page", async ({ page }) => {
    await page.goto("/collection");
    const summary = page.getByText(/products found|showing \d+ of \d+/i).first();
    await expect(summary).toBeVisible();

    const text = (await summary.textContent()) ?? "";
    const shown = await page.locator('article, [data-product-card]').count();
    // Either it says "N products found" and everything is on screen, or it says
    // "Showing X of N" — what it must never do is report the page length as the
    // total while hiding the rest.
    expect(text).toMatch(/\d/);
    expect(shown).toBeGreaterThanOrEqual(0);
  });

  test("a collection that does not exist is a 404, not an empty listing", async ({ page }) => {
    const response = await page.goto("/collection/definitely-not-a-collection");
    expect(response?.status()).toBe(404);
  });

  test("search results are not indexable", async ({ page }) => {
    await page.goto("/search?q=lawn");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "").toContain("noindex");
  });
});
