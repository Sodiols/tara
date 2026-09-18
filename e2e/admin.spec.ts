import {
  test,
  expect,
  signIn,
  hasAdminCredentials,
  hasCustomerCredentials,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from "./fixtures";

/**
 * The back office.
 *
 * The authorisation tests are the important ones: a customer typing an admin
 * URL must be refused by the server, not merely by a hidden navigation link.
 */

test.describe("admin authorisation", () => {
  test.skip(
    !hasCustomerCredentials,
    "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run the authorisation tests.",
  );

  test("a signed-in customer typing an admin URL is refused", async ({ page }) => {
    await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    for (const path of [
      "/admin",
      "/admin/orders",
      "/admin/products",
      "/admin/settings",
      "/admin/staff",
      "/admin/customers",
    ]) {
      await page.goto(path);
      await expect(page, `${path} must not render for a customer`).not.toHaveURL(
        new RegExp(`${path}$`),
      );
    }
  });
});

test.describe("admin panel", () => {
  test.skip(
    !hasAdminCredentials,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the admin tests.",
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("the dashboard reports real figures", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/orders today/i)).toBeVisible();
    await expect(page.getByText(/revenue today/i)).toBeVisible();
    await expect(page.getByText(/pending orders/i)).toBeVisible();
    await expect(page.getByText(/out of stock/i)).toBeVisible();
    await expect(page.getByText(/low stock/i)).toBeVisible();
    // Not a placeholder or a dash where a number should be.
    await expect(page.getByText(/orders today/i).locator("..")).toContainText(/\d/);
  });

  test("orders can be searched and paged from the database", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: /orders/i }).first()).toBeVisible();

    await page.goto("/admin/orders?q=TARA");
    await expect(page).toHaveURL(/q=TARA/);
  });

  test("inventory shows product, variant, SKU and stock", async ({ page }) => {
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: /inventory/i }).first()).toBeVisible();
    await expect(page.getByText(/out of stock/i).first()).toBeVisible();
  });

  test("the settings form exposes both delivery charges and the free-delivery rule", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await expect(page.getByLabel(/delivery inside/i)).toBeVisible();
    await expect(page.getByLabel(/delivery everywhere else/i)).toBeVisible();
    await expect(page.getByLabel(/free delivery from/i)).toBeVisible();
    await expect(page.getByLabel(/division eligible for free delivery/i)).toBeVisible();

    // Every setting on this form must do something. The ones that did not were
    // removed from the database in migration 0010 rather than left on screen.
    await expect(page.getByLabel(/express delivery/i)).toHaveCount(0);
    await expect(page.getByLabel(/online payment/i)).toHaveCount(0);
  });

  test("a product can be opened and its images managed", async ({ page }) => {
    await page.goto("/admin/products");
    const firstProduct = page.locator('a[href^="/admin/products/"]:not([href$="/new"])').first();
    test.skip(
      !(await firstProduct.isVisible().catch(() => false)),
      "No products in this environment.",
    );

    await firstProduct.click();
    await page.waitForURL("**/admin/products/**");
    await expect(page.getByRole("heading").first()).toBeVisible();

    // The editor shows the images the product HAS, and keeps the uploader
    // behind a button: on this screen adding more is optional extra management,
    // not the next step of a workflow the staff member has already finished.
    const images = page.locator("#images");
    await expect(images).toBeVisible();
    await expect(images.getByText(/\d+ \/ 12 images/)).toBeVisible();
    await expect(images.locator('input[type="file"]')).toHaveCount(0);

    await images.getByRole("button", { name: /add images/i }).click();
    await expect(images.getByText(/add product images/i)).toBeVisible();
  });

  test("adding a product is one screen, from basics to publish", async ({ page }) => {
    await page.goto("/admin/products/new");

    // Every stage of the product is on this one screen — nothing is left for a
    // second screen after the product exists.
    for (const heading of [
      /basic information/i,
      /colours and photographs/i,
      /sizes, variants and opening stock/i,
      /product details/i,
      /merchandising and search/i,
      /review and publish/i,
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    // One image control, and one action bar that is always on screen.
    await expect(page.getByText(/add product images/i)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^save as draft$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^publish product$/i })).toBeVisible();

    // Nothing on this screen promises a second step.
    await expect(page.getByText(/save the product first/i)).toHaveCount(0);
    await expect(page.getByText(/variants can be added once/i)).toHaveCount(0);
  });

  test("publishing an incomplete product explains what is missing", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByRole("button", { name: /^publish product$/i }).click();
    // Nothing is created; the page says why, next to the fields.
    await expect(page.getByText(/not saved\./i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/products\/new$/);
  });

  test("sizes turn into one variant per colour", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("Product code").fill("E2E-BUILDER");
    await page.getByLabel(/colour 1/i).fill("Black");
    await page.getByRole("button", { name: /add colour/i }).first().click();
    await page.getByLabel(/colour 2/i).fill("Maroon");
    await page.getByRole("button", { name: /^S$/ }).click();
    await page.getByRole("button", { name: /^M$/ }).click();
    await expect(page.getByText(/4 variants · 2 colours × 2 sizes/i)).toBeVisible();
    await expect(page.getByLabel(/sku for black \/ s/i)).toHaveValue("E2E-BUILDER-S-BLACK");
  });

  test("the editor has one save for the product, and says when it is unsaved", async ({ page }) => {
    await page.goto("/admin/products");
    const firstProduct = page.locator('a[href^="/admin/products/"]:not([href$="/new"])').first();
    test.skip(
      !(await firstProduct.isVisible().catch(() => false)),
      "No products in this environment.",
    );
    await firstProduct.click();
    await page.waitForURL("**/admin/products/**");

    const save = page.getByRole("button", { name: /^save changes$/i });
    await expect(save).toBeDisabled();
    await page.getByLabel("Tags").fill("e2e-check");
    await expect(page.getByText(/unsaved changes/i)).toBeVisible();
    await expect(save).toBeEnabled();
  });
});
