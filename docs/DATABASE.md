# The TARA database

Postgres on Supabase. The schema is a numbered migration series: applying every
file in `supabase/migrations/` in order to an empty database reproduces the
production schema exactly, and there is no manual step, no snippet to paste and
no file that has to be remembered.

---

## Applying migrations

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies everything not yet applied
supabase migration list   # shows local vs remote
```

Or, without the CLI: run each file in the Supabase SQL Editor in filename
order, whole file at a time. `0001` must run on its own — PostgreSQL will not
*use* an enum value in the same transaction that added it.

Every file is idempotent. Re-running one repairs missing objects, and only
`0011` ever deletes anything — see its entry below.

`0009`, `0010` and `0011` each wrap themselves in a single transaction, so each
either applies completely or not at all. There is no state in which half a
migration has been applied.

---

## The migrations

| File | What it does |
| --- | --- |
| `0000_baseline_schema.sql` | The production baseline: extensions, enums, tables, indexes, constraints, triggers, functions, RLS, grants, storage buckets and policies, store settings, and the categories and collections the storefront routes depend on. **No sample products.** |
| `0001_role_and_status_enums.sql` | Adds the `manager` / `fulfilment` / `support` roles, the `replied` message state and `partially_refunded` payment state. Must run alone. |
| `0002_production_hardening.sql` | The permission model, audit log, audited inventory, order state machine, private internal notes, COD abuse protection, durable rate limiting, and tightened RLS and grants throughout. |
| `0003_fix_anon_permission_grants.sql` | Grants `anon` EXECUTE on `has_permission()`. Without it the catalogue fails for signed-out visitors, because the staff-write policies are evaluated on SELECT too. |
| `0004_cod_only_standard_delivery.sql` | Fixes every order to cash on delivery and one delivery option, ignoring whatever the client sends. |
| `0005_english_only_storefront.sql` | Gives every `not null` `_bn` column a default of `''` so English-only writes succeed. Drops nothing. |
| `0006_fix_place_order_tracking_token.sql` | **Critical.** `place_order()` called `gen_random_bytes()` under `search_path = ''`, so it raised on every call and no order could ever be placed. |
| `0007_repair_unstitched_category_slug.sql` | **Critical.** Repairs the category slug corrupted to `unready-three-piece`, which made `/unstitched-three-piece` show nothing. |
| `0008_fix_place_order_ambiguous_phone.sql` | **Critical.** A PL/pgSQL variable named `customer_phone` collided with `orders.customer_phone`, so the duplicate-order guard raised `42702` and every checkout failed. |
| `0009_catalogue_geography_and_delivery.sql` | Everything a customer touches. `bd_divisions` / `bd_districts` (8 divisions, 64 districts) and `resolve_shipping_location()`; the delivery settings and `calculate_delivery_fee()`; `search_catalogue()` and `catalogue_facets()` — every filter applied before pagination, a deterministic sort, a true result count and no review bodies; `collection_is_visible()`; a `place_order()` that validates the destination before locking stock and prices delivery by the Sylhet rule; and the address book reduced to division and district, validated by the same function checkout uses. |
| `0010_security_operations_and_email.sql` | The operational half. Storage writes require `catalogue.manage`; atomic `set_product_primary_image()`, `reorder_product_images()`, `delete_product_image()`, `replace_cart_items()` and `merge_cart_items()`; `consume_public_rate_limit()` for the endpoints that had no durable limit; token-based newsletter unsubscribe (and the email-based function dropped); five dead settings removed; and the claim/confirm pair that lets the server drain `notification_outbox` without a service-role key. |
| `0011_drop_bengali_columns.sql` | **The only migration that destroys data.** Drops every `_bn` column and both `preferred_language` columns, and rebuilds the product search index. Separate so it can be reviewed — or deferred indefinitely — on its own: 0009 and 0010 work whether or not it has run. |

---

## The rules the database enforces

These hold regardless of what any client sends, which is the point of putting
them here rather than in the application.

**Stock never moves silently.** A trigger blocks any direct
`update product_variants set stock_quantity = …`. Movement goes through
`place_order()` or `admin_adjust_inventory()`, and every movement writes an
`inventory_adjustments` row with a previous quantity, a new quantity, a delta,
a reason and an actor.

**Money is never taken from the browser.** `place_order()` re-reads every
variant price, recomputes the delivery fee from `store_settings`, re-validates
the coupon, locks each variant row `for update`, and deducts stock — all in one
transaction. Its signature has nowhere to put a price.

**A destination has to be real.** `resolve_shipping_location()` refuses an
unknown division, an unknown district, and a real district under the wrong
division. The order stores the canonical spelling.

**Delivery has one authority.** `calculate_delivery_fee()` is the only place the
charge is decided. `lib/delivery.ts` implements the identical branches for
display, and both read the same settings.

**Restocking happens exactly once.** `orders.stock_restored_at` is what makes a
retried cancellation, or a cancel followed by a return, unable to add the stock
twice.

**Order status follows an explicit table.** `order_status_transitions` lists
every legal move and the permission it requires. There is no numeric ranking to
trick.

**Cash on delivery, in SQL.** `place_order()` writes `cash_on_delivery` and
`standard` on every order and ignores what the caller asks for.

**Internal notes are physically separate.** Staff notes live in
`order_internal_notes`, which `anon` has no grant on. Guest tracking reads only
`order_tracking_events` rows flagged `is_customer_visible`.

**Sensitive mutations are audited.** Order transitions, payment changes,
inventory adjustments, coupon edits, review moderation, settings changes, image
operations and role changes all write to `admin_audit_log`.

**Rate limits are durable.** `consume_rate_limit()` is a shared counter in
Postgres, correct across every serverless instance. It is deliberately not
granted to clients; `consume_public_rate_limit()` is the public entry point and
looks its allowances up from a fixed list rather than taking them as arguments.

---

## Permissions

`role_permissions()` in `0002` is the authority. `lib/permissions.ts` mirrors it
exactly so the admin UI can hide controls, and `tests/security.test.ts` asserts
the mirror matches.

| Permission | admin | manager | fulfilment | support |
| --- | :-: | :-: | :-: | :-: |
| `catalogue.manage` | ● | ● | | |
| `inventory.adjust` | ● | ● | ● | |
| `orders.view` | ● | ● | ● | ● |
| `orders.fulfil` | ● | ● | ● | |
| `orders.cancel` | ● | ● | | |
| `orders.payment` | ● | ● | | |
| `orders.note` | ● | ● | ● | ● |
| `customers.view` | ● | ● | | ● |
| `customers.manage` | ● | | | |
| `coupons.manage` | ● | ● | | |
| `reviews.moderate` | ● | ● | | |
| `messages.manage` | ● | ● | | ● |
| `newsletter.manage` | ● | ● | | |
| `settings.manage` | ● | | | |
| `staff.manage` | ● | | | |
| `audit.view` | ● | | | |
| `analytics.view` | ● | ● | | |

---

## Verifying row level security

Do not take it on trust. `npm run test:integration` signs in as real accounts
with the publishable key — exactly what a browser has — and asserts that each
role is refused what it must be refused. See [TESTING.md](TESTING.md).

A few quick manual checks:

```sql
-- Every table that holds customer or business data has RLS on.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

-- The geography is complete and correctly grouped.
select division_name, count(*) from public.bd_districts group by 1 order by 1;
-- Barishal 6, Chattogram 11, Dhaka 13, Khulna 10, Mymensingh 4,
-- Rajshahi 8, Rangpur 8, Sylhet 4 — 64 in total.

-- The delivery rule.
select public.calculate_delivery_fee(2000, 'Sylhet');   -- 0
select public.calculate_delivery_fee(2000, 'Dhaka');    -- the outside fee
select public.calculate_delivery_fee(500,  'Sylhet');   -- the inside fee

-- Impossible destinations are refused.
select public.resolve_shipping_location('Sylhet', 'Zakiganj');  -- null (upazila)
select public.resolve_shipping_location('Sylhet', 'Dhaka');     -- null (wrong division)

-- Every settings key still in the table.
select key, is_public from public.store_settings order by key;
```

---

## Legacy constraints

`0002` adds several `CHECK` constraints as `NOT VALID`, so a live database with
historical rows still migrates. New writes are enforced immediately. Once old
rows are reconciled, promote them:

```sql
alter table public.orders validate constraint orders_total_matches_lines;
alter table public.orders validate constraint orders_discount_within_subtotal;
alter table public.order_items validate constraint order_items_line_total_check;
alter table public.coupons validate constraint coupons_code_format;
alter table public.coupons validate constraint coupons_usage_within_limit;
alter table public.coupons validate constraint coupons_date_order;
alter table public.collections validate constraint collections_date_order;
```

A failure names the offending row.

---

## Adding a migration

1. `supabase migration new short_description`
2. Write it. Make it idempotent (`if not exists`, `drop … if exists` before
   `create`), and open it with a comment saying **why** — the fault it fixes or
   the capability it adds, not a restatement of the SQL.
3. Never edit an applied migration. A deployed database has already run it and
   will not run it again; correct it with a new one.
4. If it changes a column or a function signature, update `types/database.ts` in
   the same commit — it is hand-maintained and TypeScript is what catches the
   mismatch.
5. `npm run verify`.
