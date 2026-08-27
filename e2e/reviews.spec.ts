import { test, expect, openFirstProduct } from "./fixtures";

test.describe("product reviews", () => {
  test("the review section opens an accessible sign-in path for a guest", async ({ page }) => {
    await openFirstProduct(page);
    const reviews = page.getByRole("region", { name: /customer reviews/i });
    await expect(reviews.getByRole("heading", { name: /customer reviews/i })).toBeVisible();
    await reviews.getByRole("button", { name: /write a review/i }).click();
    const dialog = page.getByRole("dialog", { name: /write a review/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/please sign in to review a product you purchased/i)).toBeVisible();
    const signIn = dialog.getByRole("link", { name: /^sign in$/i });
    await expect(signIn).toHaveAttribute("href", /returnTo=.*product.*reviews/i);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
