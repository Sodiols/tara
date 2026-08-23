# TARA Supabase database

## Files

| File | Purpose |
| --- | --- |
| `TARA_COMPLETE_SETUP.sql` | Base install. Creates the schema, seed catalogue, storage buckets and the original RLS policies. Safe to re-run — it never drops customer data. |
| `migrations/0001_role_and_status_enums.sql` | Adds the `manager` / `fulfilment` / `support` roles, the `replied` message state and `partially_refunded` payment state. |
| `migrations/0002_production_hardening.sql` | Production hardening: permission model, audit log, audited inventory, order state machine, private internal notes, COD abuse protection, tightened RLS and grants. |
| `migrations/0003_fix_anon_permission_grants.sql` | Grants `anon` EXECUTE on `has_permission()`. Without it the storefront catalogue fails for signed-out visitors. Folded into `0002` as well, so a fresh install does not need it — but an existing database that already ran `0002` does. |
| `migrations/0004_cod_only_standard_delivery.sql` | Fixes every order to cash on delivery and the single standard delivery option, ignoring whatever the client sends. Hides the unused `express_delivery_fee` and `online_payment_enabled` settings. Historical orders keep their real values. |
| `migrations/0005_english_only_storefront.sql` | Gives every `not null` `_bn` column a default of `''`, so the now English-only admin can create categories, collections, products and variants without sending Bangla values. **No column is dropped and no row is rewritten.** |
| `migrations/0006_fix_place_order_tracking_token.sql` | **Critical.** `place_order()` called `gen_random_bytes()` (a pgcrypto function) under `search_path = ''`, so it raised `42883` on every call and *no order could ever be placed*. Rebuilds the tracking token from `gen_random_uuid()`, which needs no extension. Also stops writing a Bangla tracking note. |
| `migrations/0007_repair_unstitched_category_slug.sql` | **Critical.** Renames the category whose slug was corrupted to `unready-three-piece` back to `unstitched-three-piece`, which is what the storefront route and query use. Without it `/unstitched-three-piece` shows "0 products found" even though products are assigned to it. |
| `migrations/0008_fix_place_order_ambiguous_phone.sql` | **Critical.** `place_order()` declared a variable `customer_phone` while `public.orders` has a column of the same name, so the duplicate-order guard raised `42702: column reference "customer_phone" is ambiguous` and every checkout failed. Renames the variable to `v_customer_phone`. Also re-applies the 0005 `_bn` defaults, so this one file is enough to unblock checkout. |

## Order of execution

Run these in the Supabase SQL Editor, **one file at a time, in this order**:

1. `TARA_COMPLETE_SETUP.sql`
2. `migrations/0001_role_and_status_enums.sql`
3. `migrations/0002_production_hardening.sql`
4. `migrations/0003_fix_anon_permission_grants.sql`
5. `migrations/0004_cod_only_standard_delivery.sql`
6. `migrations/0005_english_only_storefront.sql`
7. `migrations/0006_fix_place_order_tracking_token.sql`
8. `migrations/0007_repair_unstitched_category_slug.sql`
9. `migrations/0008_fix_place_order_ambiguous_phone.sql`

**An existing database must run 0005 through 0008.** Checkout needs both 0006
and 0008 — they fix two separate faults in `place_order()`, and the second was
invisible until the first was repaired. 0007 is what makes the Unstitched Three
Piece category show its products.

`0001` must run on its own. PostgreSQL refuses to *use* an enum value in the
same transaction that added it, so the role additions cannot be merged into
`0002`.

All nine files are idempotent — re-running them on an existing database repairs
missing objects without touching Auth users, profiles, orders or products.

## After migrating

### 1. Promote your first administrator

Create the account through the website's normal registration form first, then
run (replacing the address):

```sql
update public.profiles set role = 'admin' where email = 'you@yourdomain.com';
```

This must be done in the SQL Editor, because `set_profile_role()` deliberately
requires an existing admin — there is no self-promotion path from the app.

### 2. Fill in the real store settings

```sql
select key, value, is_public from public.store_settings order by key;
```

`support_phone`, `whatsapp_number`, `support_email`, `store_address` and the
social URLs ship empty on purpose so no placeholder contact details can reach
production. Set them from `/admin/settings` once an admin exists.

### 3. Optionally validate the legacy-data constraints

`0002` adds several `CHECK` constraints as `NOT VALID` so a live database with
historical rows still migrates. New writes are enforced immediately. Once you
have reconciled any old rows, promote them:

```sql
alter table public.orders validate constraint orders_total_matches_lines;
alter table public.orders validate constraint orders_discount_within_subtotal;
alter table public.order_items validate constraint order_items_line_total_check;
alter table public.coupons validate constraint coupons_code_format;
alter table public.coupons validate constraint coupons_usage_within_limit;
alter table public.coupons validate constraint coupons_date_order;
alter table public.collections validate constraint collections_date_order;
```

If any of these fail, the query error names the offending row.

## Design rules enforced in the database

- **Stock never moves silently.** A trigger blocks any direct
  `update product_variants set stock_quantity = …`. All movement goes through
  `place_order()` or `admin_adjust_inventory()`, and every movement writes an
  `inventory_adjustments` row.
- **Prices are never taken from the browser.** `place_order()` re-reads every
  variant price, recomputes the delivery fee from `store_settings` and
  re-validates the coupon server-side.
- **Cash on delivery is the only payment method, enforced in SQL.**
  `place_order()` writes `cash_on_delivery` and `standard` on every order and
  ignores whatever the caller asks for, so no crafted request can create an
  order the store cannot fulfil or collect.
- **Internal notes are physically separate.** Staff notes live in
  `order_internal_notes`, which `anon` has no grant on. The guest tracking RPC
  reads only `order_tracking_events` rows flagged `is_customer_visible`.
- **Order status follows an explicit table.** `order_status_transitions` lists
  every legal move and the permission it requires; there is no numeric ranking
  to trick.
- **The application never reads a `_bn` column.** The storefront and the admin
  panel are English only. Every `_bn` column is still there, still holds its
  original data, and is simply not read — so a rollback to an older build, and
  every existing order, invoice and product record, still works.
- **Sensitive mutations are audited.** Order transitions, payment changes,
  inventory adjustments, coupon edits, review moderation, settings and role
  changes all write to `admin_audit_log`.
