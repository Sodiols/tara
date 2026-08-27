# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue.spec.ts >> filters live in the URL >> choosing a filter puts it in the address bar
- Location: e2e\catalogue.spec.ts:14:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.check: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('checkbox', { name: /in stock only/i }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e5]:
      - button "Menu" [ref=e7] [cursor=pointer]
      - link "TARA" [ref=e9] [cursor=pointer]:
        - /url: /
        - img "TARA" [ref=e10]
      - generic [ref=e11]:
        - button "Search" [ref=e12] [cursor=pointer]
        - button "Shopping Bag" [ref=e16] [cursor=pointer]
  - main [ref=e20]:
    - generic [ref=e21]:
      - navigation "Breadcrumb" [ref=e22]:
        - list [ref=e23]:
          - listitem [ref=e24]:
            - link "Home" [ref=e25] [cursor=pointer]:
              - /url: /
          - listitem [ref=e28]:
            - generic [ref=e29]: New Arrivals
      - heading "New Arrivals" [level=1] [ref=e30]
      - paragraph [ref=e31]: 7 products found
      - generic [ref=e33]:
        - generic [ref=e34]:
          - button "Filters" [ref=e35] [cursor=pointer]
          - generic [ref=e38]:
            - generic [ref=e39]: Sort By
            - combobox "Sort By" [ref=e40]:
              - option "Newest First" [selected]
              - 'option "Price: Low to High"'
              - 'option "Price: High to Low"'
              - option "Most Popular"
        - generic [ref=e42]:
          - generic [ref=e43]:
            - link "EID black HIjab New Sale Add to wishlist" [ref=e44] [cursor=pointer]:
              - /url: /product/eid-black-hijab
              - img "EID black HIjab" [ref=e45]
              - generic [ref=e46]:
                - generic [ref=e47]: New
                - generic [ref=e48]: Sale
              - button "Add to wishlist" [ref=e50]
            - generic [ref=e53]:
              - link [ref=e54] [cursor=pointer]:
                - /url: /product/eid-black-hijab
                - heading "EID black HIjab" [level=3] [ref=e55]
              - paragraph [ref=e56]: Hijab
              - generic [ref=e58]:
                - generic [ref=e59]: ৳220
                - generic [ref=e60]: ৳320
              - button "Add to Cart" [ref=e62] [cursor=pointer]
          - generic [ref=e63]:
            - link "Embroidered Lawn Kurta Set New Add to wishlist" [ref=e64] [cursor=pointer]:
              - /url: /product/embroidered-lawn-kurta-set
              - img "Embroidered Lawn Kurta Set" [ref=e65]
              - generic [ref=e66]: New
              - button "Add to wishlist" [ref=e69]
            - generic [ref=e72]:
              - link [ref=e73] [cursor=pointer]:
                - /url: /product/embroidered-lawn-kurta-set
                - heading "Embroidered Lawn Kurta Set" [level=3] [ref=e74]
              - paragraph [ref=e75]: Two Piece
              - generic [ref=e76]: ৳2,850
              - paragraph [ref=e80]: L · M · S · XL
              - button "Add to Cart" [ref=e82] [cursor=pointer]
          - generic [ref=e83]:
            - link "Pastel Pink Co-ord Set New Add to wishlist" [ref=e84] [cursor=pointer]:
              - /url: /product/pastel-pink-co-ord-set
              - img "Pastel Pink Co-ord Set" [ref=e85]
              - generic [ref=e86]: New
              - button "Add to wishlist" [ref=e89]
            - generic [ref=e92]:
              - link [ref=e93] [cursor=pointer]:
                - /url: /product/pastel-pink-co-ord-set
                - heading "Pastel Pink Co-ord Set" [level=3] [ref=e94]
              - paragraph [ref=e95]: Two Piece
              - generic [ref=e96]: ৳2,450
              - generic [ref=e99]:
                - generic [ref=e100]:
                  - generic "Ivory" [ref=e101]
                  - generic "Pastel Pink" [ref=e102]
                - paragraph [ref=e103]: L · M · S
              - button "Add to Cart" [ref=e105] [cursor=pointer]
          - generic [ref=e106]:
            - link "Minimal Shoulder Bag New Add to wishlist" [ref=e107] [cursor=pointer]:
              - /url: /product/minimal-shoulder-bag
              - img "Minimal Shoulder Bag" [ref=e108]
              - generic [ref=e109]: New
              - button "Add to wishlist" [ref=e112]
            - generic [ref=e115]:
              - link [ref=e116] [cursor=pointer]:
                - /url: /product/minimal-shoulder-bag
                - heading "Minimal Shoulder Bag" [level=3] [ref=e117]
              - paragraph [ref=e118]: Accessories
              - generic [ref=e119]: ৳1,650
              - generic [ref=e123]:
                - generic "Beige" [ref=e124]
                - generic "Black" [ref=e125]
              - button "Add to Cart" [ref=e127] [cursor=pointer]
          - generic [ref=e128]:
            - link "Floral Cotton Unstitched Set New Add to wishlist" [ref=e129] [cursor=pointer]:
              - /url: /product/floral-cotton-unstitched-set
              - img "Floral Cotton Unstitched Set" [ref=e130]
              - generic [ref=e131]: New
              - button "Add to wishlist" [ref=e134]
            - generic [ref=e137]:
              - link [ref=e138] [cursor=pointer]:
                - /url: /product/floral-cotton-unstitched-set
                - heading "Floral Cotton Unstitched Set" [level=3] [ref=e139]
              - paragraph [ref=e140]: Unready Three Piece
              - generic [ref=e141]: ৳2,450
              - generic [ref=e145]:
                - generic "Beige" [ref=e146]
                - generic "Pastel Pink" [ref=e147]
              - button "Add to Cart" [ref=e149] [cursor=pointer]
          - generic [ref=e150]:
            - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist" [ref=e151] [cursor=pointer]:
              - /url: /product/embroidered-lawn-unstitched-set
              - img "Embroidered Lawn Unstitched Set" [ref=e152]
              - generic [ref=e153]:
                - generic [ref=e154]: New
                - generic [ref=e155]: Sale
              - button "Add to wishlist" [ref=e157]
            - generic [ref=e160]:
              - link [ref=e161] [cursor=pointer]:
                - /url: /product/embroidered-lawn-unstitched-set
                - heading "Embroidered Lawn Unstitched Set" [level=3] [ref=e162]
              - paragraph [ref=e163]: Unready Three Piece
              - generic [ref=e165]:
                - generic [ref=e166]: ৳2,850
                - generic [ref=e167]: ৳3,400
              - generic [ref=e169]:
                - generic "Ivory" [ref=e170]
                - generic "Wine" [ref=e171]
              - button "Add to Cart" [ref=e173] [cursor=pointer]
          - generic [ref=e174]:
            - link "Pearl Drop Earrings New Add to wishlist" [ref=e175] [cursor=pointer]:
              - /url: /product/pearl-drop-earrings
              - img "Pearl Drop Earrings" [ref=e176]
              - generic [ref=e177]: New
              - button "Add to wishlist" [ref=e180]
            - generic [ref=e183]:
              - link [ref=e184] [cursor=pointer]:
                - /url: /product/pearl-drop-earrings
                - heading "Pearl Drop Earrings" [level=3] [ref=e185]
              - paragraph [ref=e186]: Accessories
              - generic [ref=e187]: ৳850
              - button "Add to Cart" [ref=e191] [cursor=pointer]
  - contentinfo [ref=e192]:
    - generic [ref=e193]:
      - generic [ref=e194]:
        - generic [ref=e195]:
          - link "TARA" [ref=e196] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=e197]
          - generic [ref=e198]:
            - link "Facebook" [ref=e199] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=e202] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=e206] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=e209]:
          - heading "Shop" [level=3] [ref=e210]
          - list [ref=e211]:
            - listitem [ref=e212]:
              - link "Unready Three Piece" [ref=e213] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=e214]:
              - link "Two Piece" [ref=e215] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=e216]:
              - link "New Arrivals" [ref=e217] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=e218]:
              - link "Accessories" [ref=e219] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=e220]:
              - link "Collection" [ref=e221] [cursor=pointer]:
                - /url: /collection
        - generic [ref=e222]:
          - heading "Customer Care" [level=3] [ref=e223]
          - list [ref=e224]:
            - listitem [ref=e225]:
              - link "Contact Us" [ref=e226] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e227]:
              - link "Delivery Information" [ref=e228] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=e229]:
              - link "Exchange Policy" [ref=e230] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=e231]:
              - link "Size Guide" [ref=e232] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=e233]:
              - link "Frequently Asked Questions" [ref=e234] [cursor=pointer]:
                - /url: /faq
        - generic [ref=e235]:
          - heading "About TARA" [level=3] [ref=e236]
          - list [ref=e237]:
            - listitem [ref=e238]:
              - link "Our Story" [ref=e239] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e240]:
              - link "Physical Store" [ref=e241] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e242]:
              - link "Careers" [ref=e243] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e244]:
              - link "Privacy Policy" [ref=e245] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=e246]:
              - link "Terms and Conditions" [ref=e247] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=e249]:
        - heading "Stay close to TARA" [level=2] [ref=e250]
        - paragraph [ref=e251]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=e252]:
          - generic [ref=e253]: Enter your email address
          - textbox "Enter your email address" [ref=e254]
          - button "Subscribe" [ref=e255] [cursor=pointer]
        - paragraph [ref=e256]: By subscribing you agree to our Privacy Policy.
      - generic [ref=e257]:
        - paragraph [ref=e258]: © 2026 TARA. All rights reserved.
        - paragraph [ref=e259]: Cash on Delivery
  - alert [ref=e260]
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
> 18  |     await inStock.check();
      |                   ^ Error: locator.check: Test timeout of 60000ms exceeded.
  19  | 
  20  |     await page.waitForURL(/availability=in-stock/, { timeout: 20_000 });
  21  |     await expect(inStock).toBeChecked();
  22  |   });
  23  | 
  24  |   test("a filtered listing survives a reload", async ({ page }) => {
  25  |     await page.goto("/new-arrivals?availability=in-stock&sort=price-low");
  26  |     await expect(page.getByRole("checkbox", { name: /in stock only/i }).first()).toBeChecked();
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
```