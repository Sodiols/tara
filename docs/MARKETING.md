# Marketing analytics

How TARA knows where its customers come from, what they do, and which of it is
worth doing again. Written for whoever runs the shop, and for whoever changes
the code next.

---

## What exists

| Piece | Where |
| --- | --- |
| The tracker in the browser | `lib/analytics/client.ts` |
| The one endpoint it posts to | `app/api/analytics/collect/route.ts` |
| The tables and the rules | `supabase/migrations/0026_launch_offer_and_first_party_analytics.sql` |
| The dashboard | `/admin/marketing` |
| The tracked-link builder | the bottom of the same page |
| GA4, Meta and TikTok | `components/analytics/MarketingTags.tsx`, off unless configured |

Everything on the dashboard is **first party**: TARA's own events joined to
TARA's own orders. Nothing is sampled, nothing is modelled, and no figure comes
from a third party. If it says eleven orders, eleven rows exist in `orders`.

---

## What is recorded, and what is not

Recorded: an anonymous visitor id and a session id, both random and minted by
the browser; the UTM parameters a link carried; the **host** of the referrer;
the path landed on; and the events below with the product, variant, colour,
size, quantity and price each one needs. When a customer is signed in, their
own customer id — which the shop already knows.

Not recorded, anywhere, ever: IP addresses, user agents, device or screen
fingerprints, names, email addresses, phone numbers, addresses, anything to do
with payment, or the full referring URL — which on a search engine carries what
somebody typed.

There is no fingerprinting of any kind. The visitor id identifies a browser to
this shop and to nothing else, and clearing site data ends it.

### The events

```
session_started             a visit begins (30 minutes of inactivity ends one)
page_view                   every page, including client-side navigations
product_view                a product page opened
product_image_interaction   a gallery photograph opened
product_colour_selected     a swatch chosen
product_size_selected       a size chosen
add_to_cart                 recorded only where an item is actually added
remove_from_cart            a line removed from the bag or the drawer
cart_view                   the bag page, or the drawer opened
begin_checkout              checkout reached with something in the bag
checkout_step               the order submitted, and whether it failed
purchase                    the order exists — see below
search                      a search submitted
category_view               a listing opened
```

`add_to_cart` is recorded inside `useAddToCart()`, which is the only way
anything is ever added to a bag — the product page, the product card and Quick
View all go through it. An add that did not happen therefore cannot be
reported: the card's "not enough information to add this" path opens Quick View
and never reaches the hook.

---

## Attribution

**Last non-direct session, carried forward per visitor.** One model, used by
every number on the dashboard.

- A session that arrived with campaign information is attributed to it.
- A session that arrived with none — a typed address, a bookmark, an app with
  no referrer — inherits the campaign of that visitor's most recent **earlier**
  non-direct session.
- A visitor who has never arrived from a campaign is `direct`.

It is expressed once, in the `attributed` CTE of `admin_marketing_analytics()`.
Nothing in TypeScript re-attributes anything.

**First touch is preserved and never overwritten.** `analytics_visitors` keeps
the campaign that first found each visitor, so a first-touch report can be
built later from the same rows without re-instrumenting anything.

### How a campaign survives the journey

The parameters are read **once**, on the page the visitor landed on, and kept in
`sessionStorage` for the rest of the visit. Three pages later the address bar
has no parameters left; re-reading it would call the order direct. This is what
makes an Instagram link still be an Instagram link at the checkout.

A later page in the same visit that **does** carry campaign parameters — the
same person clicking a second advertisement — replaces the session's campaign,
because the most recent one is what brought them back.

### How an order is attributed

The confirmation screen calls `recordPurchaseAction()` with the order number and
that order's tracking token. The database looks the order up and records one
row: the visitor, the session, and the order id. No total and no product list
crosses the wire, because a browser is not allowed to make a claim about money.

Revenue is then read from the order **every time a report runs**. An order
cancelled, returned or archived tomorrow leaves the dashboard tomorrow, and a
permanently deleted order takes its conversion with it (`on delete cascade`).

The conversion cannot be counted twice. A unique index on
`(order_id) where event_name = 'purchase'` is the guarantee, and it holds for a
refreshed confirmation page, a back-and-forward, a shared link opened on another
device, and a retried request that had in fact already been applied.

---

## Definitions used on the dashboard

| Figure | Definition |
| --- | --- |
| Visitors | distinct visitor ids with at least one event in the window |
| Sessions | distinct sessions with at least one event in the window |
| Product views | `product_view` events (the funnel counts distinct visitors instead) |
| Add to Cart Rate | visitors who added to cart ÷ visitors |
| Checkout Rate | visitors who began checkout ÷ visitors who added to cart |
| Purchase Conversion Rate | orders ÷ visitors |
| Average order value | revenue ÷ orders |
| Orders / Revenue | purchases whose order is not cancelled, not returned and not archived, at the order's current total |

A visitor who arrives twice from two different campaigns is counted once under
each, because both genuinely brought them; the summary counts them once.

The funnel is in **visitors** at every stage, so each step is a share of the one
above it rather than a count of repeated actions.

---

## Building tracked links

Use the builder at the bottom of `/admin/marketing`. It lowercases values and
turns spaces into underscores — the same normalisation the reports group by — so
"Instagram", "instagram" and "Instagram " cannot become three sources.

The five parameters:

| Parameter | What to put in it |
| --- | --- |
| `utm_source` | where it is posted: `instagram`, `facebook`, `tiktok`, `creator`, `email` |
| `utm_medium` | `social` for an ordinary post, `paid` for an advertisement, `influencer` for a creator, `email` |
| `utm_campaign` | the campaign: `launch_week`. **For a creator link, the creator's name.** |
| `utm_content` | the individual post or reel — this is how two reels are compared |
| `utm_term` | rarely needed; paid search keywords |

### Recipes

Instagram story or bio link:

```
https://www.tarabd.co/?utm_source=instagram&utm_medium=social&utm_campaign=launch_week&utm_content=instagram_tryon_reel_01
```

Facebook post:

```
https://www.tarabd.co/two-piece?utm_source=facebook&utm_medium=social&utm_campaign=launch_week&utm_content=fb_carousel_01
```

TikTok video:

```
https://www.tarabd.co/product/silk-kameez?utm_source=tiktok&utm_medium=social&utm_campaign=launch_week&utm_content=tiktok_fit_video_01
```

A paid advertisement — same as above with `utm_medium=paid`.

A creator, either of two ways (both are read by the Creators table):

```
https://www.tarabd.co/?utm_source=creator&utm_medium=influencer&utm_campaign=nabila&utm_content=creator_nabila_tryon_01
https://www.tarabd.co/?utm_source=instagram&utm_medium=influencer&utm_content=creator_nabila_tryon_01
```

Give **every post its own `utm_content`**. It costs nothing at posting time and
it is the difference between "Instagram works" and "the try-on reels work and
the flat-lays do not".

### What not to do

- Do not put a customer's name, phone number or email in a UTM parameter. They
  end up in an address bar, in a report, and in any screenshot of either.
- Do not tag internal links. A link from TARA to TARA with a `utm_source` starts
  a new campaign attribution for somebody who was already on the site.
- Do not invent a new spelling for a source that already exists.

---

## GA4, Meta and TikTok

All three are optional and all three are off unless an id is configured
(`NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`,
`NEXT_PUBLIC_TIKTOK_PIXEL_ID`). A tag that is not configured loads no script,
sends no request, and is not named in the Content Security Policy.

They are fed from the same `track()` call that feeds TARA's own store, so no
event can be sent twice by two components both trying to be helpful, and the
first page view of a visit is counted by the tag snippet itself rather than by
both. Purchases carry the order number as each platform's own deduplication key.

TARA's own dashboard does not depend on any of them.

---

## When the numbers look wrong

**A source says `direct` that should not.** The link was posted without
parameters, or an app stripped them. Check the raw link.

**Orders on the dashboard are fewer than in /admin/orders.** Correct and
expected: an order placed by somebody whose browser blocks site data has no
visitor id, so it has no conversion row. `/admin/orders` is the authority on
orders; this page is the authority on where orders came from.

**Revenue changed retroactively.** An order was cancelled, returned or archived.
That is the design: see the definitions above.

**Nothing at all is recorded.** Check that migration 0026 has been applied — the
endpoint answers 204 either way, deliberately, and logs
`analytics.store_failed`.
