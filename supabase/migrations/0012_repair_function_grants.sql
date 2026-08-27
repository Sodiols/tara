/*
TARA MIGRATION 0012 -- Repair the EXECUTE grants, and stop the baseline from
                       destroying them again

Run after 0011. Safe to re-run -- and worth re-running any time the back office
starts refusing to save things.

THE FAULT
---------
The admin panel could not change an order's payment status. Nor its fulfilment
status, nor stock, nor settings, nor coupons, nor staff roles. The forms
submitted, the toast said the update had failed, and the value on screen never
moved.

None of those functions was broken. They were simply not executable.

`0000_baseline_schema.sql` ends with a blanket lockdown:

    revoke execute on all functions in schema public from public, anon, authenticated;

followed by a list of nine GRANTs -- the nine functions that existed when the
baseline was written. `0002_production_hardening.sql` then adds thirty more
functions and grants each of them at its own end.

That is correct, in that order. But the baseline was documented as "safe to
re-run", because every object in it is created with IF NOT EXISTS and it deletes
no customer data -- and that is true of the objects. It is NOT true of the
grants. Running the baseline a second time, after 0002, re-executes the blanket
REVOKE and restores only its own nine grants, silently stripping EXECUTE from
every function 0002, 0003, 0006 and 0008 had granted.

Nothing errors. Nothing logs. The functions still exist, the RLS policies still
exist, staff can still sign in and read. The back office just quietly stops
being able to write, and the storefront catalogue stops working for signed-out
visitors, because the product policies call has_permission() and anon can no
longer execute it.

How to recognise it: any of these raises `42501 permission denied for function`
while the function plainly exists.

    select public.has_permission('orders.view');
    select public.normalize_bd_phone('01712345678');
    select public.my_permissions();

WHAT THIS DOES
--------------
1. Re-issues every EXECUTE grant the application needs, for every function that
   exists as of this migration. If the back office ever loses permission again,
   run this file AND every migration after it -- each later migration grants the
   functions it introduces, and the blanket REVOKE below would otherwise strip
   them. `supabase db push` does that for you; by hand, re-run 0012 onwards in
   order.

2. Drops `admin_update_order_status`, the pre-0002 function that set fulfilment
   and payment status together. 0002 dropped it and the baseline re-created it;
   nothing has called it since 0002 introduced the audited state machine, and
   leaving it in place means a function that writes to orders without checking a
   permission or writing an audit record.

The blanket REVOKE is removed from `0000_baseline_schema.sql` in the same commit
as this file, so re-running the baseline can never do this again. 0002 owns the
lockdown, and it revokes and re-grants in the right order.

WHAT THIS DOES NOT DO
---------------------
It grants nothing new. Every line below re-states a grant that an earlier
migration already made deliberately -- this file exists to restore them, not to
widen access. anon gets exactly the six functions it needs to shop and check
out; everything else is `authenticated` only, and every one of those re-checks
the caller's permission inside the function body.

VERIFY
------
  select public.has_permission('orders.view');   -- false, but does not raise
  select public.normalize_bd_phone('01712345678');  -- 01712345678

  -- Nothing should be executable by PUBLIC:
  select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('public', p.oid, 'EXECUTE');
  -- expect zero rows

Then change an order's payment status in /admin/orders. It will save.
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the unaudited legacy function the baseline kept re-creating
-- ---------------------------------------------------------------------------
--
-- Superseded by admin_transition_order() (fulfilment, via the order state
-- machine) and admin_update_payment_status() (payment). Both check a permission
-- and write to admin_audit_log; this one did neither.

drop function if exists public.admin_update_order_status(
  uuid, public.order_status, public.payment_status, text
);

-- ---------------------------------------------------------------------------
-- 2. Lock everything down, then re-grant deliberately
-- ---------------------------------------------------------------------------
--
-- Safe here, unlike in the baseline, because this is the LAST migration: there
-- is no later file whose grants this could strip.

revoke execute on all functions in schema public from public, anon, authenticated;

-- --- Identity and permissions ----------------------------------------------
--
-- has_permission() must be executable by anon. The catalogue's `FOR ALL` staff
-- write policies are evaluated on SELECT as well, so an anonymous shopper
-- reading a product calls it. It reports on the caller's own role and returns
-- false for anon, so granting it leaks nothing -- but revoking it breaks the
-- storefront for every signed-out visitor. This is the fault migration 0003
-- was written to fix.
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_full_admin() to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.set_profile_role(uuid, public.user_role) to authenticated;

-- --- Shopping and checkout (anon may call these) ---------------------------
grant execute on function public.normalize_bd_phone(text) to anon, authenticated;
grant execute on function public.validate_coupon(text, numeric, uuid, text)
  to anon, authenticated;
grant execute on function public.place_order(
  jsonb, jsonb, jsonb, text, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.get_guest_order_tracking(text, text)
  to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, text)
  to anon, authenticated;

-- --- Catalogue (0009) -------------------------------------------------------
grant execute on function public.resolve_shipping_location(text, text)
  to anon, authenticated;
grant execute on function public.calculate_delivery_fee(numeric, text)
  to anon, authenticated;
grant execute on function public.collection_is_visible(uuid) to anon, authenticated;
grant execute on function public.search_catalogue(jsonb) to anon, authenticated;
grant execute on function public.catalogue_facets(jsonb) to anon, authenticated;

-- --- Cart, rate limiting, newsletter, notifications (0010) ------------------
grant execute on function public.replace_cart_items(jsonb) to authenticated;
grant execute on function public.merge_cart_items(jsonb) to authenticated;
grant execute on function public.current_cart_state() to authenticated;
grant execute on function public.consume_public_rate_limit(text, text)
  to anon, authenticated;
grant execute on function public.unsubscribe_newsletter_by_token(text)
  to anon, authenticated;
grant execute on function public.newsletter_unsubscribe_token() to authenticated;
grant execute on function public.claim_order_notifications(text, text)
  to anon, authenticated;
grant execute on function public.claim_order_notifications_admin(uuid) to authenticated;
grant execute on function public.confirm_notification_dispatch(uuid, text, boolean, text)
  to anon, authenticated;
grant execute on function public.store_notification_recipient(uuid, text)
  to anon, authenticated;
grant execute on function public.requeue_notification(uuid) to authenticated;

-- --- Back office ------------------------------------------------------------
--
-- These are the ones whose absence broke the admin panel. Every one of them
-- calls require_permission() as its first statement, so the grant is a
-- precondition for the check, never a substitute for it.
grant execute on function public.admin_transition_order(
  uuid, public.order_status, text, text, boolean
) to authenticated;
grant execute on function public.admin_update_payment_status(
  uuid, public.payment_status, text
) to authenticated;
grant execute on function public.admin_add_order_note(uuid, text) to authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, text, text)
  to authenticated;
grant execute on function public.admin_moderate_review(uuid, public.review_status, text)
  to authenticated;
grant execute on function public.admin_update_message_status(
  uuid, public.message_status, text
) to authenticated;
grant execute on function public.admin_set_newsletter_active(uuid, boolean) to authenticated;
grant execute on function public.admin_save_coupon(jsonb) to authenticated;
grant execute on function public.admin_archive_coupon(uuid, boolean) to authenticated;
grant execute on function public.admin_save_settings(jsonb) to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_analytics(integer) to authenticated;
grant execute on function public.admin_customer_summary(uuid) to authenticated;
grant execute on function public.admin_set_customer_active(uuid, boolean, text)
  to authenticated;
grant execute on function public.admin_mark_notification(uuid, text, text) to authenticated;
grant execute on function public.set_product_primary_image(uuid) to authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;
grant execute on function public.delete_product_image(uuid) to authenticated;

-- --- Deliberately NOT granted ----------------------------------------------
--
-- consume_rate_limit()            a caller-chosen limit is an attacker-chosen
--                                 limit; consume_public_rate_limit() is the
--                                 public entry point and fixes the allowances
-- resolve_cart_lines()            implementation detail of replace/merge
-- claim_notifications_for_order() reachable only via the two guarded claimers
-- log_admin_action(),
-- require_permission(),
-- role_permissions(),
-- prune_request_throttle()        internal to SECURITY DEFINER bodies
-- unsubscribe_newsletter(text)    dropped in 0010; it let anyone unsubscribe
--                                 anyone by email address
--
-- The blanket REVOKE above already removed all of these. They are listed so the
-- omission reads as deliberate rather than forgotten.

-- ---------------------------------------------------------------------------
-- 3. Table grants, restated for the same reason
-- ---------------------------------------------------------------------------
--
-- The baseline's re-run also restored `grant select, update on public.orders to
-- authenticated`, which 0002 had deliberately revoked: every order mutation now
-- goes through an audited RPC, so a customer holding an UPDATE grant on orders
-- is a customer who can change their own order's total.

revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_tracking_events from anon, authenticated;
revoke insert, update, delete on table public.coupons from anon, authenticated;
revoke insert, update, delete on table public.store_settings from anon, authenticated;
revoke insert, update, delete on table public.contact_messages from anon, authenticated;
revoke insert, update, delete on table public.newsletter_subscribers from anon, authenticated;

grant select on table public.orders, public.order_tracking_events to authenticated;
grant select on table public.coupons, public.store_settings to authenticated;
grant select on table public.store_settings to anon;
grant select on table public.contact_messages, public.newsletter_subscribers to authenticated;
grant select on table public.bd_divisions, public.bd_districts to anon, authenticated;

commit;
