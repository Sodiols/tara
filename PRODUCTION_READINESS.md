# TARA — Production readiness

This document covers what changed, what you must configure, and the exact steps
to take before the site is public.

---

## 1. What was improved

### Security and database integrity

| Area | Before | Now |
| --- | --- | --- |
| Private staff notes | An admin's note was written into `order_tracking_events.note_en`, and the guest tracking RPC returned that field verbatim to anyone holding an order number and token. **Internal notes were publicly readable.** | Staff notes live in a separate `order_internal_notes` table that `anon` has no grant on. Tracking events carry an `is_customer_visible` flag and the guest RPC filters on it. Existing staff-authored events were retroactively marked private by the migration. |
| Oversell | `place_order()` iterated the raw items array. The same variant sent twice passed two independent stock checks against the same quantity, then deducted twice. | Lines are aggregated by variant before pricing, each variant row is locked with `FOR UPDATE`, and the stock check runs against the locked value. |
| Coupon caps | `usage_count` was incremented with no lock, so two concurrent checkouts could both consume the last use of a limited coupon. | The coupon row is locked before validation and the global cap is re-checked while the lock is held. A per-customer limit was added, counted by account **and** by phone number so a guest cannot reuse it. |
| Order status | A numeric ranking. Any forward jump was legal — `pending → delivered` in one step. | An explicit `order_status_transitions` table listing every legal move and the permission it requires. `admin_transition_order()` rejects anything else. |
| Roles | `is_staff()` meant "can do everything". | Five back-office roles with a permission matrix, enforced by `require_permission()` inside every sensitive RPC. The legacy `staff` role is preserved and maps to manager. |
| Stock movement | Any staff member could `update product_variants set stock_quantity = …` directly, leaving no trace. | A trigger blocks direct stock writes. All movement goes through `place_order()` or `admin_adjust_inventory()`, and every movement writes an `inventory_adjustments` row with a reason and an actor. |
| Audit trail | None. | `admin_audit_log` records order transitions, payment changes, inventory adjustments, coupon edits, review moderation, message handling, settings changes and role changes — written by the database, so no client can skip it. |
| Store settings | Every row was world-readable (`using (true)`). | Rows carry an `is_public` flag; only public rows are readable by `anon`. `admin_save_settings()` can only write keys that already exist, so the panel cannot smuggle a new key into a table anonymous visitors read. |
| Direct table writes | `authenticated` held INSERT/UPDATE/DELETE on `orders`, `coupons`, `store_settings`, `contact_messages`, `newsletter_subscribers` and `order_tracking_events`, gated only by RLS. | Those grants are revoked. Every mutation runs through a `SECURITY DEFINER` RPC that checks a permission and writes an audit record. |
| Customer addresses | Any staff member could read every customer's whole address book. | Addresses are private to their owner. The back office sees the shipping snapshot on the order itself, which is all it needs. |
| COD abuse | No protection. Anonymous visitors could place unlimited orders. | Per-phone and per-fingerprint throttling in Postgres, near-duplicate rejection (same phone within 90 seconds), repeat-canceller risk flagging, and an in-process first-line limiter in front of every public action. |
| Open redirect | `safeReturnPath` handled `//` and `\` but not schemes, control characters or whitespace tricks. | Rewritten as an allow-list with 25 unit tests covering CRLF injection, scheme smuggling and every known bypass spelling. |
| Security headers | None. | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Admin and account routes additionally send `no-store` and `X-Robots-Tag: noindex`. |
| Route protection | Server-side only, after render began. | The proxy also redirects unauthenticated requests to `/admin` and `/account` before the page renders. Server checks and RLS still run independently. |

### Admin panel

The admin was nine skeleton pages of minified JSX with unbounded `select("*")`
queries. It is now a full operations console:

- **Dashboard** — today's orders and revenue, lifetime revenue, average order
  value, the full fulfilment pipeline, low/out-of-stock counts, pending reviews,
  unread messages, recent orders and customers, best sellers, and an inventory
  watch list. Every tile links through to the matching filtered screen.
- **Orders** — search by number, name, phone or email; filters for status,
  payment, delivery method and date range; four sort orders; server pagination.
- **Order detail** — items with purchase-time price snapshots, totals, coupon,
  customer, address, customer note, the customer-visible tracking timeline, the
  private internal notes, the inventory impact, and an action panel that offers
  only the transitions that are both legal and permitted.
- **Invoice and packing slip** — print-ready. The packing slip deliberately
  omits internal notes, because it travels with the parcel.
- **Inventory** — variant-level stock with product image, SKU, colour, size,
  threshold and state; filters for low/out/in stock; inline adjustment that
  requires a reason.
- **Products** — list with stock roll-up and low-stock count, duplicate,
  archive/restore; a grouped editor covering every field including SEO;
  variants with SKU uniqueness checks; image upload, reorder, set-main and
  delete with storage cleanup and primary-image promotion. The create form
  accepts images directly (with previews and per-file removal) and uploads them
  as soon as the product row exists, then hands off to the editor. There is no
  URL slug field: the slug is generated from the English name on create and then
  held stable, so renaming a product can never break a link already shared with
  a customer or an entry already in the sitemap.
- **Categories, Collections** — full CRUD, scheduling for collections, deletion
  refused while products still reference them.
- **Coupons** — full editor with usage caps, per-customer limits, scheduling,
  archive/restore, and a live state badge (Live / Scheduled / Expired / Fully
  used / Archived).
- **Customers** — searchable list, detail page with order history, lifetime
  spend, and a cancelled-order count that flags possible COD abuse.
- **Reviews, Messages, Newsletter** — moderation queues with status workflows,
  staff notes, and a CSV export that guards against spreadsheet formula
  injection.
- **Settings** — database-backed store name, contact details, delivery fees,
  free-delivery threshold, COD/online toggles, maintenance mode, social links,
  plus the notification queue.
- **Staff and roles** — the permission matrix, role assignment, and a documented
  promotion procedure. There is no account-creation path here by design.
- **Audit log** — searchable, filterable, with before/after values.

Every list is server-paginated. Every destructive action confirms. Every screen
has explicit loading, empty and error states.

### Storefront

- Checkout offers one delivery option and cash on delivery only; both are
  fixed server-side rather than sent by the browser.
- Checkout carries an idempotency key, blocks double submits, validates
  Bangladeshi phone numbers in every common spelling, and clears the bag only
  after the order exists.
- Guest tracking returns customer-safe fields only — no internal notes, no
  database ids, no staff identities, no risk flags.
- Contact and newsletter forms are rate limited, length bounded and
  duplicate-protected.
- Error boundaries at route, storefront and root level. Raw database messages
  are never shown to customers; they go to the server log with a reference id.
- `robots.ts` excludes admin, account, checkout, bag, wishlist, auth, tracking,
  search and the API. `sitemap.ts` is generated from active database rows with
  real `lastModified` values, and respects collection scheduling.
- Placeholder contact details (`+880 1XXX-XXXXXX`) removed. Contact details now
  come from store settings and each field is hidden entirely while blank.
- A skip-to-content link was added, and the admin shell is fully keyboard
  navigable.

---

## 2. Database migrations added

| File | Purpose |
| --- | --- |
| `supabase/migrations/0001_role_and_status_enums.sql` | Adds `manager`, `fulfilment`, `support` roles; `replied` message state; `partially_refunded` payment state. **Must run on its own** — PostgreSQL forbids using a new enum value in the transaction that created it. |
| `supabase/migrations/0002_production_hardening.sql` | Everything else: new columns and tables, the permission model, phone normalisation, rate limiting, the rewritten `place_order()`, the order state machine, audited inventory, admin/analytics RPCs, constraints, indexes, RLS and grants. |
| `supabase/migrations/0003_fix_anon_permission_grants.sql` | Grants `anon` EXECUTE on `has_permission()`. **Required** on any database that already ran `0002` — without it the storefront catalogue fails for every signed-out visitor with `permission denied for function has_permission`. Also folded into `0002` for fresh installs. |
| `supabase/migrations/0004_cod_only_standard_delivery.sql` | Fixes every new order to cash on delivery and the single standard delivery option at the database level. Hides the now-unused `express_delivery_fee` and `online_payment_enabled` settings. Historical orders keep their original values. |

Both are idempotent and additive. No table or column is dropped or renamed, so
existing Auth users, profiles, orders, products and images are preserved.

Run order — **one file at a time**, in the Supabase SQL Editor:

1. `supabase/TARA_COMPLETE_SETUP.sql` (base install; safe to re-run)
2. `supabase/migrations/0001_role_and_status_enums.sql`
3. `supabase/migrations/0002_production_hardening.sql`
4. `supabase/migrations/0003_fix_anon_permission_grants.sql`
5. `supabase/migrations/0004_cod_only_standard_delivery.sql`

See `supabase/README.md` for details, including the optional
`VALIDATE CONSTRAINT` step for legacy rows.

---

## 3. Environment variables you must provide

Copy `.env.local.example` to `.env.local` and fill in:

**Required**

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL only — no `/rest/v1` path. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The anon/publishable key. |
| `NEXT_PUBLIC_SITE_URL` | Public origin, no trailing slash. Must match the Supabase Auth redirect configuration exactly. |

**Optional**

| Variable | Effect if unset |
| --- | --- |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | Google sign-in button is hidden. |

That is the complete list. There are no email, CAPTCHA or monitoring variables:
TARA sends no email of its own (order events are recorded in the database and
read from /admin/settings), COD abuse protection is enforced in Postgres rather
than by a CAPTCHA, and errors go to the server log. Setting a name that does not
appear in `.env.local.example` does nothing.

**`SUPABASE_SERVICE_ROLE_KEY` is deliberately absent.** This application does
not use it and does not need it. Never add it — it bypasses row level security
entirely. If one was ever committed to this repository, rotate it in the
Supabase dashboard immediately.

---

## 4. External services that still need credentials

These are the only things that cannot be completed without an account you own:

1. **Transactional email.** The queue, retry accounting, admin visibility and
   audit trail are built. Set the two `EMAIL_*` variables and implement
   `deliver()` in `lib/notifications.ts` against your provider's API (Resend,
   Postmark, SendGrid and SES all fit the existing interface unchanged).
   Until then, order emails are recorded as `skipped` and visible in
   **Settings → Notification queue** — nothing is silently lost.

2. **Online payment — removed entirely, by request.** There is no gateway, no
   credentials, no "coming soon" option and no code path. `place_order()`
   writes `cash_on_delivery` on every order and ignores anything else a caller
   sends. Payment status is still modelled independently of fulfilment status,
   so adding a gateway later would not need a schema change — but nothing in
   the codebase currently anticipates one.

3. **CAPTCHA (Turnstile).** Environment variables and documentation are in
   place. COD abuse protection works without it.

---

## 5. Tests performed

`npm test` — 68 tests, all passing. Run with Node's built-in test runner; no
new dependency was added.

Covered:

- Open-redirect protection: 25 hostile inputs including `//evil.com`,
  `/\evil.com`, CRLF header injection, scheme smuggling, `javascript:` and
  `data:` URIs; plus the paths that must still be allowed.
- Role permissions: customers and unknown/spoofed roles grant nothing; only
  admins hold `staff.manage`, `settings.manage` and `audit.view`; fulfilment
  cannot touch the catalogue; support cannot move stock, cancel orders or
  change payment; the legacy `staff` role still works.
- Order state machine: terminal states, no backward moves, no skipped steps,
  the full happy path, delivered-is-returned-not-cancelled, and that cancelling
  requires `orders.cancel` rather than merely `orders.fulfil`.
- Money: poisha conversion, float-drift-free addition and multiplication,
  Taka formatting with and without decimals, lakh/crore compaction.
- Phone numbers: seven spellings of the same number all normalise identically
  (this is what makes the COD throttle work), all seven operator prefixes,
  and rejection of foreign and malformed numbers.
- Time zone: Bangladesh day boundaries, and `datetime-local` round-tripping.
- Slugs: category slugs reject spaces, path separators and traversal; the
  product schema strips any slug the browser sends; generated slugs stay
  URL-safe for punctuation, traversal attempts and non-Latin-only names.
- Validation: quantity bounds, empty carts, non-COD payment rejection,
  percentage coupons over 100, coupons expiring before they start, unsafe
  slugs and coupon codes, compare-at price below selling price, contact
  message length bounds.

**Not covered by automated tests:** anything requiring a live database —
concurrent purchase of the final unit, RLS policy behaviour, and cancellation
restock. Those are enforced by the database (row locks, `FOR UPDATE`,
`stock_restored_at`) and are listed in the launch checklist as manual checks.

---

## 6. Build result

```
npm run typecheck   ✓  no errors
npm run lint        ✓  no errors, no warnings
npm test            ✓  68 passed, 0 failed
npm run build       ✓  compiled successfully
```

`npm run verify` runs all four in sequence.

---

## 7. Running, building, deploying

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev                        # http://localhost:3000
```

```bash
npm run verify                     # typecheck, lint, test, build
npm run build && npm start         # production build locally
```

**Deploying (Vercel or any Node host):**

1. Set the environment variables from section 3 in the host's dashboard.
2. Set `NEXT_PUBLIC_SITE_URL` to the production origin.
3. Deploy. The build command is `npm run build`, the start command `npm start`.
4. Add the production domain to Supabase → Authentication → URL Configuration
   under both **Site URL** and **Redirect URLs**, including
   `https://yourdomain/auth/callback`.

---

## 8. Verifying the Supabase configuration

**Migrations applied:**

```sql
select count(*) from public.order_status_transitions;   -- expect 11
select public.role_permissions('fulfilment');           -- expect 4 permissions
select count(*) from public.store_settings where is_public;  -- expect 15
```

**Anonymous visitors can read the catalogue** (the check that `0003` fixes):

```sql
select has_function_privilege('anon', 'public.has_permission(text)', 'execute');
-- must be true; false means the storefront shows an empty shop to every
-- signed-out visitor
```

**RLS is on for every table:**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and not rowsecurity;
-- expect zero rows
```

**Private tables are unreachable by anon:**

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name;
-- expect SELECT on catalogue tables and store_settings only.
-- order_internal_notes, admin_audit_log, request_throttle and
-- notification_outbox must NOT appear.
```

**Internal notes cannot leak through guest tracking** — the decisive check:

```sql
-- As an admin, add an internal note to a real order, then:
select public.get_guest_order_tracking('TARA-…', '<tracking token>');
-- The returned events array must not contain the internal note text.
```

**Storage policies:**

```sql
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects';
-- product-images: public read, staff write
-- avatars: public read, owner-folder write
```

---

## 9. Creating the first administrator

There is no self-promotion path in the application, by design. Do this once, in
the Supabase SQL Editor:

1. Register normally on the storefront with the email you want to be the admin.
2. Run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@yourdomain.com';
   ```

3. Sign out and back in, then open `/admin`.

Afterwards, promote everyone else from **Admin → Staff and roles**. The database
refuses to demote the last remaining administrator, so the store cannot be
locked out of its own panel.

---

## 10. Launch checklist

Work top to bottom. Nothing here is optional.

### Configuration

- [ ] `.env.local` (or host environment) has all three required variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` points at the **production** Supabase project
- [ ] `NEXT_PUBLIC_SITE_URL` is the production domain, no trailing slash
- [ ] Supabase → Auth → URL Configuration: Site URL set to the production domain
- [ ] Supabase → Auth → Redirect URLs includes `https://yourdomain/auth/callback`
- [ ] Email confirmation and password-reset templates point at the production domain
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` anywhere in the repository or the host config

### Database

- [ ] All five SQL files applied, in order, one at a time
- [ ] Signed out (or in a private window), the shop page lists products — if it is
      empty, `0003` has not been applied; check the server log for
      `permission denied for function has_permission`
- [ ] RLS confirmed enabled on every table (query in section 8)
- [ ] `anon` grants confirmed (query in section 8)
- [ ] Storage buckets `product-images` and `avatars` exist with the right policies
- [ ] Optional: legacy-data `CHECK` constraints validated (see `supabase/README.md`)
- [ ] Backups enabled — Supabase → Database → Backups. Confirm the retention
      period matches what you are willing to lose.

### Store data

- [ ] First administrator created and `/admin` reachable
- [ ] **Settings → real support phone number** (currently blank)
- [ ] **Settings → real WhatsApp number** (currently blank)
- [ ] **Settings → real support email** (currently blank)
- [ ] **Settings → store address**
- [ ] **Settings → social links** (blank links are hidden, not broken)
- [ ] Standard and express delivery fees confirmed
- [ ] Free-delivery threshold confirmed
- [ ] COD toggle on; online payment toggle off until a gateway is live
- [ ] At least one category, one active product with a variant, stock and an image

### Functional tests on the real site

- [ ] Register a new account; confirmation email arrives and the link works
- [ ] Password reset end to end, including that an expired link fails cleanly
- [ ] Log in, log out, and confirm `/admin` is unreachable as a customer
- [ ] Checkout shows no delivery-method choice and no online payment option
- [ ] Place a COD order as a **guest**
- [ ] Place a COD order as a **signed-in customer**
- [ ] Double-tap the checkout button — exactly one order is created
- [ ] Order tracking with the number and token shows the customer timeline
- [ ] Add an internal note in the admin, then re-check tracking — the note must
      **not** appear
- [ ] Coupon applies, and a coupon below its minimum is refused
- [ ] A coupon at its usage limit is refused
- [ ] Buy the last unit of a variant; a second attempt is refused, and stock
      never goes negative
- [ ] Cancel an order and confirm stock is restored exactly once
- [ ] Move an order through the full pipeline to delivered
- [ ] Confirm a delivered order cannot be cancelled (only returned)
- [ ] Adjust inventory with a reason; confirm it appears in the audit log
- [ ] Print an invoice and a packing slip
- [ ] Submit the contact form; confirm it appears in Admin → Messages
- [ ] Subscribe to the newsletter; confirm it appears in Admin → Newsletter
- [ ] Submit the contact form five times quickly — later attempts are throttled

### Front end

- [ ] Checked at 320, 375, 390, 430, 768, 1024, 1280 and 1440 px
- [ ] No horizontal scrolling at any width
- [ ] Admin tables scroll inside their own container on a phone
- [ ] `/robots.txt` looks correct and excludes admin, account and checkout
- [ ] `/sitemap.xml` lists products and no private pages
- [ ] Open Graph preview renders (paste a product URL into a chat app)
- [ ] No placeholder text, no `1XXX` phone number, no "Google Maps" box

### Final

- [ ] `npm run verify` passes on the deployment branch
- [ ] No secrets committed (`git ls-files | grep -i env` returns nothing)
- [ ] Analytics configured, if you are using any
- [ ] Supabase migrations 0001 through 0007 applied, in order

---

## 11. Known limitations

Stated plainly, so nothing is a surprise later.

1. **No email is actually sent.** See section 4. Order notifications queue
   correctly and are visible in the admin; they need a provider.
2. **Cash on delivery only, and one delivery option.** Enforced at the database
   level, not merely hidden in the UI. Express delivery and online payment were
   removed from the storefront, the admin settings and the environment file.
3. **No CAPTCHA.** Throttling, duplicate detection and risk flagging are live;
   a human-verification challenge is not.
4. **The in-process rate limiter is per-instance.** On a serverless host each
   instance keeps its own counter, which is why the authoritative limits live in
   Postgres. This is by design, not an oversight.
5. **The footer still shows bKash and Nagad badges.** The checkout accepts only
   cash on delivery, so these advertise methods the store cannot process. They
   were left in place because their removal was not requested, but they should
   go before launch.
6. **Low-stock filtering in the inventory list** compares two columns, which
   PostgREST cannot express as a server filter, so it is applied to the fetched
   page. The page size is bounded, so it stays cheap, but the low-stock view is
   not paginated. The dashboard's low-stock **count** is computed in the
   database and is always exact.
7. **Concurrency and RLS are not covered by automated tests.** They are enforced
   by the database and are listed as manual checks above.
