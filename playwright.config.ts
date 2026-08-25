import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end browser tests.
 *
 * These drive a real build against a real Supabase project, so they need an
 * environment to run against and they will refuse to run without one — see
 * e2e/fixtures.ts and docs/TESTING.md.
 *
 *   E2E_BASE_URL   where the site is running (default http://localhost:3000)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD    an existing admin account
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD    an existing customer account
 *
 * NEVER point these at production. The purchase test places real orders, which
 * really deduct stock; the admin tests really edit the catalogue. Use a
 * dedicated staging Supabase project seeded with supabase/seed/development_seed.sql.
 */
const baseURL = process.env.E2E_BASE_URL?.trim() || "http://localhost:3000";
const startsOwnServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // Checkout deducts stock and the COD rate limits are keyed on the phone
  // number, so two purchase tests running at once would fight over both.
  // Correctness matters more here than wall-clock time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The storefront is majority mobile traffic, and the filter drawer, the bag
    // drawer and the navigation are all separate components below the lg
    // breakpoint. Running the customer journey on both is not redundant.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  ...(startsOwnServer
    ? {
        webServer: {
          command: "npm run start",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
