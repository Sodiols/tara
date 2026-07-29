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

1. Open **SQL Editor** in the Supabase dashboard.
2. Open `supabase/TARA_COMPLETE_SETUP.sql` from this project.
3. Copy the complete file into a new SQL Editor query.
4. Run the complete SQL once. Do not run selected sections.
5. Confirm the final result says `TARA Supabase setup completed successfully`.

The setup is non-destructive. It repairs partial installations, existing Auth
users without profiles or carts, grants, RLS policies, storage, and catalog
data without deleting customers, profiles, orders, Auth users, or products.

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
