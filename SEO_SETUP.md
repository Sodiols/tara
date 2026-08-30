# SEO setup — what to do after deploying

Everything in the code is done. This is the part that needs your Google account
and your domain, and cannot be done from the repository.

Work through it in order. Steps 1–4 matter most; the rest can follow.

---

## 0. Before anything else — deploy the two migrations

The SEO work depends on two database changes. Without them the admin SEO fields
still do nothing and two category pages 404.

```bash
supabase db push
```

| Migration | Why it matters |
| --- | --- |
| `0019_catalogue_seo_fields.sql` | Makes `products.seo_title`, `seo_description` and `product_images.alt_en` reach the storefront |
| `0020_rename_category_slugs.sql` | Renames the category slugs to match the routes |

**`0020` must go out in the same release as the code.** The database slug, the
route folder and the redirect are three parts of one change — applying the
migration without deploying the code gives you two categories that show nothing.

---

## 1. Set the production environment variables

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.tarabd.co` | **Critical.** Inlined at build time, so it needs a rebuild, not just a restart. Every canonical, `og:url`, sitemap entry and structured-data `@id` is built from it. If it holds `localhost`, the whole site canonicalises to your laptop. |
| `GOOGLE_SITE_VERIFICATION` | *(optional)* | Only if you verify by HTML tag — see step 2. Leave blank to emit no tag. |

Verify after deploying:

```bash
curl -s https://www.tarabd.co/ | grep -o '<link rel="canonical" href="[^"]*"'
# expect https://www.tarabd.co — not localhost, not http, not the bare apex
```

---

## 2. Confirm the canonical host redirects

The site canonicalises to `https://www.tarabd.co`. All three other forms must
redirect there, and this is a **hosting/DNS setting, not application code** —
deliberately, because an app-level host redirect fights the platform's own.

Configure at your host (Vercel: Project → Domains, set `www.tarabd.co` as
primary and `tarabd.co` to redirect):

```
http://tarabd.co       ->  https://www.tarabd.co
https://tarabd.co      ->  https://www.tarabd.co
http://www.tarabd.co   ->  https://www.tarabd.co
```

Check each one returns 301/308 to the canonical host before continuing.

---

## 3. Google Search Console

1. Go to <https://search.google.com/search-console> and add a property.
2. **Prefer the Domain property** (`tarabd.co`) verified by DNS TXT record — it
   covers every subdomain and both protocols at once. Use the URL-prefix
   property with the HTML tag only if you cannot edit DNS; in that case set
   `GOOGLE_SITE_VERIFICATION` and redeploy.
3. Submit the sitemap under **Sitemaps**:

   ```
   https://www.tarabd.co/sitemap.xml
   ```

4. Run **URL Inspection** on, at minimum:
   - `https://www.tarabd.co/`
   - each of the five category pages
   - two or three product pages

   For each, confirm the canonical Google chose matches the one declared. Then
   **Request indexing**.
5. Check **Page Indexing** after a few days. Expect to see filtered category URLs
   under "Excluded by 'noindex'" — that is correct and intended.
6. Watch **Core Web Vitals** and **Mobile Usability** once real traffic arrives.

### Because the category URLs changed

Two paths were renamed and now 308-redirect:

```
/unstitched-three-piece  ->  /unready-three-piece
/ready-three-piece       ->  /two-piece
```

You do **not** need the Change of Address tool — that is for moving domains. Do:

- resubmit the sitemap so the new URLs are discovered
- run URL Inspection on both new paths and request indexing
- leave the redirects in place permanently; do not remove them later
- expect the old URLs to sit in "Page with redirect" for a while. Normal.

---

## 4. Test the structured data

Paste each URL into the **Rich Results Test**
(<https://search.google.com/test/rich-results>):

| Page | Expect |
| --- | --- |
| Homepage | `OnlineStore`, `WebSite` |
| Any product | `Product` with price, availability, brand, and reviews if it has approved ones |
| Any category | `BreadcrumbList` |
| `/faq` | `FAQPage` |

The product markup deliberately omits GTIN, MPN, shipping and return policy —
TARA has no barcodes and runs an exchange rather than a return policy. Warnings
about those are expected and correct; do not "fix" them by inventing values.

---

## 5. Google Business Profile

For "women's clothing Sylhet" and "TARA Sylhet" this will do more than anything
in the codebase.

Create or claim the profile at <https://business.google.com> for:

```
Batortal Bazar, Zakiganj, Sylhet, Bangladesh
```

Use **exactly** the same business name, address and phone number as
`/admin/settings`, because that is what the site publishes in its structured
data, its footer and its contact page. Inconsistency between the two is the
single most common local-SEO problem.

Add real opening hours there — they are deliberately not in the site's
structured data, because the application has no field for them and inventing
them would be worse than omitting them.

---

## 6. Google Merchant Center — not yet wired up

Product pages carry accurate merchant structured data, which is what Google
reads for free product listings. A **product feed was not built** — it needs
decisions that cannot be guessed:

- whether items are per-product or per-variant (size/colour)
- the Google Product Category for each TARA category
- whether `gender` and `age_group` should be asserted

If you want the feed, say so and it can be built as its own task. Until then,
create the Merchant Center account and verify/claim the website — the free
listings can read the on-page structured data.

---

## 7. Keep the business details consistent

The same name, address and phone must appear identically in:

- `/admin/settings` (the source the site renders from)
- Google Business Profile
- Facebook, Instagram, TikTok

Editing `/admin/settings` updates the footer, the contact page **and** the
structured data together — there is nothing else in the site to change.

---

## What the admin panel now controls

These change the live site with no deploy, once `0019` is applied:

| Where | Field | Effect |
| --- | --- | --- |
| `/admin/products` | SEO title | The page `<title>`, used as written |
| | SEO description | The meta description |
| | *(both blank)* | Falls back to product name and description |
| Product image manager | Alt text | Image `alt` on the product page and cards |
| `/admin/categories` | Name, description, SEO title/description | Category heading, the visible intro paragraph, and its metadata |
| `/admin/collections` | Same | Same, for collection pages |

Leaving them blank is fine — every fallback is sensible and tested. Fill them in
where you have something better to say than the default.
