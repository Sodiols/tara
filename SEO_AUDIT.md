# TARA SEO audit

What the site already did well, what was silently broken, and what changed.
Specific to this codebase — there is no general SEO advice here.

---

## What already existed and was kept

The starting point was better than most. None of this was rebuilt:

- Dynamic product metadata and Product JSON-LD
- BreadcrumbList on product pages
- FAQ structured data, tied to questions actually visible on `/faq`
- Organization structured data from live `store_settings`
- A dynamic sitemap using each product's real `updated_at`, excluding drafts,
  archived products and out-of-window collections
- `robots.ts` excluding admin, account, checkout, auth, search and API
- `lib/json-ld.ts` — an escaping serialiser that makes `</script>` in a
  staff-editable field harmless. **Still the only way JSON-LD is serialised.**
- next/image with AVIF/WebP, responsive `sizes`, a one-year immutable cache
- Stable product slugs, held stable across renames

---

## The three silent failures

Each of these was a database column that staff could edit, that saved
correctly, and that had **no effect whatsoever** on the live site.

### 1. `products.seo_title` / `products.seo_description`

The product page read `product.name` and `product.description` and never looked
at the overrides. The reason is structural: the storefront never queries
`products` directly. Every catalogue read — listings, search, related products,
and the product page — goes through `search_catalogue()`, a SECURITY DEFINER
function that builds one JSON document per product, and its projection did not
include those columns. No amount of frontend work would have fixed it.

**Fixed** by migration `0019`, which adds `seoTitle` and `seoDescription` to the
projection, plus the mapper and `generateMetadata` that consume them.

### 2. `product_images.alt_en`

Same cause. The projection aggregated `image_url` only, so the alt text staff
wrote was unreachable and every image fell back to the product name — meaning a
five-photograph gallery announced the same sentence five times to a screen
reader.

**Fixed** by the same migration, which adds a `media` array (`url`, `alt`,
`isPrimary`, `sortOrder`) alongside the existing flat `images` array. `images`
is unchanged, so nothing that consumed it had to change.

### 3. `categories.*` and `collections.seo_*`

The five category routes carried hard-coded titles and descriptions in the page
files. `getPublicCollectionBySlug()` selected only name and description. Editing
either in the admin panel changed nothing a customer or crawler could see.

**Fixed** by a new `getPublicCategoryBySlug()`, an extended collection query, and
a shared `CategoryListingPage` that reads the database first and falls back to
static copy when Supabase is unconfigured or unreachable.

---

## The canonical problem

`app/layout.tsx` set `alternates.canonical` to the site root. In Next.js that is
inherited by every route which does not set its own — so `/about`,
`/size-guide`, `/exchange-policy`, `/privacy-policy`, `/terms-and-conditions`
and the homepage were all telling Google they were **duplicates of the
homepage**. Seven public routes had no canonical of their own.

Separately, **no** public route defined an `openGraph` block, so all of them
inherited the root's and advertised the homepage's URL and title when shared.

**Fixed** by removing the root canonical entirely and routing every page through
`buildMetadata()` in `lib/seo.ts`, which emits a self-canonical, a matching
`og:url`, and Open Graph and Twitter blocks describing that page. Verified in
built HTML: `/`, `/about`, `/hijab`, `/two-piece` and `/privacy-policy` each
canonicalise to themselves, with `og:url` matching.

---

## Faceted navigation

The catalogue encodes `size`, `colour`, `fabric`, `price`, `collection`,
`availability`, `sale`, `new`, `sort` and `page` in the URL. Every combination
was as indexable as the clean category page — tens of thousands of near-identical
URLs competing with the one page that should rank.

`listingMetadata()` now applies `noindex, follow` when any of those parameters is
present, while keeping the canonical pointed at the clean path. `follow` is
deliberate: page 4 of a filtered listing should not rank, but its product links
are still worth discovering.

Tracking parameters (`utm_*`, `fbclid`, `gclid`) deliberately do **not** trigger
noindex — someone arriving from an ad must land on the same indexable page as
everyone else. The canonical alone prevents duplication. Both behaviours are
covered by tests.

---

## Category slug rename

Migration `0014` renamed what customers see but deliberately left the slugs
alone, so the address bar disagreed with the page for two of five categories.
That has now been resolved in one deliberate change:

| Old | New |
| --- | --- |
| `/unstitched-three-piece` | `/unready-three-piece` |
| `/ready-three-piece` | `/two-piece` |

Shipped as three things together, because any one alone breaks the site:
migration `0020` (database), the moved route folders (`app/`), and **308
permanent redirects** in `next.config.mjs`. Verified: old paths return 308 to the
new ones and carry the query string across.

---

## Indexable vs not

| Indexable | Not indexable |
| --- | --- |
| `/` | `/search` (robots + noindex) |
| 5 category pages | any category URL with a filter/sort/page param |
| `/collection`, each visible collection | collections outside their schedule |
| every active product | missing product / collection (`noindex, nofollow`) |
| `/new-arrivals` | `/account`, `/checkout`, `/bag`, `/wishlist` |
| `/about`, `/contact`, `/faq`, `/size-guide` | `/login`, `/register`, password reset |
| `/delivery-information`, `/exchange-policy` | `/admin` (robots + header + metadata) |
| `/privacy-policy`, `/terms-and-conditions` | `/track-order`, `/unsubscribe`, `/maintenance`, `/api` |

---

## Structured data now emitted

| Where | Types |
| --- | --- |
| Every storefront page | `OnlineStore` (was `Organization`) with a split `PostalAddress`, `WebSite` with `alternateName` |
| Product pages | `Product` — `@id`, url, sku, brand, category, material, color, size, `Offer` (price, `InStock`/`OutOfStock`, `NewCondition`, seller linked by `@id`), `AggregateRating`, up to 5 approved reviews; plus `BreadcrumbList` |
| Category pages | `BreadcrumbList` |
| Collection pages | `BreadcrumbList` |
| `/faq` | `FAQPage` (unchanged — questions are visible on the page) |

**Deliberately absent**, because the data does not exist: GTIN, MPN, postal code,
coordinates, opening hours, `priceValidUntil`, `shippingDetails`, and
`hasMerchantReturnPolicy`. TARA operates an *exchange* policy, which is not the
same thing as a return policy in Google's definition; asserting one would be a
structured-data violation rather than a win.

---

## Search intent by route

| Route | Intent |
| --- | --- |
| `/` | TARA, TARA Bangladesh, women's clothing online Bangladesh |
| `/three-piece` | three piece Bangladesh |
| `/unready-three-piece` | unready / unstitched three piece Bangladesh |
| `/two-piece` | two piece Bangladesh |
| `/hijab` | hijab Bangladesh |
| `/accessories` | women's accessories Bangladesh |
| `/new-arrivals` | new women's clothing Bangladesh |
| `/about` | TARA fashion, TARA Sylhet |
| `/contact` | TARA Sylhet, women's clothing Sylhet |

Each page states its subject once, in a heading and a sentence a customer would
actually want to read. No page repeats a phrase to hit a density, and no
city-specific doorway pages were created.

---

## Still outstanding

Honest list of what this pass did **not** do.

1. **Merchant Center product feed** (§28) — not built. It needs a decision about
   variant-level vs product-level items and a Google Product Category mapping
   that cannot be invented. Product pages now carry accurate merchant structured
   data, which is what free listings read.
2. **Breadcrumbs on static content pages** (§20) — added to category, collection
   and product pages. `/about`, `/size-guide` etc. have no visible breadcrumb, so
   none was published; structured data must match what is on screen.
3. **Sitemap image entries** (§17) — not added.
4. **A dedicated performance pass** (§30) — the existing image and font setup was
   audited and left alone; no new measurements were taken.
5. **A listing-page hydration bug**, found earlier and unrelated to SEO: the
   whole client subtree on category pages fails to hydrate, so filters, sorting,
   add-to-cart and wishlist are inert there. Reproduced on a clean production
   build and on the pre-existing commit. It does not affect crawlability — the
   products and copy are all in the server HTML — but it is a serious commerce
   bug and should be fixed before pushing for traffic.

---

## Future content opportunities

Not implemented, and deliberately not auto-generated:

- A short style or fabric guide per category, written by someone who knows the
  stock, would give the category pages something to rank on beyond a product
  grid.
- Collection descriptions are the highest-leverage unwritten copy: they are
  already read by the page and the metadata, and most are blank.
- A Google Business Profile for the Zakiganj shop would do more for
  "women's clothing Sylhet" than anything in this repository.
