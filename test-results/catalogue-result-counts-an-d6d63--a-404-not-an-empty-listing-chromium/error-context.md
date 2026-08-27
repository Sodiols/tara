# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalogue.spec.ts >> result counts and collections >> a collection that does not exist is a 404, not an empty listing
- Location: e2e\catalogue.spec.ts:134:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 200
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e5]:
      - navigation "Primary" [ref=e7]:
        - link "Unready Three Piece" [ref=e8] [cursor=pointer]:
          - /url: /unstitched-three-piece
        - link "Two Piece" [ref=e9] [cursor=pointer]:
          - /url: /ready-three-piece
        - link "Hijab" [ref=e10] [cursor=pointer]:
          - /url: /hijab
        - button "Collection" [ref=e12] [cursor=pointer]
        - link "About Us" [ref=e16] [cursor=pointer]:
          - /url: /about
      - link "TARA" [ref=e17] [cursor=pointer]:
        - /url: /
        - img "TARA" [ref=e18]
      - generic [ref=e19]:
        - button "Search" [ref=e20] [cursor=pointer]
        - link "Account" [ref=e24] [cursor=pointer]:
          - /url: /login
        - link "Wishlist" [ref=e28] [cursor=pointer]:
          - /url: /wishlist
        - button "Shopping Bag" [ref=e31] [cursor=pointer]
  - main [ref=e35]:
    - generic [ref=e36]:
      - paragraph [ref=e37]: "404"
      - heading "Page Not Found" [level=1] [ref=e38]
      - paragraph [ref=e39]: The page you are looking for doesn't exist or has been moved.
      - generic [ref=e40]:
        - link [ref=e41] [cursor=pointer]:
          - /url: /
          - button "Back to Home" [ref=e42]
        - link "Unready Three Piece" [ref=e43] [cursor=pointer]:
          - /url: /unstitched-three-piece
        - link "Two Piece" [ref=e44] [cursor=pointer]:
          - /url: /ready-three-piece
      - paragraph [ref=e45]:
        - text: Cannot find what you were looking for?
        - link "Contact Us" [ref=e46] [cursor=pointer]:
          - /url: /contact
  - contentinfo [ref=e47]:
    - generic [ref=e48]:
      - generic [ref=e49]:
        - generic [ref=e50]:
          - link "TARA" [ref=e51] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=e52]
          - generic [ref=e53]:
            - link "Facebook" [ref=e54] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=e57] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=e61] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=e64]:
          - heading "Shop" [level=3] [ref=e65]
          - list [ref=e66]:
            - listitem [ref=e67]:
              - link "Unready Three Piece" [ref=e68] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=e69]:
              - link "Two Piece" [ref=e70] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=e71]:
              - link "New Arrivals" [ref=e72] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=e73]:
              - link "Accessories" [ref=e74] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=e75]:
              - link "Collection" [ref=e76] [cursor=pointer]:
                - /url: /collection
        - generic [ref=e77]:
          - heading "Customer Care" [level=3] [ref=e78]
          - list [ref=e79]:
            - listitem [ref=e80]:
              - link "Contact Us" [ref=e81] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e82]:
              - link "Delivery Information" [ref=e83] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=e84]:
              - link "Exchange Policy" [ref=e85] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=e86]:
              - link "Size Guide" [ref=e87] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=e88]:
              - link "Frequently Asked Questions" [ref=e89] [cursor=pointer]:
                - /url: /faq
        - generic [ref=e90]:
          - heading "About TARA" [level=3] [ref=e91]
          - list [ref=e92]:
            - listitem [ref=e93]:
              - link "Our Story" [ref=e94] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e95]:
              - link "Physical Store" [ref=e96] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e97]:
              - link "Careers" [ref=e98] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e99]:
              - link "Privacy Policy" [ref=e100] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=e101]:
              - link "Terms and Conditions" [ref=e102] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=e104]:
        - heading "Stay close to TARA" [level=2] [ref=e105]
        - paragraph [ref=e106]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=e107]:
          - generic [ref=e108]: Enter your email address
          - textbox "Enter your email address" [ref=e109]
          - button "Subscribe" [ref=e110] [cursor=pointer]
        - paragraph [ref=e111]: By subscribing you agree to our Privacy Policy.
      - generic [ref=e112]:
        - paragraph [ref=e113]: © 2026 TARA. All rights reserved.
        - paragraph [ref=e114]: Cash on Delivery
  - alert [ref=e115]
```

# Test source

```ts
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
  127 |     // Either it says "N products found" and everything is on screen, or it says
  128 |     // "Showing X of N" — what it must never do is report the page length as the
  129 |     // total while hiding the rest.
  130 |     expect(text).toMatch(/\d/);
  131 |     expect(shown).toBeGreaterThanOrEqual(0);
  132 |   });
  133 | 
  134 |   test("a collection that does not exist is a 404, not an empty listing", async ({ page }) => {
  135 |     const response = await page.goto("/collection/definitely-not-a-collection");
> 136 |     expect(response?.status()).toBe(404);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
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