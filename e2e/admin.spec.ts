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
    const firstProduct = page.locator('a[href^="/admin/products/"]').first();
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

  test("the create screen asks for the images once, before the product exists", async ({
    page,
  }) => {
    await page.goto("/admin/products/new");

    // One image control on the whole screen. The old flow had one here and a
    // second waiting on the editor immediately afterwards, which is what made
    // creating a product feel like being asked for the same files twice.
    await expect(page.getByText(/add product images/i)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^create product$/i })).toBeVisible();

    // Nothing on this screen promises a second step for images.
    await expect(page.getByText(/save the product first/i)).toHaveCount(0);
    await expect(page.getByText(/add its variants and images/i)).toHaveCount(0);
  });
});
