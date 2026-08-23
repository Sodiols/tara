/*
TARA MIGRATION 0003 — Let anonymous visitors evaluate the catalogue policies

Run after 0002_production_hardening.sql. Safe to re-run.

THE BUG
-------
0002 rewrote the catalogue's staff-write policies to use has_permission():

  create policy products_staff_manage on public.products for all
    using (public.has_permission('catalogue.manage')) ...

but granted EXECUTE on that function to `authenticated` only.

A `FOR ALL` policy also applies to SELECT. PostgreSQL evaluates every
permissive policy for the command, so an anonymous shopper reading the product
list evaluated BOTH products_public_read (fine) AND products_staff_manage —
which called a function `anon` had no EXECUTE privilege on. Every catalogue
query then failed with:

  permission denied for function has_permission

Effect: the storefront could not list products, categories, collections,
images, variants or store settings for a signed-out visitor. That is every
first-time customer.

THE FIX
-------
Grant EXECUTE to `anon`. This leaks nothing: has_permission() reports on the
*caller's own* role, and for an anonymous caller current_role_name() resolves
to 'anonymous', whose permission set is empty — so it always returns false.
The policy still denies the write; it just no longer errors on the read.

Tables affected (all of which anon is meant to read): products,
product_images, product_variants, categories, collections, store_settings.

Tables whose policies also use has_permission but which anon has no table-level
grant on — orders, order_items, order_tracking_events, order_internal_notes,
admin_audit_log, inventory_adjustments, notification_outbox, coupons,
coupon_redemptions, profiles, contact_messages, newsletter_subscribers — are
refused at the grant check before RLS is reached, so they are unaffected and
stay closed.
*/

begin;

grant execute on function public.has_permission(text) to anon;

-- is_staff() and is_full_admin() are referenced by the same set of policies and
-- were already granted; re-stated here so a database repaired with this file
-- alone ends up in a consistent state.
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_full_admin() to anon, authenticated;

commit;

/*
VERIFY

Run as an anonymous client (or in the SQL editor after
`set local role anon;` inside a transaction):

  select count(*) from public.products where status = 'active';
  select count(*) from public.categories where is_active;
  select key from public.store_settings where is_public;

All three must return rows rather than raising. And confirm the write is still
refused — this must fail:

  insert into public.products (slug, name_en) values ('x', 'x');
*/
