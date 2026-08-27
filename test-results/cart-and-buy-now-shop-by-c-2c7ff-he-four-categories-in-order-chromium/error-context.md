# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart-and-buy-now.spec.ts >> shop by category >> the homepage offers the four categories, in order
- Location: e2e\cart-and-buy-now.spec.ts:121:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText(/unstitched/i)
Expected: 0
Received: 5
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for getByText(/unstitched/i)
    23 × locator resolved to 5 elements
       - unexpected value "5"

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
        - link "About Us" [ref=e15] [cursor=pointer]:
          - /url: /about
      - link "TARA" [ref=e16] [cursor=pointer]:
        - /url: /
        - img "TARA" [ref=e17]
      - generic [ref=e18]:
        - button "Search" [ref=e19] [cursor=pointer]
        - link "Account" [ref=e23] [cursor=pointer]:
          - /url: /login
        - link "Wishlist" [ref=e27] [cursor=pointer]:
          - /url: /wishlist
        - button "Shopping Bag" [ref=e30] [cursor=pointer]
  - main [ref=e34]:
    - generic [ref=e37]:
      - generic [ref=e38]:
        - paragraph [ref=e39]: TARA
        - heading "Timeless style. Made for you." [level=1] [ref=e40]: Timeless style.Made for you.
        - paragraph [ref=e41]: Refined clothing and accessories for everyday confidence.
        - generic [ref=e42]:
          - link "Unready Three Piece" [ref=e43] [cursor=pointer]:
            - /url: /new-arrivals
          - link "Two Piece" [ref=e44] [cursor=pointer]:
            - /url: /collection
      - img "Woman wearing a beige TARA three piece with maroon embroidery and a matching dupatta" [ref=e46]
    - generic [ref=e47]:
      - generic [ref=e48]:
        - paragraph [ref=e49]: Categories
        - heading "Shop by Category" [level=2] [ref=e50]
      - generic [ref=e51]:
        - link [ref=e52] [cursor=pointer]:
          - /url: /unstitched-three-piece
          - img "Unready Three Piece" [ref=e53]
          - generic [ref=e55]:
            - heading "Unready Three Piece" [level=3] [ref=e56]
            - generic [ref=e57]: Explore
        - link [ref=e60] [cursor=pointer]:
          - /url: /ready-three-piece
          - img "Two Piece" [ref=e61]
          - generic [ref=e63]:
            - heading "Two Piece" [level=3] [ref=e64]
            - generic [ref=e65]: Explore
        - link [ref=e68] [cursor=pointer]:
          - /url: /hijab
          - img "Hijab" [ref=e69]
          - generic [ref=e71]:
            - heading "Hijab" [level=3] [ref=e72]
            - generic [ref=e73]: Explore
        - link [ref=e76] [cursor=pointer]:
          - /url: /accessories
          - img "Accessories" [ref=e77]
          - generic [ref=e79]:
            - heading "Accessories" [level=3] [ref=e80]
            - generic [ref=e81]: Explore
    - generic [ref=e84]:
      - generic [ref=e85]:
        - paragraph [ref=e86]: New Arrivals
        - heading "Just In" [level=2] [ref=e87]
        - link "Shop All" [ref=e89] [cursor=pointer]:
          - /url: /new-arrivals
      - generic [ref=e90]:
        - generic [ref=e91]:
          - link "EID black HIjab New Sale Add to wishlist Quick View" [ref=e92] [cursor=pointer]:
            - /url: /product/eid-black-hijab
            - img "EID black HIjab" [ref=e93]
            - generic [ref=e94]:
              - generic [ref=e95]: New
              - generic [ref=e96]: Sale
            - button "Add to wishlist" [ref=e98]
            - button "Quick View" [ref=e101]
          - generic [ref=e105]:
            - link [ref=e106] [cursor=pointer]:
              - /url: /product/eid-black-hijab
              - heading "EID black HIjab" [level=3] [ref=e107]
            - paragraph [ref=e108]: Hijab
            - generic [ref=e110]:
              - generic [ref=e111]: ৳220
              - generic [ref=e112]: ৳320
            - button "Add to Cart" [ref=e114] [cursor=pointer]
        - generic [ref=e115]:
          - link "Embroidered Lawn Kurta Set New Add to wishlist Quick View" [ref=e116] [cursor=pointer]:
            - /url: /product/embroidered-lawn-kurta-set
            - img "Embroidered Lawn Kurta Set" [ref=e117]
            - generic [ref=e118]: New
            - button "Add to wishlist" [ref=e121]
            - button "Quick View" [ref=e124]
          - generic [ref=e128]:
            - link [ref=e129] [cursor=pointer]:
              - /url: /product/embroidered-lawn-kurta-set
              - heading "Embroidered Lawn Kurta Set" [level=3] [ref=e130]
            - paragraph [ref=e131]: Two Piece
            - generic [ref=e132]: ৳2,850
            - paragraph [ref=e136]: L · M · S · XL
            - button "Add to Cart" [ref=e138] [cursor=pointer]
        - generic [ref=e139]:
          - link "Pastel Pink Co-ord Set New Add to wishlist Quick View" [ref=e140] [cursor=pointer]:
            - /url: /product/pastel-pink-co-ord-set
            - img "Pastel Pink Co-ord Set" [ref=e141]
            - generic [ref=e142]: New
            - button "Add to wishlist" [ref=e145]
            - button "Quick View" [ref=e148]
          - generic [ref=e152]:
            - link [ref=e153] [cursor=pointer]:
              - /url: /product/pastel-pink-co-ord-set
              - heading "Pastel Pink Co-ord Set" [level=3] [ref=e154]
            - paragraph [ref=e155]: Two Piece
            - generic [ref=e156]: ৳2,450
            - generic [ref=e159]:
              - generic [ref=e160]:
                - generic "Ivory" [ref=e161]
                - generic "Pastel Pink" [ref=e162]
              - paragraph [ref=e163]: L · M · S
            - button "Add to Cart" [ref=e165] [cursor=pointer]
        - generic [ref=e166]:
          - link "Minimal Shoulder Bag New Add to wishlist Quick View" [ref=e167] [cursor=pointer]:
            - /url: /product/minimal-shoulder-bag
            - img "Minimal Shoulder Bag" [ref=e168]
            - generic [ref=e169]: New
            - button "Add to wishlist" [ref=e172]
            - button "Quick View" [ref=e175]
          - generic [ref=e179]:
            - link [ref=e180] [cursor=pointer]:
              - /url: /product/minimal-shoulder-bag
              - heading "Minimal Shoulder Bag" [level=3] [ref=e181]
            - paragraph [ref=e182]: Accessories
            - generic [ref=e183]: ৳1,650
            - generic [ref=e187]:
              - generic "Beige" [ref=e188]
              - generic "Black" [ref=e189]
            - button "Add to Cart" [ref=e191] [cursor=pointer]
        - generic [ref=e192]:
          - link "Floral Cotton Unstitched Set New Add to wishlist Quick View" [ref=e193] [cursor=pointer]:
            - /url: /product/floral-cotton-unstitched-set
            - img "Floral Cotton Unstitched Set" [ref=e194]
            - generic [ref=e195]: New
            - button "Add to wishlist" [ref=e198]
            - button "Quick View" [ref=e201]
          - generic [ref=e205]:
            - link [ref=e206] [cursor=pointer]:
              - /url: /product/floral-cotton-unstitched-set
              - heading "Floral Cotton Unstitched Set" [level=3] [ref=e207]
            - paragraph [ref=e208]: Unready Three Piece
            - generic [ref=e209]: ৳2,450
            - generic [ref=e213]:
              - generic "Beige" [ref=e214]
              - generic "Pastel Pink" [ref=e215]
            - button "Add to Cart" [ref=e217] [cursor=pointer]
        - generic [ref=e218]:
          - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist Quick View" [ref=e219] [cursor=pointer]:
            - /url: /product/embroidered-lawn-unstitched-set
            - img "Embroidered Lawn Unstitched Set" [ref=e220]
            - generic [ref=e221]:
              - generic [ref=e222]: New
              - generic [ref=e223]: Sale
            - button "Add to wishlist" [ref=e225]
            - button "Quick View" [ref=e228]
          - generic [ref=e232]:
            - link [ref=e233] [cursor=pointer]:
              - /url: /product/embroidered-lawn-unstitched-set
              - heading "Embroidered Lawn Unstitched Set" [level=3] [ref=e234]
            - paragraph [ref=e235]: Unready Three Piece
            - generic [ref=e237]:
              - generic [ref=e238]: ৳2,850
              - generic [ref=e239]: ৳3,400
            - generic [ref=e241]:
              - generic "Ivory" [ref=e242]
              - generic "Wine" [ref=e243]
            - button "Add to Cart" [ref=e245] [cursor=pointer]
        - generic [ref=e246]:
          - link "Pearl Drop Earrings New Add to wishlist Quick View" [ref=e247] [cursor=pointer]:
            - /url: /product/pearl-drop-earrings
            - img "Pearl Drop Earrings" [ref=e248]
            - generic [ref=e249]: New
            - button "Add to wishlist" [ref=e252]
            - button "Quick View" [ref=e255]
          - generic [ref=e259]:
            - link [ref=e260] [cursor=pointer]:
              - /url: /product/pearl-drop-earrings
              - heading "Pearl Drop Earrings" [level=3] [ref=e261]
            - paragraph [ref=e262]: Accessories
            - generic [ref=e263]: ৳850
            - button "Add to Cart" [ref=e267] [cursor=pointer]
    - generic [ref=e270]:
      - img "Everyday Elegance" [ref=e272]
      - generic [ref=e273]:
        - paragraph [ref=e274]: Collections
        - heading "Everyday Elegance" [level=2] [ref=e275]
        - paragraph [ref=e276]: Thoughtfully selected pieces for work, family, and everyday moments.
        - link "Shop Collection" [ref=e277] [cursor=pointer]:
          - /url: /collection
    - generic [ref=e278]:
      - generic [ref=e279]:
        - paragraph [ref=e280]: Shop by Style
        - heading "Find Your Look" [level=2] [ref=e281]
      - generic [ref=e282]:
        - link "Everyday Wear Everyday Wear" [ref=e283] [cursor=pointer]:
          - /url: /collection?style=everyday
          - img "Everyday Wear" [ref=e284]
          - generic [ref=e286]: Everyday Wear
        - link "Office Wear Office Wear" [ref=e287] [cursor=pointer]:
          - /url: /collection?style=office
          - img "Office Wear" [ref=e288]
          - generic [ref=e290]: Office Wear
        - link "Festive Wear Festive Wear" [ref=e291] [cursor=pointer]:
          - /url: /collection?style=festive
          - img "Festive Wear" [ref=e292]
          - generic [ref=e294]: Festive Wear
        - link "Comfortable Cotton Comfortable Cotton" [ref=e295] [cursor=pointer]:
          - /url: /collection?style=cotton
          - img "Comfortable Cotton" [ref=e296]
          - generic [ref=e298]: Comfortable Cotton
        - link "New Season Colours New Season Colours" [ref=e299] [cursor=pointer]:
          - /url: /collection?style=new-season
          - img "New Season Colours" [ref=e300]
          - generic [ref=e302]: New Season Colours
    - generic [ref=e304]:
      - generic [ref=e305]:
        - paragraph [ref=e306]: Customer Favourites
        - heading "Best Sellers" [level=2] [ref=e307]
      - generic [ref=e308]:
        - button "Scroll left" [disabled] [ref=e309]
        - generic [ref=e312]:
          - generic [ref=e314]:
            - link "Embroidered Lawn Kurta Set New Add to wishlist Quick View" [ref=e315] [cursor=pointer]:
              - /url: /product/embroidered-lawn-kurta-set
              - img "Embroidered Lawn Kurta Set" [ref=e316]
              - generic [ref=e317]: New
              - button "Add to wishlist" [ref=e320]
              - button "Quick View" [ref=e323]
            - generic [ref=e327]:
              - link [ref=e328] [cursor=pointer]:
                - /url: /product/embroidered-lawn-kurta-set
                - heading "Embroidered Lawn Kurta Set" [level=3] [ref=e329]
              - paragraph [ref=e330]: Two Piece
              - generic [ref=e331]: ৳2,850
              - paragraph [ref=e335]: L · M · S · XL
              - button "Add to Cart" [ref=e337] [cursor=pointer]
          - generic [ref=e339]:
            - link [ref=e340] [cursor=pointer]:
              - /url: /product/wine-georgette-ready-set
              - img "Wine Georgette Ready Set" [ref=e341]
              - button "Add to wishlist" [ref=e343]
              - button "Quick View" [ref=e346]
            - generic [ref=e350]:
              - link [ref=e351] [cursor=pointer]:
                - /url: /product/wine-georgette-ready-set
                - heading "Wine Georgette Ready Set" [level=3] [ref=e352]
              - paragraph [ref=e353]: Two Piece
              - generic [ref=e354]: ৳4,600
              - paragraph [ref=e358]: L · M · S
              - button "Add to Cart" [ref=e360] [cursor=pointer]
          - generic [ref=e362]:
            - link "Black Embellished Kurta Sale Add to wishlist Quick View" [ref=e363] [cursor=pointer]:
              - /url: /product/black-embellished-kurta
              - img "Black Embellished Kurta" [ref=e364]
              - generic [ref=e365]: Sale
              - button "Add to wishlist" [ref=e368]
              - button "Quick View" [ref=e371]
            - generic [ref=e375]:
              - link [ref=e376] [cursor=pointer]:
                - /url: /product/black-embellished-kurta
                - heading "Black Embellished Kurta" [level=3] [ref=e377]
              - paragraph [ref=e378]: Two Piece
              - generic [ref=e380]:
                - generic [ref=e381]: ৳2,750
                - generic [ref=e382]: ৳3,200
              - paragraph [ref=e384]: L · M · S · XL
              - button "Add to Cart" [ref=e386] [cursor=pointer]
          - generic [ref=e388]:
            - link "Structured Tote Bag Sale Add to wishlist Quick View" [ref=e389] [cursor=pointer]:
              - /url: /product/structured-tote-bag
              - img "Structured Tote Bag" [ref=e390]
              - generic [ref=e391]: Sale
              - button "Add to wishlist" [ref=e394]
              - button "Quick View" [ref=e397]
            - generic [ref=e401]:
              - link [ref=e402] [cursor=pointer]:
                - /url: /product/structured-tote-bag
                - heading "Structured Tote Bag" [level=3] [ref=e403]
              - paragraph [ref=e404]: Accessories
              - generic [ref=e406]:
                - generic [ref=e407]: ৳1,950
                - generic [ref=e408]: ৳2,300
              - button "Add to Cart" [ref=e410] [cursor=pointer]
          - generic [ref=e412]:
            - link "Minimal Shoulder Bag New Add to wishlist Quick View" [ref=e413] [cursor=pointer]:
              - /url: /product/minimal-shoulder-bag
              - img "Minimal Shoulder Bag" [ref=e414]
              - generic [ref=e415]: New
              - button "Add to wishlist" [ref=e418]
              - button "Quick View" [ref=e421]
            - generic [ref=e425]:
              - link [ref=e426] [cursor=pointer]:
                - /url: /product/minimal-shoulder-bag
                - heading "Minimal Shoulder Bag" [level=3] [ref=e427]
              - paragraph [ref=e428]: Accessories
              - generic [ref=e429]: ৳1,650
              - generic [ref=e433]:
                - generic "Beige" [ref=e434]
                - generic "Black" [ref=e435]
              - button "Add to Cart" [ref=e437] [cursor=pointer]
          - generic [ref=e439]:
            - link "Wine Chikankari Unstitched Set Sale Add to wishlist Quick View" [ref=e440] [cursor=pointer]:
              - /url: /product/wine-chikankari-unstitched-set
              - img "Wine Chikankari Unstitched Set" [ref=e441]
              - generic [ref=e442]: Sale
              - button "Add to wishlist" [ref=e445]
              - button "Quick View" [ref=e448]
            - generic [ref=e452]:
              - link [ref=e453] [cursor=pointer]:
                - /url: /product/wine-chikankari-unstitched-set
                - heading "Wine Chikankari Unstitched Set" [level=3] [ref=e454]
              - paragraph [ref=e455]: Unready Three Piece
              - generic [ref=e457]:
                - generic [ref=e458]: ৳4,200
                - generic [ref=e459]: ৳4,900
              - button "Add to Cart" [ref=e461] [cursor=pointer]
          - generic [ref=e463]:
            - link "Embroidered Lawn Unstitched Set New Sale Add to wishlist Quick View" [ref=e464] [cursor=pointer]:
              - /url: /product/embroidered-lawn-unstitched-set
              - img "Embroidered Lawn Unstitched Set" [ref=e465]
              - generic [ref=e466]:
                - generic [ref=e467]: New
                - generic [ref=e468]: Sale
              - button "Add to wishlist" [ref=e470]
              - button "Quick View" [ref=e473]
            - generic [ref=e477]:
              - link [ref=e478] [cursor=pointer]:
                - /url: /product/embroidered-lawn-unstitched-set
                - heading "Embroidered Lawn Unstitched Set" [level=3] [ref=e479]
              - paragraph [ref=e480]: Unready Three Piece
              - generic [ref=e482]:
                - generic [ref=e483]: ৳2,850
                - generic [ref=e484]: ৳3,400
              - generic [ref=e486]:
                - generic "Ivory" [ref=e487]
                - generic "Wine" [ref=e488]
              - button "Add to Cart" [ref=e490] [cursor=pointer]
          - generic [ref=e492]:
            - link [ref=e493] [cursor=pointer]:
              - /url: /product/black-embroidered-unstitched-set
              - img "Black Embroidered Unstitched Set" [ref=e494]
              - button "Add to wishlist" [ref=e496]
              - button "Quick View" [ref=e499]
            - generic [ref=e503]:
              - link [ref=e504] [cursor=pointer]:
                - /url: /product/black-embroidered-unstitched-set
                - heading "Black Embroidered Unstitched Set" [level=3] [ref=e505]
              - paragraph [ref=e506]: Unready Three Piece
              - generic [ref=e507]: ৳3,100
              - button "Add to Cart" [ref=e511] [cursor=pointer]
        - button "Scroll right" [ref=e512] [cursor=pointer]
    - generic [ref=e517]:
      - img "Designed for your everyday story" [ref=e519]
      - generic [ref=e520]:
        - heading "Designed for your everyday story" [level=2] [ref=e521]
        - paragraph [ref=e522]: TARA brings together comfort, modern style, and thoughtful details for women across Bangladesh. Every collection is selected to help you feel confident, comfortable, and beautifully yourself.
        - link "Learn About TARA" [ref=e523] [cursor=pointer]:
          - /url: /about
    - generic [ref=e524]:
      - generic [ref=e525]:
        - heading "Follow TARA" [level=2] [ref=e526]
        - link "@tarabd.co" [ref=e527] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
      - generic [ref=e531]:
        - link [ref=e532] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 1" [ref=e533]
        - link [ref=e534] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 2" [ref=e535]
        - link [ref=e536] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 3" [ref=e537]
        - link [ref=e538] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 4" [ref=e539]
        - link [ref=e540] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 5" [ref=e541]
        - link [ref=e542] [cursor=pointer]:
          - /url: https://instagram.com/tarabd.co
          - img "@tarabd.co 6" [ref=e543]
    - generic [ref=e546]:
      - generic [ref=e553]:
        - heading "Nationwide Delivery" [level=3] [ref=e554]
        - paragraph [ref=e555]: To all 64 districts of Bangladesh
      - generic [ref=e560]:
        - heading "Cash on Delivery" [level=3] [ref=e561]
        - paragraph [ref=e562]: Pay in cash when your order arrives
      - generic [ref=e567]:
        - heading "Easy Exchange" [level=3] [ref=e568]
        - paragraph [ref=e569]: Hassle-free returns within 7 days
      - generic [ref=e574]:
        - heading "Customer Support" [level=3] [ref=e575]
        - paragraph [ref=e576]: We're here to help you 24/7
  - contentinfo [ref=e577]:
    - generic [ref=e578]:
      - generic [ref=e579]:
        - generic [ref=e580]:
          - link "TARA" [ref=e581] [cursor=pointer]:
            - /url: /
            - img "TARA" [ref=e582]
          - generic [ref=e583]:
            - link "Facebook" [ref=e584] [cursor=pointer]:
              - /url: https://facebook.com/tarabd.co
            - link "Instagram" [ref=e587] [cursor=pointer]:
              - /url: https://instagram.com/tarabd.co
            - link "TikTok" [ref=e591] [cursor=pointer]:
              - /url: https://tiktok.com/@tarabd.co
        - generic [ref=e594]:
          - heading "Shop" [level=3] [ref=e595]
          - list [ref=e596]:
            - listitem [ref=e597]:
              - link "Unready Three Piece" [ref=e598] [cursor=pointer]:
                - /url: /unstitched-three-piece
            - listitem [ref=e599]:
              - link "Two Piece" [ref=e600] [cursor=pointer]:
                - /url: /ready-three-piece
            - listitem [ref=e601]:
              - link "New Arrivals" [ref=e602] [cursor=pointer]:
                - /url: /new-arrivals
            - listitem [ref=e603]:
              - link "Accessories" [ref=e604] [cursor=pointer]:
                - /url: /accessories
            - listitem [ref=e605]:
              - link "Collection" [ref=e606] [cursor=pointer]:
                - /url: /collection
        - generic [ref=e607]:
          - heading "Customer Care" [level=3] [ref=e608]
          - list [ref=e609]:
            - listitem [ref=e610]:
              - link "Contact Us" [ref=e611] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e612]:
              - link "Delivery Information" [ref=e613] [cursor=pointer]:
                - /url: /delivery-information
            - listitem [ref=e614]:
              - link "Exchange Policy" [ref=e615] [cursor=pointer]:
                - /url: /exchange-policy
            - listitem [ref=e616]:
              - link "Size Guide" [ref=e617] [cursor=pointer]:
                - /url: /size-guide
            - listitem [ref=e618]:
              - link "Frequently Asked Questions" [ref=e619] [cursor=pointer]:
                - /url: /faq
        - generic [ref=e620]:
          - heading "About TARA" [level=3] [ref=e621]
          - list [ref=e622]:
            - listitem [ref=e623]:
              - link "Our Story" [ref=e624] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e625]:
              - link "Physical Store" [ref=e626] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e627]:
              - link "Careers" [ref=e628] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e629]:
              - link "Privacy Policy" [ref=e630] [cursor=pointer]:
                - /url: /privacy-policy
            - listitem [ref=e631]:
              - link "Terms and Conditions" [ref=e632] [cursor=pointer]:
                - /url: /terms-and-conditions
      - generic [ref=e634]:
        - heading "Stay close to TARA" [level=2] [ref=e635]
        - paragraph [ref=e636]: Be the first to discover new collections, offers, and styling inspiration.
        - generic [ref=e637]:
          - generic [ref=e638]: Enter your email address
          - textbox "Enter your email address" [ref=e639]
          - button "Subscribe" [ref=e640] [cursor=pointer]
        - paragraph [ref=e641]: By subscribing you agree to our Privacy Policy.
      - generic [ref=e642]:
        - paragraph [ref=e643]: © 2026 TARA. All rights reserved.
        - paragraph [ref=e644]: Cash on Delivery
  - alert [ref=e645]
```

# Test source

```ts
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
  127 |       await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  128 |     }
  129 |     // The slugs stay as they are; only the wording changed.
  130 |     await expect(page.getByText(/unready three piece/i).first()).toBeVisible();
  131 |     await expect(page.getByText(/^two piece$/i).first()).toBeVisible();
  132 |     // The old wording must be gone. The word boundary matters: "Unready Three
  133 |     // Piece" contains "ready three piece", so an unanchored match would fail
  134 |     // against the correct new label.
  135 |     await expect(page.getByText(/ready three piece/i)).toHaveCount(0);
> 136 |     await expect(page.getByText(/unstitched/i)).toHaveCount(0);
      |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
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