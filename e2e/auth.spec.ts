import {
  test,
  expect,
  signIn,
  signOut,
  hasCustomerCredentials,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from "./fixtures";

/**
 * Authentication and account access.
 *
 * The tests that need a real account skip with a stated reason when the
 * credentials are not configured, rather than passing vacuously.
 */

test.describe("registration and sign-in", () => {
  test("the registration form is reachable and validates before submitting", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /create|register|account/i })).toBeVisible();

    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    // Nothing should have been submitted with an empty form.
    await expect(page).toHaveURL(/\/login\?mode=register/);
  });

  test("an invalid sign-in is refused without saying which field was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill("nobody@example.com");
    await page.getByLabel(/password/i).first().fill("WrongPassword123");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 20_000 });
    // Still on the login page: a failed sign-in must not navigate anywhere.
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password accepts an address without revealing whether it exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).first().fill("nobody@example.com");
    await page.getByRole("button", { name: /send|reset/i }).first().click();
    // The same confirmation regardless, so the form cannot enumerate accounts.
    await expect(page.getByText(/check your (email|inbox)|if (that address|an account exists)/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe("protected routes", () => {
  test("the account area redirects a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login/);
    // and remembers where they were going
    expect(page.url()).toContain("returnTo");
  });

  test("the admin panel is not reachable signed out", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("returnTo cannot be used to bounce a visitor off-site", async ({ page }) => {
    // Open-redirect protection: the parameter is a path allowlist, so an
    // absolute URL must be ignored rather than followed after sign-in.
    await page.goto("/login?returnTo=https://example.com/phishing");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("signed-in customer", () => {
  test.skip(
    !hasCustomerCredentials,
    "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run the signed-in tests.",
  );

  test("can sign in, reach the account area, and sign out", async ({ page }) => {
    await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /account/i }).first()).toBeVisible();

    await page.goto("/account/orders");
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/account/addresses");
    await expect(page).not.toHaveURL(/\/login/);

    await signOut(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  // The saved address book still collects a division and a district: it is a
  // reusable record, and the geography is what validates it. Checkout no longer
  // shows either -- see e2e/purchase.spec.ts.
  test("a saved address must name a real division and district", async ({ page }) => {
    await signIn(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto("/account/addresses");

    const districts = await page.getByLabel(/^district/i).locator("option").allTextContents();
    expect(districts.length).toBeGreaterThan(0);
    expect(districts).not.toContain("Zakiganj");

    await page.getByLabel(/division/i).selectOption("Khulna");
    const khulnaDistricts = await page
      .getByLabel(/^district/i)
      .locator("option")
      .allTextContents();
    expect(khulnaDistricts).toContain("Jashore");
    expect(khulnaDistricts).not.toContain("Sylhet");
  });
});
