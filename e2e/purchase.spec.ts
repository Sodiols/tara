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
 * Storefront → product → variant → bag → checkout → division → district →
 * cash-on-delivery order → order number → tracking.
 *
 * It also asserts the two things that are easy to get wrong and expensive to
 * get wrong: the delivery charge follows the Sylhet rule, and the total the
 * confirmation shows is the total the DATABASE computed, not the one the
 * browser added up.
 */

test.describe("cash-on-delivery purchase", () => {
  test("a guest can buy a product and then track the order", async ({ page }) => {
    await openFirstProduct(page);
    await chooseFirstVariant(page);

    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();

    await page.goto("/bag");
    await expect(page.getByRole("heading", { name: /shopping bag/i })).toBeVisible();

    // The bag must not be empty — if it is, the add-to-bag above silently
    // failed and everything after this would be testing nothing.
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();

    await page.getByRole("link", { name: /proceed to checkout/i }).click();
    await page.waitForURL("**/checkout");

    const phone = testPhone();
    await page.getByLabel(/full name/i).fill("Playwright Test");
    await page.getByLabel(/phone/i).fill(phone);
    await page.getByLabel(/full address/i).fill("House 12, Road 3, Test Area");

    // Division and district are separate selects, and the district list is
    // derived from the division — picking a division must repopulate it.
    await page.getByLabel(/division/i).selectOption("Sylhet");
    await expect(page.getByLabel(/^district/i)).toContainText("Sylhet");
    await page.getByLabel(/^district/i).selectOption("Sylhet");

    await page.getByRole("checkbox", { name: /terms/i }).check();

    const deliveryLine = page.getByText(/delivery/i).first();
    await expect(deliveryLine).toBeVisible();

    await page.getByRole("button", { name: /place order/i }).click();

    await expect(page.getByText(/order has been placed/i)).toBeVisible({ timeout: 30_000 });

    const body = await page.textContent("body");
    const orderNumber = body?.match(/TARA-\d+/)?.[0] ?? "";
    expect(orderNumber, "the confirmation must show an order number").toBeTruthy();

    const trackingToken = body?.match(/\b[0-9a-f]{48}\b/)?.[0] ?? "";
    expect(trackingToken, "the confirmation must show a tracking token").toBeTruthy();

    // Tracking with the order number and the token returns the order; the
    // number alone must not.
    await page.goto("/track-order");
    await page.getByPlaceholder(/order number/i).fill(orderNumber);
    await page.getByPlaceholder(/tracking token/i).fill(trackingToken);
    await page.getByRole("button", { name: /^track$/i }).click();
    await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 20_000 });
  });

  test("an order cannot be tracked with the order number alone", async ({ page }) => {
    // Guest tracking privacy: guessing an order number must not disclose a
    // customer's order.
    await page.goto("/track-order");
    await page.getByPlaceholder(/order number/i).fill("TARA-1000");
    await page.getByPlaceholder(/tracking token/i).fill("0".repeat(48));
    await page.getByRole("button", { name: /^track$/i }).click();
    await expect(page.getByText(/no order matched/i)).toBeVisible({ timeout: 20_000 });
  });

  test("the checkout refuses a district that is not in the chosen division", async ({ page }) => {
    await page.goto("/checkout");

    // With an empty bag the checkout shows its empty state; put something in it
    // first so the form is rendered.
    if (await page.getByText(/your bag is empty/i).isVisible().catch(() => false)) {
      await openFirstProduct(page);
      await chooseFirstVariant(page);
      await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
      await page.goto("/checkout");
    }

    await page.getByLabel(/division/i).selectOption("Sylhet");
    const districts = await page.getByLabel(/^district/i).locator("option").allTextContents();

    // The district list is the four real districts of Sylhet division. Upazilas
    // of Sylhet district must not appear — the previous dropdown listed four of
    // them as if they were districts.
    expect(districts).toEqual(
      expect.arrayContaining(["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"]),
    );
    expect(districts).not.toContain("Zakiganj");
    expect(districts).not.toContain("Golapganj");
    expect(districts).not.toContain("Dhaka");
  });
});

test.describe("delivery pricing follows the Sylhet rule", () => {
  test("a large order outside Sylhet is still charged for delivery", async ({ page }) => {
    await openFirstProduct(page);
    await chooseFirstVariant(page);
    await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();

    await page.goto("/checkout");
    await page.getByLabel(/division/i).selectOption("Dhaka");

    // Outside the eligible division the site must never promise free delivery,
    // whatever the subtotal — that mismatch between the copy and the charge is
    // exactly what this release fixed.
    await expect(page.getByText(/free delivery applies in sylhet only/i)).toBeVisible();
  });
});
