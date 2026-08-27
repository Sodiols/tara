# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart-and-buy-now.spec.ts >> Buy Now is isolated from the cart >> it does not add to the cart, and buys only the selected product
- Location: e2e\cart-and-buy-now.spec.ts:67:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "Skip to main content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=f1e3]:
    - generic [ref=f1e5]:
      - button "Menu" [ref=f1e7] [cursor=pointer]
      - link "TARA" [ref=f1e9] [cursor=pointer]:
        - /url: /
        - img "TARA" [ref=f1e10]
      - generic [ref=f1e11]:
        - button "Search" [ref=f1e12] [cursor=pointer]
        - button "Shopping Bag" [ref=f1e16] [cursor=pointer]:
          - generic [ref=f1e20]: "1"
  - main [ref=f1e21]:
    - generic [ref=f1e22]:
      - navigation "Breadcrumb" [ref=f1e23]:
        - list [ref=f1e24]:
          - listitem [ref=f1e25]:
            - link "Home" [ref=f1e26] [cursor=pointer]:
              - /url: /
          - listitem [ref=f1e29]:
            - generic [ref=f1e30]: Shopping Bag
      - heading "Shopping Bag" [level=1] [ref=f1e31]
      - generic [ref=f1e32]:
        - generic [ref=f1e33]:
          - generic [ref=f1e34]:
            - link [ref=f1e35] [cursor=pointer]:
              - /url: /product/eid-black-hijab
              - img "EID black HIjab" [ref=f1e36]
            - generic [ref=f1e37]:
              - generic [ref=f1e38]:
                - link "EID black HIjab" [ref=f1e39] [cursor=pointer]:
                  - /url: /product/eid-black-hijab
                - generic [ref=f1e40]: ৳220
              - paragraph [ref=f1e41]: M / Black
              - generic [ref=f1e42]:
                - generic [ref=f1e43]:
                  - button "Decrease quantity" [ref=f1e44] [cursor=pointer]
                  - generic [ref=f1e46]: "1"
                  - button "Increase quantity" [ref=f1e47] [cursor=pointer]
                - generic [ref=f1e49]:
                  - button "Move to Wishlist" [ref=f1e50] [cursor=pointer]
                  - button "Remove" [ref=f1e51] [cursor=pointer]
          - link "Continue Shopping" [ref=f1e53] [cursor=pointer]:
            - /url: /new-arrivals
        - generic [ref=f1e54]:
          - heading "Shopping Bag" [level=2] [ref=f1e55]
          - generic [ref=f1e56]:
            - generic [ref=f1e57]: Subtotal
            - generic [ref=f1e58]: ৳220
          - generic [ref=f1e59]:
            - generic [ref=f1e60]: Delivery
            - generic [ref=f1e61]: From ৳90
          - paragraph [ref=f1e62]: The exact delivery charge depends on your delivery area and is confirmed at checkout.
          - generic [ref=f1e63]:
            - generic [ref=f1e64]: Coupon Code
            - generic [ref=f1e65]:
              - textbox "Coupon Code" [ref=f1e66]
              - button "Apply" [ref=f1e67] [cursor=pointer]
          - generic [ref=f1e68]:
            - generic [ref=f1e69]: Total
            - generic [ref=f1e70]: ৳310
          - link [ref=f1e71] [cursor=pointer]:
            - /url: /checkout
            - button "Proceed to Checkout" [ref=f1e72]
  - contentinfo [ref=f1e73]:
    - generic [ref=f1e74]:
      - generic [ref=f1e75]:
        - generic [ref=f1e76]:
          - link "TARA" [ref=f1e77] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=f1e78]
          - generic [ref=f1e79]:
            - link "Facebook" [ref=f1e80] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=f1e83] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=f1e87] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=f1e90]:
          - heading "Shop" [level=3] [ref=f1e91]
          - list [ref=f1e92]:
            - listitem [ref=f1e93]:
              - link "Unready Three Piece" [ref=f1e94] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=f1e95]:
              - link "Two Piece" [ref=f1e96] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=f1e97]:
              - link "New Arrivals" [ref=f1e98] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=f1e99]:
              - link "Accessories" [ref=f1e100] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=f1e101]:
              - link "Collection" [ref=f1e102] [cursor=pointer]:
                - /url: /collection
        - generic [ref=f1e103]:
          - heading "Customer Care" [level=3] [ref=f1e104]
          - list [ref=f1e105]:
            - listitem [ref=f1e106]:
              - link "Contact Us" [ref=f1e107] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e108]:
              - link "Delivery Information" [ref=f1e109] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=f1e110]:
              - link "Exchange Policy" [ref=f1e111] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=f1e112]:
              - link "Size Guide" [ref=f1e113] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=f1e114]:
              - link "Frequently Asked Questions" [ref=f1e115] [cursor=pointer]:
                - /url: /faq
        - generic [ref=f1e116]:
          - heading "About TARA" [level=3] [ref=f1e117]
          - list [ref=f1e118]:
            - listitem [ref=f1e119]:
              - link "Our Story" [ref=f1e120] [cursor=pointer]:
                - /url: /about
            - listitem [ref=f1e121]:
              - link "Physical Store" [ref=f1e122] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e123]:
              - link "Careers" [ref=f1e124] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e125]:
              - link "Privacy Policy" [ref=f1e126] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=f1e127]:
              - link "Terms and Conditions" [ref=f1e128] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=f1e130]:
        - heading "Stay close to TARA" [level=2] [ref=f1e131]
        - paragraph [ref=f1e132]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=f1e133]:
          - generic [ref=f1e134]: Enter your email address
          - textbox "Enter your email address" [ref=f1e135]
          - button "Subscribe" [ref=f1e136] [cursor=pointer]
        - paragraph [ref=f1e137]: By subscribing you agree to our Privacy Policy.
      - generic [ref=f1e138]:
        - paragraph [ref=f1e139]: © 2026 TARA. All rights reserved.
        - paragraph [ref=f1e140]: Cash on Delivery
  - alert [ref=f1e141]
```

# Test source

```ts
  1   | import { test, expect, chooseFirstVariant, openFirstProduct } from "./fixtures";
  2   | 
  3   | /**
  4   |  * Add to Cart, and Buy Now.
  5   |  *
  6   |  * Three behaviours that are easy to break and hard to notice:
  7   |  *
  8   |  *   * on a phone, adding to the cart must NOT throw the drawer over the page;
  9   |  *   * on a wide screen it may, because the drawer sits alongside;
  10  |  *   * Buy Now must not touch the cart at all.
  11  |  */
  12  | 
  13  | const drawer = (page: import("@playwright/test").Page) =>
  14  |   page.getByRole("heading", { name: /shopping bag/i }).first();
  15  | 
  16  | test.describe("adding to the cart", () => {
  17  |   test("mobile: the drawer does not open by itself", async ({ page }, testInfo) => {
  18  |     test.skip(testInfo.project.name !== "mobile", "Mobile-only behaviour.");
  19  | 
  20  |     await openFirstProduct(page);
  21  |     await chooseFirstVariant(page);
  22  |     await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  23  | 
  24  |     // The confirmation appears...
  25  |     await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });
  26  |     // ...and the customer stays on the product they were reading.
  27  |     await expect(page).toHaveURL(/\/product\//);
  28  |     await expect(drawer(page)).toHaveCount(0);
  29  |   });
  30  | 
  31  |   test("mobile: the cart icon still opens the drawer by hand", async ({ page }, testInfo) => {
  32  |     test.skip(testInfo.project.name !== "mobile", "Mobile-only behaviour.");
  33  | 
  34  |     await openFirstProduct(page);
  35  |     await chooseFirstVariant(page);
  36  |     await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  37  |     await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });
  38  | 
  39  |     // Only automatic opening was removed. The manual control must still work.
  40  |     await page.getByRole("button", { name: /shopping bag/i }).first().click();
  41  |     await expect(drawer(page)).toBeVisible();
  42  |   });
  43  | 
  44  |   test("desktop: the drawer opens as a convenience", async ({ page }, testInfo) => {
  45  |     test.skip(testInfo.project.name === "mobile", "Desktop-only behaviour.");
  46  | 
  47  |     await openFirstProduct(page);
  48  |     await chooseFirstVariant(page);
  49  |     await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  50  | 
  51  |     await expect(drawer(page)).toBeVisible({ timeout: 5_000 });
  52  |   });
  53  | 
  54  |   test("the confirmation clears itself quickly", async ({ page }) => {
  55  |     await openFirstProduct(page);
  56  |     await chooseFirstVariant(page);
  57  |     await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  58  | 
  59  |     const toast = page.getByText(/added to cart/i);
  60  |     await expect(toast).toBeVisible({ timeout: 5_000 });
  61  |     // ~1s, so it is gone well within three.
  62  |     await expect(toast).toHaveCount(0, { timeout: 4_000 });
  63  |   });
  64  | });
  65  | 
  66  | test.describe("Buy Now is isolated from the cart", () => {
  67  |   test("it does not add to the cart, and buys only the selected product", async ({ page }) => {
  68  |     // Put something in the cart first: this is the case that used to break —
  69  |     // Buy Now added a second item and the order contained both.
  70  |     await openFirstProduct(page);
  71  |     await chooseFirstVariant(page);
  72  |     await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  73  |     await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 5_000 });
  74  | 
  75  |     await page.goto("/bag");
  76  |     const cartLinesBefore = await page.locator('a[href^="/product/"]').count();
> 77  |     expect(cartLinesBefore).toBeGreaterThan(0);
      |                             ^ Error: expect(received).toBeGreaterThan(expected)
  78  | 
  79  |     // Now Buy Now a product.
  80  |     await openFirstProduct(page, "/collection");
  81  |     await chooseFirstVariant(page);
  82  |     await page.getByRole("button", { name: /buy now/i }).first().click();
  83  | 
  84  |     await page.waitForURL("**/checkout/buy-now");
  85  |     await expect(page.getByRole("heading", { name: /buy now/i }).first()).toBeVisible();
  86  | 
  87  |     // The cart is untouched.
  88  |     await page.goto("/bag");
  89  |     await expect
  90  |       .poll(() => page.locator('a[href^="/product/"]').count())
  91  |       .toBe(cartLinesBefore);
  92  |   });
  93  | 
  94  |   test("the Buy Now checkout survives a refresh", async ({ page }) => {
  95  |     await openFirstProduct(page);
  96  |     await chooseFirstVariant(page);
  97  |     await page.getByRole("button", { name: /buy now/i }).first().click();
  98  |     await page.waitForURL("**/checkout/buy-now");
  99  | 
  100 |     await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
  101 |       timeout: 10_000,
  102 |     });
  103 | 
  104 |     await page.reload();
  105 |     // Still has something to buy: the selection is in sessionStorage.
  106 |     await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({
  107 |       timeout: 10_000,
  108 |     });
  109 |     await expect(page.getByText(/nothing selected to buy/i)).toHaveCount(0);
  110 |   });
  111 | 
  112 |   test("opening the Buy Now checkout directly explains itself", async ({ page }) => {
  113 |     // No selection in this session, so it must not render an empty order form.
  114 |     await page.goto("/checkout/buy-now");
  115 |     await expect(page.getByText(/nothing selected to buy/i)).toBeVisible({ timeout: 10_000 });
  116 |     await expect(page.getByRole("link", { name: /shop now/i })).toBeVisible();
  117 |   });
  118 | });
  119 | 
  120 | test.describe("shop by category", () => {
  121 |   test("the homepage offers the four categories, in order", async ({ page }) => {
  122 |     await page.goto("/");
  123 |     const section = page.getByRole("heading", { name: /shop by category/i }).locator("..");
  124 |     await expect(section).toBeVisible();
  125 | 
  126 |     for (const href of ["/unstitched-three-piece", "/ready-three-piece", "/hijab", "/accessories"]) {
  127 |       await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  128 |     }
  129 |     // The slugs stay as they are; only the wording changed.
  130 |     await expect(page.getByText(/unready three piece/i).first()).toBeVisible();
  131 |     await expect(page.getByText(/^two piece$/i).first()).toBeVisible();
  132 |     // The old wording must be gone. The word boundary matters: "Unready Three
  133 |     // Piece" contains "ready three piece", so an unanchored match would fail
  134 |     // against the correct new label.
  135 |     await expect(page.getByText(/ready three piece/i)).toHaveCount(0);
  136 |     await expect(page.getByText(/unstitched/i)).toHaveCount(0);
  137 |   });
  138 | 
  139 |   test("every category card opens a real listing", async ({ page }) => {
  140 |     for (const href of ["/unstitched-three-piece", "/ready-three-piece", "/hijab", "/accessories"]) {
  141 |       const response = await page.goto(href);
  142 |       expect(response?.status(), `${href} should not 404`).toBeLessThan(400);
  143 |       await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  144 |     }
  145 |   });
  146 | 
  147 |   test("the Hijab listing is a real database-backed category page", async ({ page }) => {
  148 |     await page.goto("/hijab");
  149 |     await expect(page.getByRole("heading", { name: /^hijab$/i })).toBeVisible();
  150 |     // It has the same filter sidebar as every other listing, which is what
  151 |     // proves it goes through the shared listing pipeline rather than being a
  152 |     // hardcoded page.
  153 |     await expect(page.getByRole("button", { name: /clear all/i }).first()).toBeVisible();
  154 |   });
  155 | });
  156 | 
```