# Setting up TARA

From an empty machine to a working shop. Roughly twenty minutes, most of it
waiting for Supabase.

---

## 1. Install and configure

```bash
npm ci
cp .env.local.example .env.local
```

Open `.env.local` and fill in three values:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → **Project Settings → API → Project URL**. The bare origin, e.g. `https://abcdefgh.supabase.co` — no `/rest/v1`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The same page, **Publishable** (anon) key. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; the real origin in production. |

Everything else in `.env.local.example` is optional and the site works
correctly without it.

> The **service role key is not used by this project** and must not be added.
> It bypasses row level security entirely. Every feature here, including the
> tests that prove the security policies hold, works with the publishable key.

---

## 2. Create the database

The whole schema is a numbered migration series in `supabase/migrations/`.
Applying them in order to an empty Postgres reproduces the database exactly —
tables, indexes, functions, triggers, row level security, storage policies,
grants and the store settings catalogue.

### With the Supabase CLI (recommended)

```bash
npm install -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

`db push` applies every migration that has not been applied yet and records
what it did, so running it again is a no-op. This is the only supported way to
apply a migration to an environment that already has one.

Check what has been applied:

```bash
supabase migration list
```

### Without the CLI

Open the Supabase dashboard → **SQL Editor** and run each file in
`supabase/migrations/` **in filename order**, one file at a time, pasting the
whole file. Do not run a selection.

`0001_role_and_status_enums.sql` must run on its own: PostgreSQL refuses to
*use* an enum value in the same transaction that added it, so it cannot be
merged with the file after it.

Every file is idempotent — re-running one repairs missing objects without
touching customers, orders or products.

### What NOT to install

`supabase/seed/development_seed.sql` is fourteen invented products with stock
photography and made-up reviews. It is not referenced by any migration and must
never be run against production. On a local or staging database:

```bash
psql "$LOCAL_DATABASE_URL" -f supabase/seed/development_seed.sql
```

To remove it again: `delete from public.products where product_code like 'TR-%';`

---

## 3. Create the first administrator

There is no self-promotion path from the application — `set_profile_role()`
deliberately requires an existing admin — so the first one is made by hand.

1. Register through the website's normal form at `/register`.
2. Confirm the email if confirmation is enabled.
3. In the Supabase **SQL Editor**:

```sql
update public.profiles
set role = 'admin'
where email = 'you@yourdomain.com';
```

Confirm that exactly one row changed. Sign out and back in, then open `/admin`.

Once that account exists, every further role change is made from
**/admin/staff**, which writes an audit record. The available roles are:

| Role | Can do |
| --- | --- |
| `admin` | Everything, including staff, settings and the audit log |
| `manager` | Catalogue, inventory, orders, customers, coupons, reviews, messages, newsletter, analytics |
| `fulfilment` | View and fulfil orders, adjust inventory, add order notes |
| `support` | View orders, add notes, view customers, handle messages |
| `customer` | Nothing in the back office |

---

## 4. Configure authentication

Supabase dashboard → **Authentication → URL Configuration**.

Keep **Email and password** enabled.

**Site URL**

```
http://localhost:3000          # development
https://www.tarabd.co          # production
```

**Redirect URLs** — add all of these for the environment you are configuring:

```
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/**
```

```
https://www.tarabd.co/auth/callback
https://www.tarabd.co/reset-password
https://www.tarabd.co/**
https://tarabd.co/auth/callback
https://tarabd.co/reset-password
https://tarabd.co/**
```

Google sign-in stays hidden while `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false`.
Configure the Google provider in Supabase before changing it.

---

## 5. Configure Storage

The migrations create both buckets and their policies, so there is nothing to
click. For reference:

| Bucket | Public | Limit | Who may write |
| --- | --- | --- | --- |
| `product-images` | yes | 5 MB, JPEG/PNG/WebP/AVIF | holders of `catalogue.manage` |
| `avatars` | yes | 2 MB, JPEG/PNG/WebP | the owning user, in their own folder |

Verify the permission actually holds, rather than assuming it: sign in as a
support or fulfilment account and try to upload into `product-images`. It must
fail. `npm run test:integration` asserts exactly this.

---

## 6. Fill in the store settings

Open **/admin/settings**. Nothing here ships with a plausible-looking
placeholder, because a fake phone number reaching production loses real
customers while a blank one is obviously unfinished.

Set at least:

- **Store name**, **support phone**, **support email**, **store address**
- **Delivery inside the free-delivery division** and **delivery everywhere else**
- **Free delivery from**, and which **division** the offer applies to
- The **social URLs** you actually use — blank ones are hidden, not rendered as
  dead links

These reach the footer, the contact page, the announcement bar, the checkout
delivery quote, the invoice, the packing slip and the organisation structured
data on the next request. There is no second copy in the code.

---

## 7. Check it works

```bash
npm run verify        # typecheck, lint, unit tests, production build
npm run dev
```

Then walk the flow once by hand:

1. Open the shop, filter by a size, reload — the filter survives.
2. Open a product, add it to the bag, go to checkout.
3. Pick **Sylhet** and a Sylhet district; the delivery line follows the rule.
4. Place a cash-on-delivery order; note the order number and tracking token.
5. Track it at `/track-order` with both values.
6. Open `/admin/orders` — the order is there, Pending / Unpaid.

If checkout fails, run this in the SQL Editor:

```sql
select public.place_order(
  '{"name":"","email":"","phone":""}'::jsonb, '{}'::jsonb, '[]'::jsonb,
  'standard','cash_on_delivery',null,null,null,null
);
```

It must raise `invalid_customer_or_address`. Any other error means a migration
has not been applied — see [DATABASE.md](DATABASE.md).
