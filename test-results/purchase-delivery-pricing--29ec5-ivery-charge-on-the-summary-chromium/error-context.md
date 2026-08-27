# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: purchase.spec.ts >> delivery pricing follows the chosen area >> switching area changes the delivery charge on the summary
- Location: e2e\purchase.spec.ts:121:7

# Error details

```
Error: locator.innerText: Error: strict mode violation: getByText(/^delivery$/i).locator('..') resolved to 2 elements:
    1) <div class="mb-4" id="checkout-delivery">…</div> aka locator('#checkout-delivery')
    2) <div class="flex items-center justify-between text-sm">…</div> aka getByText('Delivery৳')

Call log:
  - waiting for getByText(/^delivery$/i).locator('..')

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - link "Skip to main content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=f1e3]:
    - generic [ref=f1e5]:
      - navigation "Primary" [ref=f1e7]:
        - link "Unready Three Piece" [ref=f1e8] [cursor=pointer]:
          - /url: /unstitched-three-piece
        - link "Two Piece" [ref=f1e9] [cursor=pointer]:
          - /url: /ready-three-piece
        - link "Hijab" [ref=f1e10] [cursor=pointer]:
          - /url: /hijab
        - button "Collection" [ref=f1e12] [cursor=pointer]
        - link "About Us" [ref=f1e15] [cursor=pointer]:
          - /url: /about
      - link "TARA" [ref=f1e16] [cursor=pointer]:
        - /url: /
        - img "TARA" [ref=f1e17]
      - generic [ref=f1e18]:
        - button "Search" [ref=f1e19] [cursor=pointer]
        - link "Account" [ref=f1e23] [cursor=pointer]:
          - /url: /login
        - link "Wishlist" [ref=f1e27] [cursor=pointer]:
          - /url: /wishlist
        - button "Shopping Bag" [ref=f1e30] [cursor=pointer]:
          - generic [ref=f1e34]: "1"
  - main [ref=f1e35]:
    - generic [ref=f1e36]:
      - navigation "Breadcrumb" [ref=f1e37]:
        - list [ref=f1e38]:
          - listitem [ref=f1e39]:
            - link "Home" [ref=f1e40] [cursor=pointer]:
              - /url: /
          - listitem [ref=f1e43]:
            - generic [ref=f1e44]: Checkout
      - heading "Checkout" [level=1] [ref=f1e45]
      - generic [ref=f1e46]:
        - generic [ref=f1e47]:
          - region [ref=f1e48]:
            - heading "Contact" [level=2] [ref=f1e50]
            - generic [ref=f1e51]:
              - generic [ref=f1e52]:
                - generic [ref=f1e53]: Email address *
                - textbox "Email address *" [ref=f1e55]:
                  - /placeholder: you@example.com
                - paragraph [ref=f1e56]: We send your confirmation and receipt here.
              - generic [ref=f1e57]:
                - generic [ref=f1e58]: Phone number *
                - textbox "Phone number *" [ref=f1e60]:
                  - /placeholder: 01XXXXXXXXX
                - paragraph [ref=f1e61]: We call this number to confirm your order before delivery.
          - region [ref=f1e62]:
            - heading "Delivery" [level=2] [ref=f1e64]
            - generic [ref=f1e65]:
              - generic [ref=f1e66]:
                - generic [ref=f1e67]: Name *
                - textbox "Name *" [ref=f1e69]
              - generic [ref=f1e70]:
                - generic [ref=f1e71]: Address *
                - textbox "Address *" [ref=f1e73]:
                  - /placeholder: House and road, plus any landmark
              - generic [ref=f1e74]:
                - generic [ref=f1e75]: Apartment, suite, etc. (optional)
                - textbox "Apartment, suite, etc. (optional)" [ref=f1e77]
              - generic [ref=f1e78]:
                - generic [ref=f1e79]: City *
                - textbox "City *" [ref=f1e81]
              - generic [ref=f1e82]:
                - generic [ref=f1e83]: Postal code (optional)
                - textbox "Postal code (optional)" [ref=f1e85]
          - region [ref=f1e86]:
            - heading "Delivery method" [level=2] [ref=f1e88]
            - group "Choose a delivery area" [ref=f1e89]:
              - generic [ref=f1e91]:
                - generic [ref=f1e92] [cursor=pointer]:
                  - radio "Inside Sylhet ৳90" [checked] [active] [ref=f1e93]
                  - generic [ref=f1e94]: Inside Sylhet
                  - generic [ref=f1e95]: ৳90
                - generic [ref=f1e96] [cursor=pointer]:
                  - radio "Outside Sylhet ৳150" [ref=f1e97]
                  - generic [ref=f1e98]: Outside Sylhet
                  - generic [ref=f1e99]: ৳150
          - region [ref=f1e100]:
            - heading "Payment method" [level=2] [ref=f1e102]
            - generic [ref=f1e103]:
              - paragraph [ref=f1e104]: Cash on Delivery (COD)
              - paragraph [ref=f1e105]: Pay in cash when your order is delivered to your door.
            - generic [ref=f1e106]:
              - heading "Cash on Delivery (COD) Terms and Conditions" [level=3] [ref=f1e107]
              - list [ref=f1e108]:
                - listitem [ref=f1e109]: 1. Order ConfirmationAll COD orders will be confirmed by our team via phone within 24 hours.
                - listitem [ref=f1e110]: 2. Payment at DeliveryPayment is due in full upon delivery. Please ensure you have the exact amount ready.
                - listitem [ref=f1e111]: 3. Order CancellationCOD orders can be cancelled up to 24 hours before dispatch. Contact us to cancel.
                - listitem [ref=f1e112]: 4. Contact UsFor any questions or concerns, reach out to us at +88017********.
        - generic [ref=f1e113]:
          - heading "Order Summary" [level=2] [ref=f1e114]
          - generic [ref=f1e116]:
            - generic [ref=f1e117]:
              - img "EID black HIjab" [ref=f1e118]
              - generic [ref=f1e119]: "1"
            - generic [ref=f1e120]:
              - paragraph [ref=f1e121]: EID black HIjab
              - paragraph [ref=f1e122]: M / Black
            - generic [ref=f1e123]: ৳220
          - generic [ref=f1e124]:
            - generic [ref=f1e125]: Coupon Code
            - generic [ref=f1e126]:
              - textbox "Coupon Code" [ref=f1e127]
              - button "Apply" [ref=f1e128] [cursor=pointer]
            - generic [ref=f1e129]:
              - generic [ref=f1e130]: Subtotal
              - generic [ref=f1e131]: ৳220
            - generic [ref=f1e132]:
              - generic [ref=f1e133]: Delivery
              - generic [ref=f1e134]: ৳90
            - generic [ref=f1e135]:
              - generic [ref=f1e136]: Total
              - generic [ref=f1e137]: ৳310
          - generic [ref=f1e138]:
            - checkbox "I agree to the Terms and Conditions and Privacy Policy" [ref=f1e139]
            - text: I agree to the Terms and Conditions and Privacy Policy
          - button "Place Order" [ref=f1e140] [cursor=pointer]
  - contentinfo [ref=f1e141]:
    - generic [ref=f1e142]:
      - generic [ref=f1e143]:
        - generic [ref=f1e144]:
          - link "TARA" [ref=f1e145] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=f1e146]
          - generic [ref=f1e147]:
            - link "Facebook" [ref=f1e148] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=f1e151] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=f1e155] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=f1e158]:
          - heading "Shop" [level=3] [ref=f1e159]
          - list [ref=f1e160]:
            - listitem [ref=f1e161]:
              - link "Unready Three Piece" [ref=f1e162] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=f1e163]:
              - link "Two Piece" [ref=f1e164] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=f1e165]:
              - link "New Arrivals" [ref=f1e166] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=f1e167]:
              - link "Accessories" [ref=f1e168] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=f1e169]:
              - link "Collection" [ref=f1e170] [cursor=pointer]:
                - /url: /collection
        - generic [ref=f1e171]:
          - heading "Customer Care" [level=3] [ref=f1e172]
          - list [ref=f1e173]:
            - listitem [ref=f1e174]:
              - link "Contact Us" [ref=f1e175] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e176]:
              - link "Delivery Information" [ref=f1e177] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=f1e178]:
              - link "Exchange Policy" [ref=f1e179] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=f1e180]:
              - link "Size Guide" [ref=f1e181] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=f1e182]:
              - link "Frequently Asked Questions" [ref=f1e183] [cursor=pointer]:
                - /url: /faq
        - generic [ref=f1e184]:
          - heading "About TARA" [level=3] [ref=f1e185]
          - list [ref=f1e186]:
            - listitem [ref=f1e187]:
              - link "Our Story" [ref=f1e188] [cursor=pointer]:
                - /url: /about
            - listitem [ref=f1e189]:
              - link "Physical Store" [ref=f1e190] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e191]:
              - link "Careers" [ref=f1e192] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e193]:
              - link "Privacy Policy" [ref=f1e194] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=f1e195]:
              - link "Terms and Conditions" [ref=f1e196] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=f1e198]:
        - heading "Stay close to TARA" [level=2] [ref=f1e199]
        - paragraph [ref=f1e200]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=f1e201]:
          - generic [ref=f1e202]: Enter your email address
          - textbox "Enter your email address" [ref=f1e203]
          - button "Subscribe" [ref=f1e204] [cursor=pointer]
        - paragraph [ref=f1e205]: By subscribing you agree to our Privacy Policy.
      - generic [ref=f1e206]:
        - paragraph [ref=f1e207]: © 2026 TARA. All rights reserved.
        - paragraph [ref=f1e208]: Cash on Delivery
  - alert [ref=f1e209]
```

# Test source

```ts
  31  |   await page.getByLabel(/^address/i).fill("House 12, Road 3, Test Area");
  32  |   await page.getByLabel(/^city/i).fill("Sylhet");
  33  | }
  34  | 
  35  | test.describe("cash-on-delivery purchase", () => {
  36  |   test("a guest can buy from the bag and then track the order", async ({ page }) => {
  37  |     await addFirstProductToBag(page);
  38  | 
  39  |     await page.goto("/bag");
  40  |     await expect(page.getByRole("heading", { name: /shopping bag/i })).toBeVisible();
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
> 131 |     const insideDelivery = await page.getByText(/^delivery$/i).locator("..").innerText();
      |                                                                              ^ Error: locator.innerText: Error: strict mode violation: getByText(/^delivery$/i).locator('..') resolved to 2 elements:
  132 | 
  133 |     await outside.check();
  134 |     // Outside the eligible area always pays, whatever the subtotal — this is
  135 |     // the rule the storefront used to contradict.
  136 |     await expect(outside).toBeChecked();
  137 |     const outsideDelivery = await page.getByText(/^delivery$/i).locator("..").innerText();
  138 | 
  139 |     expect(
  140 |       insideDelivery !== outsideDelivery,
  141 |       "the delivery line must react to the chosen area",
  142 |     ).toBeTruthy();
  143 |   });
  144 | });
  145 | 
```