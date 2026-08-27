# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: purchase.spec.ts >> cash-on-delivery purchase >> a guest can buy from the bag and then track the order
- Location: e2e\purchase.spec.ts:36:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /shopping bag/i })
Expected: visible
Error: strict mode violation: getByRole('heading', { name: /shopping bag/i }) resolved to 2 elements:
    1) <h1 class="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">Shopping Bag</h1> aka locator('h1')
    2) <h2 class="font-serif text-xl text-ink mb-1">Shopping Bag</h2> aka locator('h2').filter({ hasText: 'Shopping Bag' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: /shopping bag/i })

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
  1   | import {
  2   |   test,
  3   |   expect,
  4   |   chooseFirstVariant,
  5   |   openFirstProduct,
  6   |   testPhone,
  7   | } from "./fixtures";
  8   | 
  9   | /**
  10  |  * The purchase journey — the one flow that has to work.
  11  |  *
  12  |  * Storefront → product → variant → bag → checkout → contact → delivery →
  13  |  * delivery area → cash-on-delivery order → order number → tracking.
  14  |  *
  15  |  * It also asserts the two things that are easy to get wrong and expensive to
  16  |  * get wrong: the delivery charge follows the zone the customer picked, and the
  17  |  * total on the confirmation is the total the DATABASE computed, not the one the
  18  |  * browser added up.
  19  |  */
  20  | 
  21  | async function addFirstProductToBag(page: import("@playwright/test").Page) {
  22  |   await openFirstProduct(page);
  23  |   await chooseFirstVariant(page);
  24  |   await page.getByRole("button", { name: /add to (bag|cart)/i }).first().click();
  25  | }
  26  | 
  27  | async function fillCheckoutDetails(page: import("@playwright/test").Page) {
  28  |   await page.getByRole("textbox", { name: /^email address/i }).fill("playwright-receipt@example.com");
  29  |   await page.getByLabel(/phone number/i).fill(testPhone());
  30  |   await page.getByLabel(/^name/i).fill("Playwright Test");
  31  |   await page.getByLabel(/^address/i).fill("House 12, Road 3, Test Area");
  32  |   await page.getByLabel(/^city/i).fill("Sylhet");
  33  | }
  34  | 
  35  | test.describe("cash-on-delivery purchase", () => {
  36  |   test("a guest can buy from the bag and then track the order", async ({ page }) => {
  37  |     await addFirstProductToBag(page);
  38  | 
  39  |     await page.goto("/bag");
> 40  |     await expect(page.getByRole("heading", { name: /shopping bag/i })).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  41  |     // If this is empty the add above silently failed and everything after it
  42  |     // would be testing nothing.
  43  |     await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  44  | 
  45  |     await page.getByRole("link", { name: /proceed to checkout/i }).click();
  46  |     await page.waitForURL("**/checkout");
  47  | 
  48  |     // The four sections the checkout is organised into.
  49  |     for (const heading of [/^contact$/i, /^delivery$/i, /delivery method/i, /payment method/i]) {
  50  |       await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  51  |     }
  52  | 
  53  |     await fillCheckoutDetails(page);
  54  |     await page.getByRole("radio", { name: /inside/i }).check();
  55  |     await page.getByRole("checkbox", { name: /terms/i }).check();
  56  |     await page.getByRole("button", { name: /place order/i }).click();
  57  | 
  58  |     await expect(page.getByText(/order has been placed/i)).toBeVisible({ timeout: 30_000 });
  59  |     await expect(page.getByRole("button", { name: /download receipt/i })).toBeVisible();
  60  | 
  61  |     const orderNumber = (await page.getByTestId("order-number").textContent())?.trim() ?? "";
  62  |     expect(orderNumber, "the confirmation must show an order number").toBeTruthy();
  63  | 
  64  |     const trackingToken = (await page.getByTestId("tracking-token").textContent())?.trim() ?? "";
  65  |     expect(trackingToken, "the confirmation must show a tracking token").toBeTruthy();
  66  | 
  67  |     await page.goto("/track-order");
  68  |     await page.getByPlaceholder(/order number/i).fill(orderNumber);
  69  |     await page.getByPlaceholder(/tracking token/i).fill(trackingToken);
  70  |     await page.getByRole("button", { name: /^track$/i }).click();
  71  |     await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 20_000 });
  72  |   });
  73  | 
  74  |   test("an order cannot be tracked with the order number alone", async ({ page }) => {
  75  |     await page.goto("/track-order");
  76  |     await page.getByPlaceholder(/order number/i).fill("TARA-1000");
  77  |     await page.getByPlaceholder(/tracking token/i).fill("0".repeat(48));
  78  |     await page.getByRole("button", { name: /^track$/i }).click();
  79  |     await expect(page.getByText(/no order matched/i)).toBeVisible({ timeout: 20_000 });
  80  |   });
  81  | });
  82  | 
  83  | test.describe("the checkout asks only what it needs", () => {
  84  |   test.beforeEach(async ({ page }) => {
  85  |     await addFirstProductToBag(page);
  86  |     await page.goto("/checkout");
  87  |   });
  88  | 
  89  |   test("contact requires phone and email, and nothing else", async ({ page }) => {
  90  |     await expect(page.getByLabel(/phone number/i)).toBeVisible();
  91  |     const email = page.getByRole("textbox", { name: /^email address/i });
  92  |     await expect(email).toBeVisible();
  93  |     await expect(email).toHaveAttribute("required", "");
  94  |   });
  95  | 
  96  |   test("the removed location fields are gone", async ({ page }) => {
  97  |     for (const label of [/division/i, /district/i, /upazila/i, /country|region/i, /^area$/i]) {
  98  |       await expect(page.getByLabel(label)).toHaveCount(0);
  99  |     }
  100 |     // And there is one Name field, not a first/last split.
  101 |     await expect(page.getByLabel(/first name/i)).toHaveCount(0);
  102 |     await expect(page.getByLabel(/last name/i)).toHaveCount(0);
  103 |   });
  104 | 
  105 |   test("delivery collects name, address, apartment, city and postal code", async ({ page }) => {
  106 |     await expect(page.getByLabel(/^name/i)).toBeVisible();
  107 |     await expect(page.getByLabel(/^address/i)).toBeVisible();
  108 |     await expect(page.getByLabel(/apartment/i)).toBeVisible();
  109 |     await expect(page.getByLabel(/^city/i)).toBeVisible();
  110 |     await expect(page.getByLabel(/postal code/i)).toBeVisible();
  111 |   });
  112 | 
  113 |   test("cash on delivery is the only payment method, with its terms", async ({ page }) => {
  114 |     await expect(page.getByText(/cash on delivery/i).first()).toBeVisible();
  115 |     await expect(page.getByText(/confirmed by our team via phone within 24 hours/i)).toBeVisible();
  116 |     await expect(page.getByText(/payment is due in full upon delivery/i)).toBeVisible();
  117 |   });
  118 | });
  119 | 
  120 | test.describe("delivery pricing follows the chosen area", () => {
  121 |   test("switching area changes the delivery charge on the summary", async ({ page }) => {
  122 |     await addFirstProductToBag(page);
  123 |     await page.goto("/checkout");
  124 | 
  125 |     const inside = page.getByRole("radio", { name: /inside/i });
  126 |     const outside = page.getByRole("radio", { name: /outside/i });
  127 |     await expect(inside).toBeVisible();
  128 |     await expect(outside).toBeVisible();
  129 | 
  130 |     await inside.check();
  131 |     const insideDelivery = await page.getByText(/^delivery$/i).locator("..").innerText();
  132 | 
  133 |     await outside.check();
  134 |     // Outside the eligible area always pays, whatever the subtotal — this is
  135 |     // the rule the storefront used to contradict.
  136 |     await expect(outside).toBeChecked();
  137 |     const outsideDelivery = await page.getByText(/^delivery$/i).locator("..").innerText();
  138 | 
  139 |     expect(
  140 |       insideDelivery !== outsideDelivery,
```