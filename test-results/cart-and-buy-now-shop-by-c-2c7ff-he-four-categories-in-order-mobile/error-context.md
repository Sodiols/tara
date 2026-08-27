# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart-and-buy-now.spec.ts >> shop by category >> the homepage offers the four categories, in order
- Location: e2e\cart-and-buy-now.spec.ts:121:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('a[href="/unstitched-three-piece"]').first()
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('a[href="/unstitched-three-piece"]').first()
    22 × locator resolved to <a href="/unstitched-three-piece" class="group relative font-sans font-medium text-[13px] leading-4 tracking-[0.06em] uppercase text-ink py-2">…</a>
       - unexpected value "hidden"

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
  - paragraph: TARA
  - heading "Timeless style. Made for you." [level=1]
  - paragraph: Refined clothing and accessories for everyday confidence.
  - link "Unready Three Piece":
    - /url: /new-arrivals
  - link "Two Piece":
    - /url: /collection
  - img "Woman wearing a beige TARA three piece with maroon embroidery and a matching dupatta"
  - paragraph: Categories
  - heading "Shop by Category" [level=2]
  - link "Unready Three Piece Unready Three Piece Explore":
    - /url: /unstitched-three-piece
    - img "Unready Three Piece"
    - heading "Unready Three Piece" [level=3]
    - text: Explore
    - img
  - link "Two Piece Two Piece Explore":
    - /url: /ready-three-piece
    - img "Two Piece"
    - heading "Two Piece" [level=3]
    - text: Explore
    - img
  - link "Hijab Hijab Explore":
    - /url: /hijab
    - img "Hijab"
    - heading "Hijab" [level=3]
    - text: Explore
    - img
  - link "Accessories Accessories Explore":
    - /url: /accessories
    - img "Accessories"
    - heading "Accessories" [level=3]
    - text: Explore
    - img
  - paragraph: New Arrivals
  - heading "Just In" [level=2]
  - link "Shop All":
    - /url: /new-arrivals
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
  - link "Embroidered Lawn Kurta Set New Add to wishlist":
    - /url: /product/embroidered-lawn-kurta-set
    - img "Embroidered Lawn Kurta Set"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Embroidered Lawn Kurta Set":
    - /url: /product/embroidered-lawn-kurta-set
    - heading "Embroidered Lawn Kurta Set" [level=3]
  - paragraph: Two Piece
  - text: ৳2,850
  - paragraph: L · M · S · XL
  - button "Add to Cart"
  - link "Pastel Pink Co-ord Set New Add to wishlist":
    - /url: /product/pastel-pink-co-ord-set
    - img "Pastel Pink Co-ord Set"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Pastel Pink Co-ord Set":
    - /url: /product/pastel-pink-co-ord-set
    - heading "Pastel Pink Co-ord Set" [level=3]
  - paragraph: Two Piece
  - text: ৳2,450
  - paragraph: L · M · S
  - button "Add to Cart"
  - link "Minimal Shoulder Bag New Add to wishlist":
    - /url: /product/minimal-shoulder-bag
    - img "Minimal Shoulder Bag"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Minimal Shoulder Bag":
    - /url: /product/minimal-shoulder-bag
    - heading "Minimal Shoulder Bag" [level=3]
  - paragraph: Accessories
  - text: ৳1,650
  - button "Add to Cart"
  - link "Floral Cotton Unstitched Set New Add to wishlist":
    - /url: /product/floral-cotton-unstitched-set
    - img "Floral Cotton Unstitched Set"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Floral Cotton Unstitched Set":
    - /url: /product/floral-cotton-unstitched-set
    - heading "Floral Cotton Unstitched Set" [level=3]
  - paragraph: Unready Three Piece
  - text: ৳2,450
  - button "Add to Cart"
  - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist":
    - /url: /product/embroidered-lawn-unstitched-set
    - img "Embroidered Lawn Unstitched Set"
    - text: New Sale
    - button "Add to wishlist":
      - img
  - link "Embroidered Lawn Unstitched Set":
    - /url: /product/embroidered-lawn-unstitched-set
    - heading "Embroidered Lawn Unstitched Set" [level=3]
  - paragraph: Unready Three Piece
  - text: ৳2,850 ৳3,400
  - button "Add to Cart"
  - link "Pearl Drop Earrings New Add to wishlist":
    - /url: /product/pearl-drop-earrings
    - img "Pearl Drop Earrings"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Pearl Drop Earrings":
    - /url: /product/pearl-drop-earrings
    - heading "Pearl Drop Earrings" [level=3]
  - paragraph: Accessories
  - text: ৳850
  - button "Add to Cart"
  - img "Everyday Elegance"
  - paragraph: Collections
  - heading "Everyday Elegance" [level=2]
  - paragraph: Thoughtfully selected pieces for work, family, and everyday moments.
  - link "Shop Collection":
    - /url: /collection
  - paragraph: Shop by Style
  - heading "Find Your Look" [level=2]
  - link "Everyday Wear Everyday Wear":
    - /url: /collection?style=everyday
    - img "Everyday Wear"
    - text: Everyday Wear
  - link "Office Wear Office Wear":
    - /url: /collection?style=office
    - img "Office Wear"
    - text: Office Wear
  - link "Festive Wear Festive Wear":
    - /url: /collection?style=festive
    - img "Festive Wear"
    - text: Festive Wear
  - link "Comfortable Cotton Comfortable Cotton":
    - /url: /collection?style=cotton
    - img "Comfortable Cotton"
    - text: Comfortable Cotton
  - link "New Season Colours New Season Colours":
    - /url: /collection?style=new-season
    - img "New Season Colours"
    - text: New Season Colours
  - paragraph: Customer Favourites
  - heading "Best Sellers" [level=2]
  - link "Embroidered Lawn Kurta Set New Add to wishlist":
    - /url: /product/embroidered-lawn-kurta-set
    - img "Embroidered Lawn Kurta Set"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Embroidered Lawn Kurta Set":
    - /url: /product/embroidered-lawn-kurta-set
    - heading "Embroidered Lawn Kurta Set" [level=3]
  - paragraph: Two Piece
  - text: ৳2,850
  - paragraph: L · M · S · XL
  - button "Add to Cart"
  - link "Wine Georgette Ready Set Add to wishlist":
    - /url: /product/wine-georgette-ready-set
    - img "Wine Georgette Ready Set"
    - button "Add to wishlist":
      - img
  - link "Wine Georgette Ready Set":
    - /url: /product/wine-georgette-ready-set
    - heading "Wine Georgette Ready Set" [level=3]
  - paragraph: Two Piece
  - text: ৳4,600
  - paragraph: L · M · S
  - button "Add to Cart"
  - link "Black Embellished Kurta Sale Add to wishlist":
    - /url: /product/black-embellished-kurta
    - img "Black Embellished Kurta"
    - text: Sale
    - button "Add to wishlist":
      - img
  - link "Black Embellished Kurta":
    - /url: /product/black-embellished-kurta
    - heading "Black Embellished Kurta" [level=3]
  - paragraph: Two Piece
  - text: ৳2,750 ৳3,200
  - paragraph: L · M · S · XL
  - button "Add to Cart"
  - link "Structured Tote Bag Sale Add to wishlist":
    - /url: /product/structured-tote-bag
    - img "Structured Tote Bag"
    - text: Sale
    - button "Add to wishlist":
      - img
  - link "Structured Tote Bag":
    - /url: /product/structured-tote-bag
    - heading "Structured Tote Bag" [level=3]
  - paragraph: Accessories
  - text: ৳1,950 ৳2,300
  - button "Add to Cart"
  - link "Minimal Shoulder Bag New Add to wishlist":
    - /url: /product/minimal-shoulder-bag
    - img "Minimal Shoulder Bag"
    - text: New
    - button "Add to wishlist":
      - img
  - link "Minimal Shoulder Bag":
    - /url: /product/minimal-shoulder-bag
    - heading "Minimal Shoulder Bag" [level=3]
  - paragraph: Accessories
  - text: ৳1,650
  - button "Add to Cart"
  - link "Wine Chikankari Unstitched Set Sale Add to wishlist":
    - /url: /product/wine-chikankari-unstitched-set
    - img "Wine Chikankari Unstitched Set"
    - text: Sale
    - button "Add to wishlist":
      - img
  - link "Wine Chikankari Unstitched Set":
    - /url: /product/wine-chikankari-unstitched-set
    - heading "Wine Chikankari Unstitched Set" [level=3]
  - paragraph: Unready Three Piece
  - text: ৳4,200 ৳4,900
  - button "Add to Cart"
  - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist":
    - /url: /product/embroidered-lawn-unstitched-set
    - img "Embroidered Lawn Unstitched Set"
    - text: New Sale
    - button "Add to wishlist":
      - img
  - link "Embroidered Lawn Unstitched Set":
    - /url: /product/embroidered-lawn-unstitched-set
    - heading "Embroidered Lawn Unstitched Set" [level=3]
  - paragraph: Unready Three Piece
  - text: ৳2,850 ৳3,400
  - button "Add to Cart"
  - link "Black Embroidered Unstitched Set Add to wishlist":
    - /url: /product/black-embroidered-unstitched-set
    - img "Black Embroidered Unstitched Set"
    - button "Add to wishlist":
      - img
  - link "Black Embroidered Unstitched Set":
    - /url: /product/black-embroidered-unstitched-set
    - heading "Black Embroidered Unstitched Set" [level=3]
  - paragraph: Unready Three Piece
  - text: ৳3,100
  - button "Add to Cart"
  - img "Designed for your everyday story"
  - heading "Designed for your everyday story" [level=2]
  - paragraph: TARA brings together comfort, modern style, and thoughtful details for women across Bangladesh. Every collection is selected to help you feel confident, comfortable, and beautifully yourself.
  - link "Learn About TARA":
    - /url: /about
  - heading "Follow TARA" [level=2]
  - link "@tarabd.co":
    - /url: https://instagram.com/tarabd.co
    - img
    - text: "@tarabd.co"
  - link "@tarabd.co 1":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 1"
  - link "@tarabd.co 2":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 2"
  - link "@tarabd.co 3":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 3"
  - link "@tarabd.co 4":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 4"
  - link "@tarabd.co 5":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 5"
  - link "@tarabd.co 6":
    - /url: https://instagram.com/tarabd.co
    - img "@tarabd.co 6"
  - heading "Nationwide Delivery" [level=3]
  - paragraph: To all 64 districts of Bangladesh
  - heading "Cash on Delivery" [level=3]
  - paragraph: Pay in cash when your order arrives
  - heading "Easy Exchange" [level=3]
  - paragraph: Hassle-free returns within 7 days
  - heading "Customer Support" [level=3]
  - paragraph: We're here to help you 24/7
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
> 127 |       await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
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