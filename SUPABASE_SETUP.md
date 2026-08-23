# TARA Supabase setup

TARA uses a Supabase Project URL and Publishable Key. The website does not
need a database password, secret key, or service-role key.

## 1. Configure the environment

1. Create or open a Supabase project.
2. Open **Connect** or **Project Settings → API**.
3. Copy the **Project URL**. It must look like
   `https://YOUR_PROJECT_REF.supabase.co` and must not end in `/rest/v1`.
4. Copy the **Publishable Key**.
5. Paste the values into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false
```

Restart the Next.js development server after editing `.env.local`.

## 2. Create or repair the database

Open **SQL Editor** in the Supabase dashboard and run these files **one at a
time, in this order**. Copy each complete file into a new query and run the
whole thing — never a selected section.

1. `supabase/TARA_COMPLETE_SETUP.sql`
2. `supabase/migrations/0001_role_and_status_enums.sql`
3. `supabase/migrations/0002_production_hardening.sql`
4. `supabase/migrations/0003_fix_anon_permission_grants.sql`
5. `supabase/migrations/0004_cod_only_standard_delivery.sql`
6. `supabase/migrations/0005_english_only_storefront.sql`
7. `supabase/migrations/0006_fix_place_order_tracking_token.sql`
8. `supabase/migrations/0007_repair_unstitched_category_slug.sql`
9. `supabase/migrations/0008_fix_place_order_ambiguous_phone.sql`

**The base file alone is not enough.** Checkout does not work without 0006 and
0008 — they repair two separate faults in `place_order()`, and the second only
became reachable once the first was fixed. Without 0007 the Unstitched Three
Piece category shows no products. See `supabase/README.md` for what each file
does.

`0001` must run on its own: PostgreSQL refuses to *use* an enum value in the
same transaction that added it.

Every file is non-destructive and safe to re-run. Together they repair partial
installations, Auth users without profiles or carts, grants, RLS policies,
storage and catalogue data — without deleting customers, profiles, orders, Auth
users or products.

Verify checkout is working before going live:

```sql
select public.place_order(
  '{"name":"","email":"","phone":""}'::jsonb, '{}'::jsonb, '[]'::jsonb,
  'standard','cash_on_delivery',null,null,null,null
);
```

This must fail with `invalid_customer_or_address`. Any other error — in
particular `gen_random_bytes ... does not exist` or `column reference
"customer_phone" is ambiguous` — means a migration is still missing.

## 3. Authentication settings

Keep **Email and password** authentication enabled.

For local development set the Authentication Site URL to:

```text
http://localhost:3000
```

Add these local redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/**
```

For production use `https://www.tarabd.co` as the Site URL and add:

```text
https://www.tarabd.co/auth/callback
https://www.tarabd.co/reset-password
https://www.tarabd.co/**
https://tarabd.co/auth/callback
https://tarabd.co/reset-password
https://tarabd.co/**
```

Google login stays hidden while
`NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false`. Configure the Google provider in
Supabase before changing it to `true`.

## 4. Create the first administrator

Register the intended administrator through the normal TARA registration form
and confirm the email first. Then run this command in Supabase SQL Editor after
replacing the placeholder:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

Confirm that exactly one expected row changed. The first registered customer
is never promoted automatically, and there is no public admin signup route.

## 5. Test authentication

1. Start the site with `npm run dev`.
2. Register a new test account.
3. If email confirmation is enabled, open the confirmation email and follow
   the link. The callback should return to `/account`.
4. Sign in with the confirmed email and password.
5. Refresh the browser and confirm the session remains active.
6. Sign out and confirm `/account` redirects to the login form.
7. Use **Forgot Password**, open the recovery email, set a new password, and
   sign in with the new password.
8. Test profile updates, addresses, cart/wishlist merge, COD checkout, order
   history, tracking, newsletter, and contact submission.

Use two separate customer accounts to confirm that neither account can read or
change the other account's private records.
