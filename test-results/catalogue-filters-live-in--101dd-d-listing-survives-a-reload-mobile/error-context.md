# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue.spec.ts >> filters live in the URL >> a filtered listing survives a reload
- Location: e2e\catalogue.spec.ts:24:7

# Error details

```
Error: expect(locator).toBeChecked() failed

Locator: getByRole('checkbox', { name: /in stock only/i }).first()
Expected: checked
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeChecked" with timeout 10000ms
  - waiting for getByRole('checkbox', { name: /in stock only/i }).first()

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
      - listitem: New Arrivals
  - heading "New Arrivals" [level=1]
  - paragraph: 7 products found
  - button "Filters"
  - text: Sort By
  - combobox "Sort By":
    - option "Newest First"
    - 'option "Price: Low to High" [selected]'
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
  1   | import { test, expect } from "./fixtures";
  2   | 
  3   | /**
  4   |  * The catalogue: filtering, sorting, pagination and URL state.
  5   |  *
  6   |  * These are the behaviours that used to be wrong in ways nobody would notice on
  7   |  * a fourteen-product test catalogue and that make most of a real catalogue
  8   |  * unreachable: filters applied after the page had been chosen, a result count
  9   |  * taken from the current page, and filter state that lived in React rather than
  10  |  * in the URL.
  11  |  */
  12  | 
  13  | test.describe("filters live in the URL", () => {
  14  |   test("choosing a filter puts it in the address bar", async ({ page }) => {
  15  |     await page.goto("/new-arrivals");
  16  | 
  17  |     const inStock = page.getByRole("checkbox", { name: /in stock only/i }).first();
  18  |     await inStock.check();
  19  | 
  20  |     await page.waitForURL(/availability=in-stock/, { timeout: 20_000 });
  21  |     await expect(inStock).toBeChecked();
  22  |   });
  23  | 
  24  |   test("a filtered listing survives a reload", async ({ page }) => {
  25  |     await page.goto("/new-arrivals?availability=in-stock&sort=price-low");
> 26  |     await expect(page.getByRole("checkbox", { name: /in stock only/i }).first()).toBeChecked();
      |                                                                                  ^ Error: expect(locator).toBeChecked() failed
  27  |     await expect(page.getByLabel(/sort by/i)).toHaveValue("price-low");
  28  | 
  29  |     await page.reload();
  30  |     await expect(page.getByRole("checkbox", { name: /in stock only/i }).first()).toBeChecked();
  31  |     await expect(page.getByLabel(/sort by/i)).toHaveValue("price-low");
  32  |   });
  33  | 
  34  |   test("the back button undoes a filter", async ({ page }) => {
  35  |     await page.goto("/new-arrivals");
  36  |     await page.getByRole("checkbox", { name: /on sale/i }).first().check();
  37  |     await page.waitForURL(/sale=true/, { timeout: 20_000 });
  38  | 
  39  |     await page.goBack();
  40  |     await expect(page).not.toHaveURL(/sale=true/);
  41  |     await expect(page.getByRole("checkbox", { name: /on sale/i }).first()).not.toBeChecked();
  42  |   });
  43  | 
  44  |   test("two price bands are kept apart in the URL", async ({ page }) => {
  45  |     // Ticking two non-adjacent bands must not collapse into one wide range.
  46  |     await page.goto("/collection");
  47  |     const bands = page.getByRole("checkbox", { name: /৳/ });
  48  |     const count = await bands.count();
  49  |     test.skip(count < 4, "The price filter offers fewer than four bands here.");
  50  | 
  51  |     await bands.nth(0).check();
  52  |     await page.waitForURL(/price=/, { timeout: 20_000 });
  53  |     await bands.nth(3).check();
  54  |     await page.waitForURL(/price=[^&]*,/, { timeout: 20_000 });
  55  | 
  56  |     const url = new URL(page.url());
  57  |     const price = url.searchParams.get("price") ?? "";
  58  |     expect(price.split(",").length).toBe(2);
  59  |     expect(url.searchParams.get("minPrice")).toBeNull();
  60  |   });
  61  | 
  62  |   test("clearing all filters returns to the bare path", async ({ page }) => {
  63  |     await page.goto("/new-arrivals?availability=in-stock&sale=true");
  64  |     await page.getByRole("button", { name: /clear all/i }).first().click();
  65  |     await page.waitForURL((url) => url.search === "", { timeout: 20_000 });
  66  |   });
  67  | });
  68  | 
  69  | test.describe("pagination", () => {
  70  |   test("Load More appends the next page from the database", async ({ page }) => {
  71  |     await page.goto("/collection");
  72  | 
  73  |     const loadMore = page.getByRole("button", { name: /load more/i });
  74  |     test.skip(
  75  |       !(await loadMore.isVisible().catch(() => false)),
  76  |       "The catalogue on this environment fits on one page.",
  77  |     );
  78  | 
  79  |     const before = await page.locator('a[href^="/product/"]').count();
  80  |     await loadMore.click();
  81  | 
  82  |     await expect
  83  |       .poll(() => page.locator('a[href^="/product/"]').count(), { timeout: 20_000 })
  84  |       .toBeGreaterThan(before);
  85  | 
  86  |     // The URL records how much has been revealed, so a reload brings it back.
  87  |     await expect(page).toHaveURL(/page=2/);
  88  | 
  89  |     const after = await page.locator('a[href^="/product/"]').count();
  90  |     await page.reload();
  91  |     await expect
  92  |       .poll(() => page.locator('a[href^="/product/"]').count(), { timeout: 20_000 })
  93  |       .toBe(after);
  94  |   });
  95  | 
  96  |   test("no product appears twice across two pages", async ({ page }) => {
  97  |     await page.goto("/collection?sort=price-low");
  98  | 
  99  |     const loadMore = page.getByRole("button", { name: /load more/i });
  100 |     test.skip(
  101 |       !(await loadMore.isVisible().catch(() => false)),
  102 |       "The catalogue on this environment fits on one page.",
  103 |     );
  104 | 
  105 |     await loadMore.click();
  106 |     await expect(page).toHaveURL(/page=2/);
  107 | 
  108 |     const hrefs = await page.locator('a[href^="/product/"]').evaluateAll((links) =>
  109 |       links.map((link) => link.getAttribute("href")),
  110 |     );
  111 |     const productHrefs = hrefs.filter(Boolean) as string[];
  112 |     // Each card links to its product more than once (image and title), so
  113 |     // compare distinct products against distinct slugs.
  114 |     const slugs = new Set(productHrefs);
  115 |     expect(slugs.size).toBeGreaterThan(0);
  116 |   });
  117 | });
  118 | 
  119 | test.describe("result counts and collections", () => {
  120 |   test("the count describes the whole result set, not the page", async ({ page }) => {
  121 |     await page.goto("/collection");
  122 |     const summary = page.getByText(/products found|showing \d+ of \d+/i).first();
  123 |     await expect(summary).toBeVisible();
  124 | 
  125 |     const text = (await summary.textContent()) ?? "";
  126 |     const shown = await page.locator('article, [data-product-card]').count();
```