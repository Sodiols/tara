# How TARA is put together

The rules this codebase follows, and the reasoning behind each. Written for
whoever changes it next.

---

## The database is the authority

Not "the database also checks". The application checks so it can give a good
error message; the database checks because it is the only layer an attacker
cannot skip.

Concretely:

- Every sensitive mutation is a `SECURITY DEFINER` function that begins with
  `require_permission(...)`. The server action calls `requirePermission()` too,
  and that call exists to produce a redirect rather than a 500 — it is not the
  authorisation decision.
- Every table has row level security. The application connects with the
  publishable (anon) key and a user session, so it is subject to the same
  policies a browser is. **The service-role key is not used anywhere**, which is
  what lets `npm run test:integration` prove the policies hold: a test that
  bypassed RLS could not.
- `place_order()` takes no prices. Its signature has nowhere to put one.

## One source of truth per fact

Every duplicated fact eventually becomes two contradicting facts. The ones that
had already diverged here:

| Fact | Lives in | Mirrored in |
| --- | --- | --- |
| Bangladesh geography | `data/bangladesh-geography.ts` | `bd_divisions` / `bd_districts` (migration 0009) |
| The delivery rule | `lib/delivery.ts` | `calculate_delivery_fee()` (migration 0009) |
| Role → permission | `role_permissions()` (migration 0002) | `lib/permissions.ts`, asserted by a test |
| Filter URL encoding | `lib/catalogue-filters.ts` | used by both the server page and the browser sidebar |
| Store contact details | `store_settings` | `getPublicStoreSettings()`, cached per render |

Where a fact is mirrored, the database copy wins and there is a test asserting
the two agree.

The delivery rule is the clearest example of what this prevents. The
announcement bar promised free delivery *in Sylhet*; the code waived the fee
*everywhere*. Both had been true of some earlier version of the business rule,
and nothing connected them. Now the announcement text is generated from the
same settings the fee is computed from, so the promise cannot drift from the
charge.

## Filtering happens before pagination

`search_catalogue()` applies every filter — including the variant-level ones for
size, colour and stock — inside the query, then sorts, then paginates, and
returns the count of the whole filtered set.

The listing used to fetch the first 24 active products and *then* discard the
ones with no XL variant. On a fourteen-product test catalogue that looks
identical. On eight hundred products, a shopper filtering on XL sees "the XL
products that happened to be in the first 24 rows" — most of the XL stock is
simply unreachable — and the header still says "24 products found" above three
cards.

Two supporting rules:

- **Every sort ends in `p.id`.** Ordering by `base_price` alone leaves ties in
  whatever order the planner returns, which can differ between two requests, so
  page 2 can repeat a product from page 1 and skip another.
- **The URL is the whole filter state.** There is no second copy in a React
  hook. That is what makes a filtered listing shareable, reload-safe and correct
  under the back button.

## Server components by default

`"use client"` is for state, effects and browser APIs. Everything else renders
on the server, so it costs nothing in the bundle. The pattern for a client
component that needs server data is props, not a second fetch: the root layout
reads the store settings once per render pass (`cache()`), and the header,
footer, announcement bar and bag drawer all receive them.

## Errors

- A customer sees a sentence they can act on. Never a Postgres message, never
  SQL, never a stack trace.
- The technical detail goes to `logFailure()`, which writes one structured JSON
  line **and** reports to error monitoring, so a failure cannot be visible in
  one place and invisible in the other.
- Passwords, keys, tokens, cookies, addresses, phone numbers and email
  addresses are scrubbed on the way out of the process — in both destinations,
  by their own scrubbers.
- Nothing important is swallowed. A caught error is either handled or reported.

The one deliberate exception is transactional email. `place_order()` has already
committed by the time an email is attempted: the stock is deducted, the coupon
is spent, the customer has an order number. A provider outage must not turn a
successful order into a failed one, so the dispatch path swallows its own
failures, records them on the outbox row, and returns. The failure is visible in
/admin/settings and in the logs.

## Atomicity

Anything that would leave a broken intermediate state if it failed halfway is
one database function, not two statements from the application:

| Operation | Function | What the two-statement version broke |
| --- | --- | --- |
| Change the main product image | `set_product_primary_image()` | A failure between "clear old" and "set new" left the product with no primary image |
| Reorder images | `reorder_product_images()` | One `UPDATE` per image; a partial failure left two images at the same position |
| Delete an image | `delete_product_image()` | The promotion of the next image could be lost |
| Save the cart | `replace_cart_items()` | Delete-then-insert; a failed insert emptied a signed-in customer's cart |
| Merge a guest cart | `merge_cart_items()` | Also one query per line to resolve each variant |

## Rate limiting, in two layers

`guardPublicAction()` is an in-process fixed window: cheap, and it rejects the
obvious floods before they cost a database round trip. On a serverless
deployment that is close to advisory — every cold start begins with an empty
map, and ten instances mean ten independent allowances.

`consumeDurableLimit()` is the authority: one shared counter in Postgres.
Its allowance is **not** a parameter — `consume_public_rate_limit()` looks the
numbers up from a fixed list keyed on the bucket name, because a limit the
caller chooses is a limit an attacker chooses. `consume_rate_limit()` itself is
never granted to a client.

It fails open. Refusing every request because the limiter is unreachable would
turn a database blip into an outage; the in-process window still applies.

## Content Security Policy

Built per request in `lib/supabase/proxy.ts` so it can carry a nonce. A static
nonce is exactly as useful to an attacker as `'unsafe-inline'`, which is what
this used to allow.

```
script-src 'self' 'nonce-<random>' 'strict-dynamic' https:
```

`'strict-dynamic'` lets a nonced script load the chunks it needs without every
chunk URL being listed, which is what makes a nonce workable with a bundler that
code-splits. Browsers that do not understand it fall back to `'self'`.

**`style-src` still has `'unsafe-inline'`, and that is deliberate.** Next.js and
Tailwind both emit inline `style` attributes during hydration; there is no nonce
mechanism for the `style` *attribute*, and CSP cannot express "attributes but
not elements". The exposure is materially lower than for script — an injected
style cannot execute — and removing it breaks rendering. It is the one
concession in the policy and it is documented rather than quietly present.

`img-src` allows the Supabase storage origin and `images.unsplash.com` (the
editorial photography on the homepage and about page). `connect-src` allows the
Supabase REST and realtime origins. Everything else is `'self'` or `'none'`.

## Structured data

Every JSON-LD block goes through `jsonLd()`, which escapes `<`, `>`, `&` and the
two line separators. `JSON.stringify` does not escape `<` — it is legal in a
JSON string — but the HTML tokeniser ends a `<script>` at the first `</script`
regardless of the JSON around it. A product name containing `</script>` would
close the block early and let the rest be parsed as markup, and product names
are editable from /admin/products.

## Images

Uploads are validated by their **bytes**, not by `file.type`, which is whatever
the client said. `lib/image-validation.ts` checks the format signature, matches
it against the declared type, and rejects implausible dimensions. SVG stays
refused: it is a document format that can carry `<script>`, and the bucket is
public.

Delivery is `next/image` — re-encoded to AVIF or WebP at the size the layout
asks for, EXIF not carried through, cached for a year because the URL contains
the source, width and quality. That is why there is no `sharp` in the
dependencies: the one thing server-side processing would add over this is
stripping metadata from the *stored original*, which is not served to anyone.

## Adding a feature

1. **Where does the truth live?** If the answer is "the database", write the
   function first and the UI second.
2. **What can the client lie about?** Assume it will. Validate with Zod at the
   boundary for a good error, and re-check in SQL for the actual guarantee.
3. **Does it duplicate a fact?** If so, find the existing one and share it.
4. **Can it fail halfway?** Then it is one transaction, not two statements.
5. **Would a test have caught the bug you are fixing?** Write that one.
