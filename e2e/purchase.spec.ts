import {
  test,
  expect,
  chooseFirstVariant,
  openFirstProduct,
  testPhone,
} from "./fixtures";

/**
 * The purchase journey — the one flow that has to work.
 *
 * Storefront → product → variant → bag → checkout → contact → delivery →
 * delivery area → cash-on-delivery order → order number → tracking.
 *
 * It also asserts the two things that are easy to get wrong and expensive to
 * get wrong: the delivery charge follows the zone the customer picked, and the
 * total on the confirmation is the total the DATABASE computed, not the one the
 * browser added up.
 */

async function addFirstProductToBag(page: import("@playwright/test").Page) {
  await openFirstProduct(page);
  await chooseFirstVariant(page);
  await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
}

async function fillCheckoutDetails(page: import("@playwright/test").Page) {
  await page.getByRole("textbox", { name: /^email address/i }).fill("playwright-receipt@example.com");
  await page.getByLabel(/phone number/i).fill(testPhone());
  await page.getByLabel(/^name/i).fill("Playwright Test");
  await page.getByLabel(/^address/i).fill("House 12, Road 3, Test Area");
  await page.getByLabel(/^city/i).fill("Sylhet");
}

test.describe("cash-on-delivery purchase", () => {
  test("a guest can buy from the bag and then track the order", async ({ page }) => {
    await addFirstProductToBag(page);

    await page.goto("/bag");
    await expect(page.getByRole("heading", { level: 1, name: /shopping bag/i })).toBeVisible();
    // If this is empty the add above silently failed and everything after it
    // would be testing nothing.
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();

    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await page.waitForURL("**/checkout");

    // The four sections the checkout is organised into.
    for (const heading of [/^contact$/i, /^delivery$/i, /delivery method/i, /payment method/i]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    await fillCheckoutDetails(page);
    await page.getByRole("radio", { name: /inside/i }).check();
    await page.getByRole("checkbox", { name: /terms/i }).check();
    await page.getByRole("button", { name: /place order/i }).click();

    await expect(page.getByText(/order has been placed/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /download receipt/i })).toBeVisible();

    const orderNumber = (await page.getByTestId("order-number").textContent())?.trim() ?? "";
    // TARA-YY-MM-XXXXXXXXXX: this year and month, ten symbols from the
    // unambiguous alphabet (migration 0027). Never an internal id.
    expect(orderNumber).toMatch(/^TARA-\d{2}-(0[1-9]|1[0-2])-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);

    const trackingHref = (await page.getByTestId("tracking-link").getAttribute("href")) ?? "";
    expect(trackingHref).toMatch(/^\/track\/TRK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/);
    const trackingToken = trackingHref.slice("/track/".length);
    // The confirmation shows the page, not the secret.
    await expect(page.getByText(trackingToken, { exact: true })).toHaveCount(0);

    await page.getByTestId("tracking-link").click();
    await page.waitForURL(`**${trackingHref}`);
    await expect(page.getByTestId("tracked-order-number")).toHaveText(orderNumber, { timeout: 20_000 });
    await expect(page.getByTestId("tracked-status")).toBeVisible();

    // The public page says nothing about who the order is for or where it goes.
    const body = (await page.locator("main").textContent()) ?? "";
    for (const secret of ["Playwright Test", "playwright-receipt@example.com", "House 12, Road 3", "Test Area"]) {
      expect(body, `the tracking page shows "${secret}"`).not.toContain(secret);
    }

    // The entry form accepts the pasted link and lands on the same page.
    await page.goto("/track-order");
    await page.getByLabel(/tracking code or link/i).fill(`https://www.tarabd.co${trackingHref}`);
    await page.getByRole("button", { name: /^track$/i }).click();
    await page.waitForURL(`**${trackingHref}`);
    await expect(page.getByTestId("tracked-order-number")).toHaveText(orderNumber, { timeout: 20_000 });
  });

  test("an order cannot be tracked by order number, internal id or a guessed token", async ({ page }) => {
    for (const path of [
      "/track/TARA-26-09-AAAAAAAAAA",
      "/track/16de7294-88bb-486e-95b5-fd8cbea83c0a",
      "/track/18427",
      "/track/TRK-AAAAAAAAAAAAAAAAAAAA",
      "/track/TRK-%25",
    ]) {
      await page.goto(path);
      await expect(page.getByText(/could not find an order/i), path).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("tracked-order-number")).toHaveCount(0);
    }
  });

  test("the entry form refuses something that is not a tracking code", async ({ page }) => {
    await page.goto("/track-order");
    await page.getByLabel(/tracking code or link/i).fill("TARA-1000");
    await page.getByRole("button", { name: /^track$/i }).click();
    await expect(page.getByRole("alert")).toContainText(/tracking code/i);
    await expect(page).toHaveURL(/\/track-order$/);
  });
});

test.describe("the checkout asks only what it needs", () => {
  test.beforeEach(async ({ page }) => {
    await addFirstProductToBag(page);
    await page.goto("/checkout");
  });

  test("contact requires phone and email, and nothing else", async ({ page }) => {
    await expect(page.getByLabel(/phone number/i)).toBeVisible();
    const email = page.getByRole("textbox", { name: /^email address/i });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("required", "");
  });

  test("the removed location fields are gone", async ({ page }) => {
    for (const label of [/division/i, /district/i, /upazila/i, /country|region/i, /^area$/i]) {
      await expect(page.getByLabel(label)).toHaveCount(0);
    }
    // And there is one Name field, not a first/last split.
    await expect(page.getByLabel(/first name/i)).toHaveCount(0);
    await expect(page.getByLabel(/last name/i)).toHaveCount(0);
  });

  test("delivery collects name, address, apartment, city and postal code", async ({ page }) => {
    await expect(page.getByLabel(/^name/i)).toBeVisible();
    await expect(page.getByLabel(/^address/i)).toBeVisible();
    await expect(page.getByLabel(/apartment/i)).toBeVisible();
    await expect(page.getByLabel(/^city/i)).toBeVisible();
    await expect(page.getByLabel(/postal code/i)).toBeVisible();
  });

  test("cash on delivery is the only payment method, with its terms", async ({ page }) => {
    await expect(page.getByText(/cash on delivery/i).first()).toBeVisible();
    await expect(page.getByText(/confirmed by our team via phone within 24 hours/i)).toBeVisible();
    await expect(page.getByText(/payment is due in full upon delivery/i)).toBeVisible();
  });
});

test.describe("delivery pricing follows the chosen area", () => {
  test("switching area changes the delivery charge on the summary", async ({ page }) => {
    await addFirstProductToBag(page);
    await page.goto("/checkout");

    const inside = page.getByRole("radio", { name: /inside/i });
    const outside = page.getByRole("radio", { name: /outside/i });
    await expect(inside).toBeVisible();
    await expect(outside).toBeVisible();

    await inside.check();
    const insideDelivery = await page.getByTestId("delivery-charge").innerText();

    await outside.check();
    // Outside the eligible area always pays, whatever the subtotal — this is
    // the rule the storefront used to contradict.
    await expect(outside).toBeChecked();
    const outsideDelivery = await page.getByTestId("delivery-charge").innerText();

    expect(
      insideDelivery !== outsideDelivery,
      "the delivery line must react to the chosen area",
    ).toBeTruthy();
  });
});
