import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the end-to-end suite.
 *
 * The rule these encode: an E2E test that silently passes because it could not
 * find anything to test is worse than no test. Every helper here either does
 * what it says or fails loudly, and every spec that needs credentials skips
 * with a stated reason rather than pretending.
 */

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL?.trim() ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD?.trim() ?? "";
export const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL?.trim() ?? "";
export const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD?.trim() ?? "";

export const hasAdminCredentials = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
export const hasCustomerCredentials = Boolean(CUSTOMER_EMAIL && CUSTOMER_PASSWORD);

/** A Bangladeshi mobile number in a range reserved for testing. */
export function testPhone(): string {
  const suffix = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return `019${suffix}`;
}

export const test = base;
export { expect };

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

export async function signOut(page: Page) {
  await page.goto("/account");
  const logout = page.getByRole("button", { name: /logout|sign out/i }).first();
  if (await logout.isVisible().catch(() => false)) {
    await logout.click();
    await page.waitForURL("**/", { timeout: 20_000 });
  }
}

/**
 * Opens the first product on a listing page and returns its slug.
 *
 * Fails rather than skipping if the catalogue is empty: an empty catalogue on a
 * test environment means the seed was not applied, and every purchase test
 * downstream would otherwise report a false pass.
 */
export async function openFirstProduct(page: Page, listingPath = "/new-arrivals") {
  await page.goto(listingPath);
  const productLink = page.locator('a[href^="/product/"]').first();
  await expect(
    productLink,
    `No products on ${listingPath}. Seed the test database with supabase/seed/development_seed.sql.`,
  ).toBeVisible({ timeout: 20_000 });

  const href = await productLink.getAttribute("href");
  await productLink.click();
  await page.waitForURL("**/product/**");
  return href?.replace("/product/", "") ?? "";
}

/** Chooses the first available colour and size, when the product offers them. */
export async function chooseFirstVariant(page: Page) {
  for (const label of [/colour|color/i, /size/i]) {
    const group = page.getByRole("radiogroup", { name: label });
    const option = group.getByRole("radio").first();
    if (await option.isVisible().catch(() => false)) {
      await option.check();
    }
  }
}
