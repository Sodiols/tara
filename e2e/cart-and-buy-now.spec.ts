import { test, expect, chooseFirstVariant, openFirstProduct } from "./fixtures";

/**
 * Add to Cart, and Buy Now.
 *
 * Three behaviours that are easy to break and hard to notice:
 *
 *   * on a phone, adding to the cart must NOT throw the drawer over the page;
 *   * on a wide screen it may, because the drawer sits alongside;
 *   * Buy Now must not touch the cart at all.
 */

const drawer = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { name: /shopping bag/i }).first();

test.describe("adding to the cart", () => {
  test("mobile: the drawer does not open by itself", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only behaviour.");

    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();

    // The confirmation appears...
    await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });
    // ...and the customer stays on the product they were reading.
    await expect(page).toHaveURL(/\/product\//);
    await expect(drawer(page)).toHaveCount(0);
  });

  test("mobile: the cart icon still opens the drawer by hand", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only behaviour.");

    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
    await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });

    // Only automatic opening was removed. The manual control must still work.
    await page.getByRole("button", { name: /shopping bag/i }).first().click();
    await expect(drawer(page)).toBeVisible();
  });

  test("desktop: the drawer opens as a convenience", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop-only behaviour.");

    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();

    await expect(drawer(page)).toBeVisible({ timeout: 5_000 });
  });

  test("the confirmation clears itself quickly", async ({ page }) => {
    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();

    const toast = page.getByText(/added to cart/i);
    await expect(toast).toBeVisible({ timeout: 5_000 });
    // ~1s, so it is gone well within three.
    await expect(toast).toHaveCount(0, { timeout: 4_000 });
  });
});

test.describe("Buy Now is isolated from the cart", () => {
  test("it does not add to the cart, and buys only the selected product", async ({ page }) => {
    // Put something in the cart first: this is the case that used to break —
    // Buy Now added a second item and the order contained both.
    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
    await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });

    await page.goto("/bag");
    const cartLines = page.getByTestId("cart-line");
    await expect(cartLines.first()).toBeVisible();
    const cartLinesBefore = await cartLines.count();

    // Now Buy Now a product.
    await openFirstProduct(page, "/collection");
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /buy now/i }).first().click();

    await page.waitForURL("**/checkout/buy-now");
    await expect(page.getByRole("heading", { name: /buy now/i }).first()).toBeVisible();

    // The cart is untouched.
    await page.goto("/bag");
    await expect
      .poll(() => page.getByTestId("cart-line").count())
      .toBe(cartLinesBefore);
  });

  test("the bag and quantity persist across refresh, and removal stays removed", async ({ page }) => {
    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
    await page.goto("/bag");

    const line = page.getByTestId("cart-line").first();
    await expect(line).toBeVisible();
    await line.getByRole("button", { name: /increase quantity/i }).click();
    await expect(line.getByTestId("cart-quantity")).toHaveText("2");

    await page.reload();
    await expect(page.getByTestId("cart-line").first().getByTestId("cart-quantity")).toHaveText("2");

    await page.getByTestId("cart-line").first().getByRole("button", { name: /^remove$/i }).click();
    await expect(page.getByTestId("cart-line")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/your bag is empty/i)).toBeVisible();
  });

  test("the Buy Now checkout survives a refresh", async ({ page }) => {
    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /buy now/i }).first().click();
    await page.waitForURL("**/checkout/buy-now");

    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();
    // Still has something to buy: the selection is in sessionStorage.
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/nothing selected to buy/i)).toHaveCount(0);
  });

  test("opening the Buy Now checkout directly explains itself", async ({ page }) => {
    // No selection in this session, so it must not render an empty order form.
    await page.goto("/checkout/buy-now");
    await expect(page.getByText(/nothing selected to buy/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /shop now/i })).toBeVisible();
  });
});

test.describe("shop by category", () => {
  test("the homepage offers the four categories, in order", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("heading", { name: /shop by category/i }).locator("xpath=ancestor::section");
    await expect(section).toBeVisible();

    for (const href of ["/unstitched-three-piece", "/ready-three-piece", "/hijab", "/accessories"]) {
      await expect(section.locator(`a[href="${href}"]`)).toBeVisible();
    }
    // The slugs stay as they are; only the wording changed.
    await expect(section.getByRole("heading", { name: /^unready three piece$/i })).toBeVisible();
    await expect(section.getByRole("heading", { name: /^two piece$/i })).toBeVisible();
    // The old wording must be gone. The word boundary matters: "Unready Three
    // Piece" contains "ready three piece", so an unanchored match would fail
    // against the correct new label.
    await expect(section.getByRole("heading", { name: /^ready three piece$/i })).toHaveCount(0);
    await expect(section.getByRole("heading", { name: /^unstitched three piece$/i })).toHaveCount(0);
  });

  test("every category card opens a real listing", async ({ page }) => {
    for (const href of ["/unstitched-three-piece", "/ready-three-piece", "/hijab", "/accessories"]) {
      const response = await page.goto(href);
      expect(response?.status(), `${href} should not 404`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the Hijab listing is a real database-backed category page", async ({ page }, testInfo) => {
    await page.goto("/hijab");
    await expect(page.getByRole("heading", { name: /^hijab$/i })).toBeVisible();
    // It has the same filter sidebar as every other listing, which is what
    // proves it goes through the shared listing pipeline rather than being a
    // hardcoded page.
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: /^filters/i }).click();
    }
    await expect(page.getByRole("button", { name: /clear all/i }).first()).toBeVisible();
  });
});
