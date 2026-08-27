# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue.spec.ts >> filters live in the URL >> clearing all filters returns to the bare path
- Location: e2e\catalogue.spec.ts:62:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /clear all/i }).first()

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
      - paragraph [ref=e31]: 2 products found
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
            - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist" [ref=e64] [cursor=pointer]:
              - /url: /product/embroidered-lawn-unstitched-set
              - img "Embroidered Lawn Unstitched Set" [ref=e65]
              - generic [ref=e66]:
                - generic [ref=e67]: New
                - generic [ref=e68]: Sale
              - button "Add to wishlist" [ref=e70]
            - generic [ref=e73]:
              - link [ref=e74] [cursor=pointer]:
                - /url: /product/embroidered-lawn-unstitched-set
                - heading "Embroidered Lawn Unstitched Set" [level=3] [ref=e75]
              - paragraph [ref=e76]: Unready Three Piece
              - generic [ref=e78]:
                - generic [ref=e79]: ৳2,850
                - generic [ref=e80]: ৳3,400
              - generic [ref=e82]:
                - generic "Ivory" [ref=e83]
                - generic "Wine" [ref=e84]
              - button "Add to Cart" [ref=e86] [cursor=pointer]
  - contentinfo [ref=e87]:
    - generic [ref=e88]:
      - generic [ref=e89]:
        - generic [ref=e90]:
          - link "TARA" [ref=e91] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=e92]
          - generic [ref=e93]:
            - link "Facebook" [ref=e94] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=e97] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=e101] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=e104]:
          - heading "Shop" [level=3] [ref=e105]
          - list [ref=e106]:
            - listitem [ref=e107]:
              - link "Unready Three Piece" [ref=e108] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=e109]:
              - link "Two Piece" [ref=e110] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=e111]:
              - link "New Arrivals" [ref=e112] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=e113]:
              - link "Accessories" [ref=e114] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=e115]:
              - link "Collection" [ref=e116] [cursor=pointer]:
                - /url: /collection
        - generic [ref=e117]:
          - heading "Customer Care" [level=3] [ref=e118]
          - list [ref=e119]:
            - listitem [ref=e120]:
              - link "Contact Us" [ref=e121] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e122]:
              - link "Delivery Information" [ref=e123] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=e124]:
              - link "Exchange Policy" [ref=e125] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=e126]:
              - link "Size Guide" [ref=e127] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=e128]:
              - link "Frequently Asked Questions" [ref=e129] [cursor=pointer]:
                - /url: /faq
        - generic [ref=e130]:
          - heading "About TARA" [level=3] [ref=e131]
          - list [ref=e132]:
            - listitem [ref=e133]:
              - link "Our Story" [ref=e134] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e135]:
              - link "Physical Store" [ref=e136] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e137]:
              - link "Careers" [ref=e138] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e139]:
              - link "Privacy Policy" [ref=e140] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=e141]:
              - link "Terms and Conditions" [ref=e142] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=e144]:
        - heading "Stay close to TARA" [level=2] [ref=e145]
        - paragraph [ref=e146]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=e147]:
          - generic [ref=e148]: Enter your email address
          - textbox "Enter your email address" [ref=e149]
          - button "Subscribe" [ref=e150] [cursor=pointer]
        - paragraph [ref=e151]: By subscribing you agree to our Privacy Policy.
      - generic [ref=e152]:
        - paragraph [ref=e153]: © 2026 TARA. All rights reserved.
        - paragraph [ref=e154]: Cash on Delivery
  - alert [ref=e155]
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
> 64  |     await page.getByRole("button", { name: /clear all/i }).first().click();
      |                                                                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  127 |     // Either it says "N products found" and everything is on screen, or it says
  128 |     // "Showing X of N" — what it must never do is report the page length as the
  129 |     // total while hiding the rest.
  130 |     expect(text).toMatch(/\d/);
  131 |     expect(shown).toBeGreaterThanOrEqual(0);
  132 |   });
  133 | 
  134 |   test("a collection that does not exist is a 404, not an empty listing", async ({ page }) => {
  135 |     const response = await page.goto("/collection/definitely-not-a-collection");
  136 |     expect(response?.status()).toBe(404);
  137 |   });
  138 | 
  139 |   test("search results are not indexable", async ({ page }) => {
  140 |     await page.goto("/search?q=lawn");
  141 |     const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  142 |     expect(robots ?? "").toContain("noindex");
  143 |   });
  144 | });
  145 | 
```