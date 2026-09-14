# Deploying TARA

---

## Before the first deploy

- [ ] A production Supabase project exists, separate from any testing one
- [ ] `supabase db push` has applied every migration — `supabase migration list`
      shows no pending files, **including `0021_add_receipt_rate_limit.sql`**
      (check: `select public.consume_public_rate_limit('receipt', 'deploy-check');`
      returns `true` instead of raising `unknown_rate_limit_bucket`)
- [ ] The demonstration catalogue has **not** been installed
      (`select count(*) from public.products where product_code like 'TR-%';`
      should be 0)
- [ ] The first administrator exists — see [SETUP.md](SETUP.md#3-create-the-first-administrator)
- [ ] Authentication Site URL and redirect URLs are the production domain
- [ ] `npm run verify` passes on the commit being deployed
- [ ] The host builds with **Node.js 22.18.0 or newer** (see below)

## Environment variables on the host

Required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL          # https://www.tarabd.co — never localhost
```

Optional, and safe to add later:

```
RESEND_API_KEY, EMAIL_FROM         # turns transactional email on
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH     # "true" shows Continue with Google — see SETUP.md
GOOGLE_SITE_VERIFICATION           # Search Console HTML-tag token, content value only
NEXT_PUBLIC_SENTRY_DSN             # turns error monitoring on
SENTRY_ENVIRONMENT                 # server label for reports
NEXT_PUBLIC_SENTRY_ENVIRONMENT     # the same label for browser reports; set both alike
NEXT_PUBLIC_APP_VERSION
LOG_LEVEL                          # defaults to info in production
```

Every variable, what it does and where it comes from is documented in
`.env.local.example`.

`NEXT_PUBLIC_*` values are **inlined at build time**. Changing one requires a
rebuild, not just a restart. `NEXT_PUBLIC_SITE_URL` in particular ends up inside
the confirmation and password-reset links Supabase emails to customers — get it
wrong and every one of them points at the wrong host.

If `NEXT_PUBLIC_SITE_URL` is missing, malformed or a local address in a
production build, `lib/site-url.ts` substitutes `https://www.tarabd.co` for
canonical URLs, the sitemap, robots.txt, structured data **and** auth emails,
and logs `[config] NEXT_PUBLIC_SITE_URL is …` once per build worker. That is a
safety net, not a configuration: a build log containing that line means the
variable is not set correctly on the host. A deliberate non-production origin
(a staging domain) is respected, not overridden.

Do **not** set `SUPABASE_SERVICE_ROLE_KEY`. Nothing reads it, and its presence
in an environment is a standing risk with no upside.

## Node.js

**22.18.0 or newer.** `package.json` declares it in `engines` and `.nvmrc`
pins it; Vercel reads `engines.node` when choosing the runtime.

The floor comes from the test runner, not from Next.js (which needs only
20.9). `npm test` runs TypeScript directly with Node's built-in type
stripping, which is enabled by default from 22.18.0, and resolves imports with
`module.registerHooks`, available from 22.15.0. On an older Node the
application builds but `npm test` — and so `npm run verify` — fails.

## Deploying

The project is a standard Next.js 16 App Router application and deploys to
Vercel, or to any host that can run `npm ci && npm run build && npm start`.

```bash
npm ci
npm run build
npm start
```

There is no build step for the database. Migrations are applied with the
Supabase CLI, separately and deliberately — a schema change that runs itself
during a deploy is a schema change nobody reviewed.

## Order of operations for a release that includes a migration

1. Apply the migration first (`supabase db push`), because every migration here
   is written to be safe against the *previous* application version.
2. Deploy the application.
3. Walk the smoke test below.

If a migration cannot be made backward compatible, put the site into
maintenance mode from /admin/settings first, apply, deploy, then turn it off.

## After deploying

```bash
curl -s https://www.tarabd.co/api/health
# {"status":"ok","database":"ok",...}
```

`/api/health` returns **503** when the database is unreachable, which is what
lets a load balancer take a broken instance out of rotation. Point the uptime
monitor at it.

Then, by hand, in this order:

1. Homepage renders, and the announcement bar shows the current threshold
2. A category page lists products; a filter appears in the URL and survives a
   reload; Load More appends
3. A product page renders, with variant selection
4. Add to bag → checkout → a Sylhet address → place a **real** cash-on-delivery
   order for the cheapest item
5. The confirmation shows an order number and a tracking token
6. `/track-order` with both returns the order; the number alone does not
7. `/admin/orders` shows it as Pending / Unpaid
8. Move it to Confirmed, then Cancelled — stock returns exactly once
9. Sign out, sign in, and use forgot-password once to confirm the email link
   points at the production domain
10. View source on a product page and confirm the JSON-LD block is intact —
    and that a product with no approved reviews carries **no** `aggregateRating`
11. `https://www.tarabd.co/robots.txt` ends with `Host: https://www.tarabd.co`
    and a non-empty `Sitemap:` line; `/sitemap.xml` contains no `localhost`
12. Paste the homepage URL into a social-card debugger (Facebook Sharing
    Debugger, or a WhatsApp message to yourself) and confirm the 1200×630 TARA
    card from `public/og/tara-default.png` appears
13. `/collection?size=M` has `<meta name="robots" content="noindex, follow">`;
    `/collection` has none

Then cancel the test order.

## Security headers

The Content-Security-Policy is generated per request in `lib/supabase/proxy.ts`
because it carries a per-request nonce; the static headers are in
`next.config.mjs`. After deploying, check them:

```bash
curl -sI https://www.tarabd.co | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer|permissions-policy'
```

Expect `script-src` to contain a `'nonce-…'` value that **changes on every
request** and no `'unsafe-inline'`. See [ARCHITECTURE.md](ARCHITECTURE.md#content-security-policy)
for why `style-src` still has it.

## Maintenance mode

Turn it on from **/admin/settings**. The storefront is rewritten to a
maintenance page with **HTTP 503** and `Retry-After`, so crawlers treat the
closure as temporary instead of de-indexing the catalogue. The shopper keeps the
URL they asked for, so a refresh after reopening lands where they wanted.

These stay reachable, so you cannot lock yourself out:

`/admin`, `/login`, `/auth/*`, `/reset-password`, `/api/health`, `/maintenance`,
and all Next.js assets.

The setting is read at the edge with a 30-second cache, so it takes effect
within half a minute and does not put the database in the path of every page
load. A failed read is treated as "not in maintenance" — a settings timeout
must not close the shop.

## Rolling back

Roll the application back to the previous deployment. **Do not roll a migration
back** unless you have read it and know what it dropped; several of these drop
columns, and reverting the application is almost always the cheaper fix. The
migrations are written so that version N-1 of the application keeps working
against schema N.

## Monitoring

- **Errors** — set `NEXT_PUBLIC_SENTRY_DSN`. Uncaught server errors, server
  action failures, checkout failures and client exceptions all report, with
  credentials, tokens, addresses, phone numbers and email addresses scrubbed.
- **Logs** — every server log line is one JSON object with an `event`, a
  timestamp and an environment, so it can be filtered and alerted on. Search
  for `checkout.order_placed`, `checkout.place_order_failed`,
  `email.dispatched`, `admin.order_transitioned`.
- **Health** — `/api/health`.
- **Order events** — /admin/settings shows the notification outbox, so a queued
  or failed customer email is visible in the back office rather than lost.
