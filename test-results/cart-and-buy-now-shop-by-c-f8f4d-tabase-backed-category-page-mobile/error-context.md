# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart-and-buy-now.spec.ts >> shop by category >> the Hijab listing is a real database-backed category page
- Location: e2e\cart-and-buy-now.spec.ts:147:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /clear all/i }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: /clear all/i }).first()

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- banner:
  - button "Menu":
    - img
  - link "TARA":
    - /url: /
    - img "TARA"
  - button "Search":
    - img
  - button "Shopping Bag":
    - img
- main:
  - navigation "Breadcrumb":
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem: Hijab
  - heading "Hijab" [level=1]
  - paragraph: 1 product found
  - button "Filters"
  - text: Sort By
  - combobox "Sort By":
    - option "Newest First" [selected]
    - 'option "Price: Low to High"'
    - 'option "Price: High to Low"'
    - option "Most Popular"
  - link "EID black HIjab New Sale Add to wishlist":
    - /url: /product/eid-black-hijab
    - img "EID black HIjab"
    - text: New Sale
    - button "Add to wishlist":
      - img
  - link "EID black HIjab":
    - /url: /product/eid-black-hijab
    - heading "EID black HIjab" [level=3]
  - paragraph: Hijab
  - text: ৳220 ৳320
  - button "Add to Cart"
- contentinfo:
  - link "TARA":
    - /url: /
    - img "TARA"
  - link "Facebook":
    - /url: https://facebook.com/tarabd.co
    - img
  - link "Instagram":
    - /url: https://instagram.com/tarabd.co
    - img
  - link "TikTok":
    - /url: https://tiktok.com/@tarabd.co
  - heading "Shop" [level=3]
  - list:
    - listitem:
      - link "Unready Three Piece":
        - /url: /unstitched-three-piece
    - listitem:
      - link "Two Piece":
        - /url: /ready-three-piece
    - listitem:
      - link "New Arrivals":
        - /url: /new-arrivals
    - listitem:
      - link "Accessories":
        - /url: /accessories
    - listitem:
      - link "Collection":
        - /url: /collection
  - heading "Customer Care" [level=3]
  - list:
    - listitem:
      - link "Contact Us":
        - /url: /contact
    - listitem:
      - link "Delivery Information":
        - /url: /delivery-information
    - listitem:
      - link "Exchange Policy":
        - /url: /exchange-policy
    - listitem:
      - link "Size Guide":
        - /url: /size-guide
    - listitem:
      - link "Frequently Asked Questions":
        - /url: /faq
  - heading "About TARA" [level=3]
  - list:
    - listitem:
      - link "Our Story":
        - /url: /about
    - listitem:
      - link "Physical Store":
        - /url: /contact
    - listitem:
      - link "Careers":
        - /url: /contact
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy-policy
    - listitem:
      - link "Terms and Conditions":
        - /url: /terms-and-conditions
  - heading "Stay close to TARA" [level=2]
  - paragraph: Be the first to discover new collections, offers, and styling inspiration.
  - text: Enter your email address
  - textbox "Enter your email address"
  - button "Subscribe"
  - paragraph: By subscribing you agree to our Privacy Policy.
  - paragraph: © 2026 TARA. All rights reserved.
  - paragraph: Cash on Delivery
- alert
```

# Test source

```ts
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
  77  |     expect(cartLinesBefore).toBeGreaterThan(0);
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
> 153 |     await expect(page.getByRole("button", { name: /clear all/i }).first()).toBeVisible();
      |                                                                            ^ Error: expect(locator).toBeVisible() failed
  154 |   });
  155 | });
  156 | 
```