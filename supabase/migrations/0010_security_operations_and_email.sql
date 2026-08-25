/*
TARA MIGRATION 0010 -- Storage permissions, atomic operations, rate limiting,
                       newsletter tokens, settings cleanup, transactional email

Run after 0009. Safe to re-run. One transaction.

The operational half of the production hardening pass. Six faults.

1. STORAGE USED THE OLD "ANY BACK-OFFICE LOGIN" RULE
   Migration 0002 tightened every catalogue TABLE policy to
   has_permission('catalogue.manage'), but storage.objects was left on
   is_staff(). A support agent or a fulfilment picker -- neither of whom can
   edit a product row -- could still upload, overwrite and delete product
   photography straight through the Storage API. The server actions checked the
   right permission; the database did not, and the database is the layer that
   has to hold when the API is called directly.

2. OPERATIONS THAT COULD FAIL HALFWAY
   Changing a product's main image was two statements: clear the old primary,
   then set the new one. A dropped connection between them left the product with
   no primary image at all. Reordering issued one UPDATE per image, so a partial
   failure left two images claiming the same position. Saving a signed-in
   customer's cart deleted every row and then inserted the replacement set, so a
   failed insert emptied their cart -- and it resolved each line with its own
   SELECT, twenty round trips before the write even started.

3. RATE LIMITS THAT DID NOT SURVIVE A COLD START
   Only checkout, the contact form and the newsletter signup consumed a durable
   limit. Coupon attempts, order tracking and the catalogue API had an
   in-process counter only, which on a serverless deployment resets with every
   cold start and is not shared between instances -- closer to advisory than
   enforced.

4. ANYONE COULD UNSUBSCRIBE ANYONE
   unsubscribe_newsletter(p_email) was granted to anon. Knowing -- or guessing --
   an address was enough to remove that person from the list, and the function
   reported success either way, so the victim got no signal and the attacker got
   a silent, repeatable tool. Nothing in the storefront ever called it.

5. SETTINGS THAT DID NOTHING
   store_settings had grown five keys nothing read. A setting an administrator
   can edit but the application ignores is worse than no setting: it looks like
   a working control, so someone changes it, watches nothing happen, and stops
   trusting the panel.

6. AN OUTBOX WITH NO CONSUMER
   notification_outbox had recorded every order and status change since 0002,
   but nothing could read a row back out and turn it into an email: anon cannot
   select from it (correctly -- it holds customer addresses), and a background
   worker would need the service-role key, which this project deliberately does
   not use anywhere. So the outbox was a log nobody could drain, and
   store_settings.order_notification_email was a field with no effect.

WHAT THIS DOES
--------------
  storage policies                   product-image writes require catalogue.manage
  set_product_primary_image()        one transaction; product derived from the image
  reorder_product_images()           the whole ordering in one statement
  delete_product_image()             deletes and promotes atomically
  replace_cart_items()               swaps cart contents atomically
  merge_cart_items()                 merges a guest cart at sign-in
  consume_public_rate_limit()        durable limits, allowances fixed server-side
  unsubscribe_newsletter_by_token()  token only; the email-based function is DROPPED
  settings cleanup                   five dead keys removed
  claim/confirm notification pair    lets the Next.js server drain the outbox
                                     using only credentials it already holds

WHAT IS NOT CHANGED
-------------------
No customer data is deleted. No order, product, review or profile is modified.
The only DROP is the insecure unsubscribe function, which nothing called.

VERIFY
------
  -- signed in as a support or fulfilment account, this must fail:
  insert into storage.objects (bucket_id, name) values ('product-images','x/y.jpg');

  select public.consume_public_rate_limit('coupon', 'test-identifier');  -- true
  select public.consume_public_rate_limit('nonsense', 'x');              -- raises

  select public.unsubscribe_newsletter_by_token(repeat('f', 48));        -- false
  select count(*) from public.newsletter_subscribers where unsubscribe_token is null; -- 0

  select key, is_public from public.store_settings order by key;
  select public.claim_order_notifications('TARA-0000', repeat('0', 48)); -- []
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Storage: product images follow the catalogue permission
-- ---------------------------------------------------------------------------

drop policy if exists product_images_public_storage_read on storage.objects;
drop policy if exists product_images_staff_storage_insert on storage.objects;
drop policy if exists product_images_staff_storage_update on storage.objects;
drop policy if exists product_images_staff_storage_delete on storage.objects;
drop policy if exists product_images_catalogue_storage_insert on storage.objects;
drop policy if exists product_images_catalogue_storage_update on storage.objects;
drop policy if exists product_images_catalogue_storage_delete on storage.objects;

-- Product photography is public by design: it is what the storefront renders.
create policy product_images_public_storage_read on storage.objects for select
  using (bucket_id = 'product-images');

-- Writes require the same permission as editing the product row itself.
-- Administrators and managers hold catalogue.manage; support and fulfilment
-- staff do not, and customers never do.
create policy product_images_catalogue_storage_insert on storage.objects for insert
  with check (bucket_id = 'product-images' and public.has_permission('catalogue.manage'));

create policy product_images_catalogue_storage_update on storage.objects for update
  using (bucket_id = 'product-images' and public.has_permission('catalogue.manage'))
  with check (bucket_id = 'product-images' and public.has_permission('catalogue.manage'));

create policy product_images_catalogue_storage_delete on storage.objects for delete
  using (bucket_id = 'product-images' and public.has_permission('catalogue.manage'));

-- ---------------------------------------------------------------------------
-- 2. Product image operations, one transaction each
-- ---------------------------------------------------------------------------

-- Promotes one image to primary.
--
-- The product id is derived from the image row rather than taken from the
-- caller, so a request cannot pair an image with a product it does not belong
-- to. Clearing the old primary and setting the new one happen in the same
-- transaction: either the product ends up with exactly one primary image, or
-- nothing changes at all.
create or replace function public.set_product_primary_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product uuid;
begin
  perform public.require_permission('catalogue.manage');

  select product_id into target_product
  from public.product_images where id = p_image_id for update;
  if target_product is null then
    raise exception 'image_not_found';
  end if;

  update public.product_images
    set is_primary = false, updated_at = now()
    where product_id = target_product and is_primary and id <> p_image_id;

  update public.product_images
    set is_primary = true, updated_at = now()
    where id = p_image_id;

  perform public.log_admin_action(
    'product.primary_image_changed', 'product', target_product::text, null,
    null, jsonb_build_object('imageId', p_image_id), null
  );

  return jsonb_build_object('ok', true, 'productId', target_product);
end;
$$;

-- Rewrites the whole ordering in one statement.
--
-- The previous implementation issued one UPDATE per image from the server
-- action; a failure part-way through left two images claiming the same
-- position, which the storefront then rendered in an arbitrary order.
create or replace function public.reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected integer;
begin
  perform public.require_permission('catalogue.manage');

  select count(*) into expected
  from public.product_images where product_id = p_product_id;

  -- The caller must send the complete set, so a stale browser tab cannot drop
  -- an image out of the ordering by omitting it.
  if expected <> coalesce(array_length(p_image_ids, 1), 0) then
    raise exception 'incomplete_image_order';
  end if;

  if exists (
    select 1 from unnest(p_image_ids) as requested(id)
    where not exists (
      select 1 from public.product_images i
      where i.id = requested.id and i.product_id = p_product_id
    )
  ) then
    raise exception 'image_not_found';
  end if;

  update public.product_images i
    set sort_order = ordered.position - 1, updated_at = now()
    from (
      select id, row_number() over () as position
      from unnest(p_image_ids) as id
    ) ordered
    where i.id = ordered.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Deletes an image and, when it was the primary, promotes the next one in the
-- same transaction. Returns the storage path so the caller can remove the
-- object afterwards -- deleting the file first would risk a broken image if the
-- row delete then failed.
create or replace function public.delete_product_image(p_image_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed record;
  promoted uuid;
begin
  perform public.require_permission('catalogue.manage');

  delete from public.product_images
    where id = p_image_id
    returning product_id, storage_path, is_primary into removed;

  if removed.product_id is null then
    raise exception 'image_not_found';
  end if;

  if removed.is_primary then
    select id into promoted
    from public.product_images
    where product_id = removed.product_id
    order by sort_order, id
    limit 1;

    if promoted is not null then
      update public.product_images set is_primary = true, updated_at = now()
        where id = promoted;
    end if;
  end if;

  perform public.log_admin_action(
    'product.image_deleted', 'product', removed.product_id::text, null,
    jsonb_build_object('imageId', p_image_id), null, null
  );

  return jsonb_build_object(
    'ok', true,
    'productId', removed.product_id,
    'storagePath', removed.storage_path,
    'promotedImageId', promoted
  );
end;
$$;

grant execute on function public.set_product_primary_image(uuid) to authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;
grant execute on function public.delete_product_image(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cart: resolve every line in one query, swap contents atomically
-- ---------------------------------------------------------------------------

-- Resolves the browser's (product, size, colour) tuples to active variants and
-- returns the rows that should exist, with quantities clamped to what is
-- actually purchasable. Lines that no longer resolve are dropped rather than
-- failing the whole save: a cart is not an order, and a customer should not be
-- locked out of their bag because one product was archived.
create or replace function public.resolve_cart_lines(p_items jsonb)
returns table (variant_id uuid, quantity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, least(20, greatest(1, sum(line.quantity)::integer), v.stock_quantity)
  from (
    select
      (element ->> 'productId')::uuid as product_id,
      -- Historic carts stored the legacy "Undready" wording for unstitched.
      replace(element ->> 'size', 'Undready', 'Unstitched') as size,
      element ->> 'colour' as colour,
      greatest(1, least(20, coalesce((element ->> 'quantity')::integer, 1))) as quantity
    from jsonb_array_elements(p_items) as element
    limit 100
  ) line
  join public.product_variants v
    on v.product_id = line.product_id
   and v.size = line.size
   and v.colour_en = line.colour
   and v.is_active
  join public.products p on p.id = v.product_id and p.status = 'active'
  where v.stock_quantity > 0
  group by v.id, v.stock_quantity;
$$;

-- The cart as the storefront needs to render it. Explicit columns only.
create or replace function public.current_cart_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'productId', p.id,
      'slug', p.slug,
      'name', p.name_en,
      'image', coalesce((
        select i.image_url from public.product_images i
        where i.product_id = p.id
        order by i.is_primary desc, i.sort_order, i.id
        limit 1
      ), ''),
      'price', coalesce(v.price_override, p.base_price),
      'size', v.size,
      'colour', v.colour_en,
      'quantity', ci.quantity
    )
    order by ci.created_at, ci.id
  ), '[]'::jsonb)
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id and c.user_id = auth.uid()
  join public.product_variants v on v.id = ci.product_variant_id
  join public.products p on p.id = v.product_id;
$$;

-- Replaces the signed-in customer's cart with exactly these lines.
create or replace function public.replace_cart_items(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cart uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items';
  end if;

  insert into public.carts (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  select id into target_cart from public.carts where user_id = auth.uid();

  -- Both statements are in this function's single transaction, so a failure
  -- rolls the delete back with the insert. The old two-step server action could
  -- leave a customer with an empty cart if the insert failed.
  delete from public.cart_items where cart_id = target_cart;

  insert into public.cart_items (cart_id, product_variant_id, quantity)
  select target_cart, resolved.variant_id, resolved.quantity
  from public.resolve_cart_lines(coalesce(p_items, '[]'::jsonb)) resolved;

  return public.current_cart_state();
end;
$$;

-- Merges a guest's local cart into the stored one at sign-in: quantities add up
-- rather than overwrite, still capped at what can actually be bought.
create or replace function public.merge_cart_items(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cart uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items';
  end if;

  insert into public.carts (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  select id into target_cart from public.carts where user_id = auth.uid();

  insert into public.cart_items as ci (cart_id, product_variant_id, quantity)
  select target_cart, resolved.variant_id, resolved.quantity
  from public.resolve_cart_lines(coalesce(p_items, '[]'::jsonb)) resolved
  on conflict (cart_id, product_variant_id) do update
    set quantity = least(
          20,
          ci.quantity + excluded.quantity,
          (select v.stock_quantity from public.product_variants v
            where v.id = excluded.product_variant_id)
        ),
        updated_at = now();

  return public.current_cart_state();
end;
$$;

-- carts.user_id and cart_items(cart_id, product_variant_id) are already unique
-- from the base schema, which is what the ON CONFLICT clauses above rely on.

grant execute on function public.replace_cart_items(jsonb) to authenticated;
grant execute on function public.merge_cart_items(jsonb) to authenticated;
grant execute on function public.current_cart_state() to authenticated;
-- resolve_cart_lines is an implementation detail of the two above.
revoke execute on function public.resolve_cart_lines(jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Durable rate limiting for the remaining public endpoints
-- ---------------------------------------------------------------------------

-- The limits live here, not in the caller's arguments.
--
-- consume_rate_limit() takes a limit and a window, which is fine for the
-- SECURITY DEFINER functions that call it internally -- but it must never be
-- exposed to a client, because a client would simply pass a limit of one
-- million. This wrapper is the public entry point: it accepts a bucket name
-- from a fixed list and looks the numbers up itself.
create or replace function public.consume_public_rate_limit(
  p_bucket text,
  p_identifier text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowance integer;
  window_seconds integer;
begin
  case p_bucket
    when 'coupon'        then allowance := 15; window_seconds := 600;
    when 'tracking'      then allowance := 20; window_seconds := 600;
    when 'catalogue-api' then allowance := 90; window_seconds := 60;
    when 'newsletter'    then allowance := 5;  window_seconds := 600;
    when 'contact'       then allowance := 4;  window_seconds := 900;
    when 'checkout'      then allowance := 8;  window_seconds := 600;
    when 'unsubscribe'   then allowance := 10; window_seconds := 3600;
    when 'auth'          then allowance := 12; window_seconds := 600;
    else raise exception 'unknown_rate_limit_bucket';
  end case;

  return public.consume_rate_limit(p_bucket, p_identifier, allowance, window_seconds);
end;
$$;

grant execute on function public.consume_public_rate_limit(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Newsletter: unsubscribe by token, never by email address
-- ---------------------------------------------------------------------------

alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token text;

-- 48 hex characters (192 bits) from two v4 UUIDs. gen_random_uuid() is a
-- pg_catalog built-in, so it resolves under the empty search_path that the
-- security definer functions below run with -- unlike gen_random_bytes(),
-- which lives in the extensions schema (see migration 0006).
update public.newsletter_subscribers
  set unsubscribe_token = substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  )
  where unsubscribe_token is null;

alter table public.newsletter_subscribers
  alter column unsubscribe_token set not null;

create unique index if not exists newsletter_unsubscribe_token_idx
  on public.newsletter_subscribers(unsubscribe_token);

-- ---------------------------------------------------------------------------
-- Subscribe: mints a token for a new address, keeps the existing one otherwise
-- ---------------------------------------------------------------------------

create or replace function public.subscribe_newsletter(
  p_email text,
  p_language text default 'en',
  p_client_fingerprint text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare clean_email text := lower(trim(coalesce(p_email, '')));
begin
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean_email) > 200 then
    raise exception 'invalid_email';
  end if;
  if not public.consume_rate_limit('newsletter:email', clean_email, 3, 3600) then
    raise exception 'rate_limited';
  end if;
  if p_client_fingerprint is not null
     and not public.consume_rate_limit('newsletter:client', p_client_fingerprint, 8, 3600) then
    raise exception 'rate_limited';
  end if;

  insert into public.newsletter_subscribers (email, is_active, unsubscribe_token)
  values (
    clean_email, true,
    substr(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      1, 48
    )
  )
  on conflict (email) do update
    set is_active = true,
        unsubscribed_at = null,
        updated_at = now();

  -- p_language is accepted for signature compatibility and ignored: the store
  -- is English only.
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unsubscribe: token only
-- ---------------------------------------------------------------------------

create or replace function public.unsubscribe_newsletter_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_token text := trim(coalesce(p_token, ''));
  matched integer;
begin
  -- Shape check before the lookup, so junk costs a regex rather than a query.
  if clean_token !~ '^[0-9a-f]{48}$' then
    return false;
  end if;

  if not public.consume_rate_limit('newsletter:unsub_token', clean_token, 10, 3600) then
    raise exception 'rate_limited';
  end if;

  update public.newsletter_subscribers
    set is_active = false, unsubscribed_at = now(), updated_at = now()
    where unsubscribe_token = clean_token;
  get diagnostics matched = row_count;

  -- The token identifies exactly one subscriber, so reporting honestly whether
  -- it matched leaks nothing -- unlike the old function, where a truthful
  -- answer would have confirmed that a given address was on the list.
  return matched > 0;
end;
$$;

-- A signed-in customer can retrieve the token for their own verified address.
-- auth.email() comes from the session, never from an argument, so this cannot
-- be pointed at somebody else's address.
create or replace function public.newsletter_unsubscribe_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select n.unsubscribe_token
  from public.newsletter_subscribers n
  where auth.uid() is not null
    and n.email = lower(trim(coalesce(auth.email(), '')))
    and n.is_active;
$$;

-- The insecure entry point goes away entirely rather than merely losing its
-- grant, so it cannot be re-granted by accident later.
revoke execute on function public.unsubscribe_newsletter(text) from anon, authenticated;
drop function if exists public.unsubscribe_newsletter(text);

grant execute on function public.unsubscribe_newsletter_by_token(text) to anon, authenticated;
grant execute on function public.newsletter_unsubscribe_token() to authenticated;
grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Store settings: remove the keys nothing reads
-- ---------------------------------------------------------------------------
--
-- The delivery values are migrated in 0009 and removed here, in that order,
-- so a database that had a tuned standard_delivery_fee keeps that number.
--
-- order_notification_email is deliberately KEPT. It was dead before -- nothing
-- sent mail -- but the dispatch pair below and lib/email make it the address
-- the store's own new-order notification goes to, so it now has a real effect.

delete from public.store_settings
where key in (
  'standard_delivery_fee',
  'express_delivery_fee',
  'online_payment_enabled',
  'low_stock_alert_enabled',
  'currency'
);

-- Restate the labels and visibility of the surviving keys so a database that
-- was seeded at any point in this project's history ends up identical.
insert into public.store_settings (key, value, is_public, label) values
  ('store_name',                  '"TARA"'::jsonb,   true,  'Store name'),
  ('support_phone',               '""'::jsonb,       true,  'Support phone'),
  ('whatsapp_number',             '""'::jsonb,       true,  'WhatsApp number'),
  ('support_email',               '""'::jsonb,       true,  'Support email'),
  ('store_address',               '""'::jsonb,       true,  'Store address'),
  ('facebook_url',                '""'::jsonb,       true,  'Facebook URL'),
  ('instagram_url',               '""'::jsonb,       true,  'Instagram URL'),
  ('tiktok_url',                  '""'::jsonb,       true,  'TikTok URL'),
  ('free_delivery_threshold',     '1500'::jsonb,     true,  'Free delivery threshold'),
  ('delivery_fee_inside_sylhet',  '60'::jsonb,       true,  'Delivery charge inside Sylhet'),
  ('delivery_fee_outside_sylhet', '120'::jsonb,      true,  'Delivery charge outside Sylhet'),
  ('free_delivery_enabled',       'true'::jsonb,     true,  'Free delivery offer enabled'),
  ('free_delivery_division',      '"Sylhet"'::jsonb, true,  'Division eligible for free delivery'),
  ('cod_enabled',                 'true'::jsonb,     true,  'Cash on delivery enabled'),
  ('maintenance_mode',            'false'::jsonb,    true,  'Maintenance mode'),
  ('order_notification_email',    '""'::jsonb,       false, 'Internal order notification inbox')
on conflict (key) do update
  set is_public = excluded.is_public,
      label = excluded.label;

-- ---------------------------------------------------------------------------
-- 7. Transactional email: handing queued notifications to the sender
-- ---------------------------------------------------------------------------

alter table public.notification_outbox
  add column if not exists dispatch_token text,
  add column if not exists claimed_at timestamptz;

-- 'sending' is new: it marks a row a sender has taken responsibility for.
alter table public.notification_outbox
  drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'skipped'));

alter table public.notification_outbox
  add column if not exists order_id uuid references public.orders(id) on delete cascade;

create index if not exists notification_outbox_order_idx
  on public.notification_outbox(order_id, status);

-- Rows written before this migration recorded the order number in their payload
-- rather than as a foreign key. Backfill so the claim functions can find them.
update public.notification_outbox o
  set order_id = ord.id
  from public.orders ord
  where o.order_id is null
    and o.payload ->> 'orderNumber' = ord.order_number;

-- From here on the order id is set at insert time by a trigger, so neither
-- place_order() nor admin_transition_order() has to change.
create or replace function public.link_notification_to_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_id is null and new.payload ? 'orderNumber' then
    select id into new.order_id
    from public.orders where order_number = new.payload ->> 'orderNumber';
  end if;
  if new.dispatch_token is null then
    new.dispatch_token := substr(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      1, 48
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notification_outbox_link_order on public.notification_outbox;
create trigger notification_outbox_link_order
  before insert on public.notification_outbox
  for each row execute function public.link_notification_to_order();

update public.notification_outbox
  set dispatch_token = substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  )
  where dispatch_token is null;

-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------

-- Shared body. Moves every claimable row for the order to 'sending' and returns
-- what the sender needs. A row already 'sending' is only reclaimed after five
-- minutes, which turns a crashed send into a late email rather than a lost one
-- and stops two concurrent requests from both sending the same message.
create or replace function public.claim_notifications_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  with claimable as (
    select id from public.notification_outbox
    where order_id = p_order_id
      and (
        status = 'queued'
        or (status = 'sending' and claimed_at < now() - interval '5 minutes')
      )
      and attempts < 5
    order by created_at
    limit 10
    for update skip locked
  ),
  taken as (
    update public.notification_outbox o
      set status = 'sending',
          claimed_at = now(),
          attempts = o.attempts + 1
      from claimable
      where o.id = claimable.id
      returning o.id, o.template, o.recipient, o.payload, o.dispatch_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'template', template,
    'recipient', recipient,
    'payload', payload,
    'dispatchToken', dispatch_token
  )), '[]'::jsonb) into claimed
  from taken;

  return claimed;
end;
$$;

-- Checkout path: the tracking token proves the caller created this order.
create or replace function public.claim_order_notifications(
  p_order_number text,
  p_tracking_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if length(trim(coalesce(p_tracking_token, ''))) < 32 then
    return '[]'::jsonb;
  end if;

  select id into target
  from public.orders
  where order_number = trim(p_order_number)
    and tracking_token = trim(p_tracking_token);

  if target is null then
    return '[]'::jsonb;
  end if;

  return public.claim_notifications_for_order(target);
end;
$$;

-- Admin path: a staff member who just moved an order's status.
create or replace function public.claim_order_notifications_admin(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('orders.view');
  return public.claim_notifications_for_order(p_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirming
-- ---------------------------------------------------------------------------

create or replace function public.confirm_notification_dispatch(
  p_id uuid,
  p_dispatch_token text,
  p_ok boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched integer;
begin
  update public.notification_outbox
    set status = case when p_ok then 'sent' else 'failed' end,
        sent_at = case when p_ok then now() else sent_at end,
        -- Truncated: a provider error can echo the whole request back, and the
        -- request contains the customer's address.
        last_error = case when p_ok then null else left(coalesce(p_error, ''), 300) end
    where id = p_id
      and dispatch_token = trim(coalesce(p_dispatch_token, ''))
      and status = 'sending';
  get diagnostics matched = row_count;
  return matched > 0;
end;
$$;

-- Lets an administrator put a permanently failed notification back in the queue
-- from /admin/settings once the underlying problem is fixed.
create or replace function public.requeue_notification(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('settings.manage');
  update public.notification_outbox
    set status = 'queued', attempts = 0, last_error = null, claimed_at = null
    where id = p_id and status in ('failed', 'sending');
  return found;
end;
$$;

grant execute on function public.claim_order_notifications(text, text) to anon, authenticated;
grant execute on function public.claim_order_notifications_admin(uuid) to authenticated;
grant execute on function public.confirm_notification_dispatch(uuid, text, boolean, text)
  to anon, authenticated;
grant execute on function public.requeue_notification(uuid) to authenticated;
-- The shared body is reachable only from the two guarded entry points above.
revoke execute on function public.claim_notifications_for_order(uuid) from anon, authenticated;

-- The internal notification inbox is a private setting, so the outbox needs a
-- way to learn it without exposing the value. This returns the address only to
-- a caller that already holds a claimed dispatch token for a store-bound row.
create or replace function public.store_notification_recipient(
  p_id uuid,
  p_dispatch_token text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(trim(s.value #>> '{}'), '')
  from public.store_settings s
  where s.key = 'order_notification_email'
    and exists (
      select 1 from public.notification_outbox o
      where o.id = p_id
        and o.dispatch_token = trim(coalesce(p_dispatch_token, ''))
        and o.recipient = 'store'
        and o.status = 'sending'
    );
$$;

grant execute on function public.store_notification_recipient(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Functions that stop reading the Bengali columns
-- ---------------------------------------------------------------------------
--
-- These are rewritten here, BEFORE migration 0011 drops the columns, so that
-- 0011 can be reviewed and applied separately -- or held back indefinitely --
-- without leaving a function pointing at a column that no longer exists.
--
-- Every column they now omit is either nullable or has a default of '', so
-- they work whether or not 0011 has run.
--
-- place_order() is not here: 0009 already defines it in its final, Bengali-free
-- form.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  insert into public.carts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  insert into public.profiles (id, full_name, email, phone)
  select
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', ''),
    coalesce(auth_user.email, ''),
    coalesce(auth_user.raw_user_meta_data ->> 'phone', '')
  from auth.users auth_user
  where auth_user.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.carts (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select profile.* into current_profile
  from public.profiles profile where profile.id = auth.uid();

  return current_profile;
end;
$$;

create or replace function public.get_guest_order_tracking(
  p_order_number text,
  p_tracking_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.status,
    'createdAt', o.created_at,
    'deliveryMethod', o.delivery_method,
    'paymentMethod', o.payment_method,
    'total', o.total,
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', e.status,
          'noteEn', e.note_en,
          'createdAt', e.created_at
        ) order by e.created_at
      )
      from public.order_tracking_events e
      where e.order_id = o.id and e.is_customer_visible
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and o.tracking_token = trim(p_tracking_token)
    and length(trim(p_tracking_token)) >= 32;
$$;

create or replace function public.admin_save_coupon(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  coupon_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  before_value jsonb;
  saved public.coupons%rowtype;
  normalized_code text := upper(trim(coalesce(p_payload ->> 'code', '')));
begin
  perform public.require_permission('coupons.manage');

  if normalized_code !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'invalid_code';
  end if;
  if (p_payload ->> 'discountType') not in ('fixed', 'percentage') then
    raise exception 'invalid_discount_type';
  end if;
  if (p_payload ->> 'discountValue')::numeric <= 0 then
    raise exception 'invalid_discount_value';
  end if;
  if (p_payload ->> 'discountType') = 'percentage'
     and (p_payload ->> 'discountValue')::numeric > 100 then
    raise exception 'invalid_discount_value';
  end if;

  if coupon_id is not null then
    select to_jsonb(c) into before_value from public.coupons c where c.id = coupon_id;
  end if;

  insert into public.coupons (
    id, code, description_en, discount_type, discount_value,
    minimum_order_amount, maximum_discount_amount, starts_at, expires_at,
    usage_limit, per_customer_limit, is_active
  ) values (
    coalesce(coupon_id, gen_random_uuid()),
    normalized_code,
    coalesce(p_payload ->> 'descriptionEn', ''),
    (p_payload ->> 'discountType')::public.discount_type,
    (p_payload ->> 'discountValue')::numeric,
    coalesce(nullif(p_payload ->> 'minimumOrderAmount', '')::numeric, 0),
    nullif(p_payload ->> 'maximumDiscountAmount', '')::numeric,
    nullif(p_payload ->> 'startsAt', '')::timestamptz,
    nullif(p_payload ->> 'expiresAt', '')::timestamptz,
    nullif(p_payload ->> 'usageLimit', '')::integer,
    nullif(p_payload ->> 'perCustomerLimit', '')::integer,
    coalesce(nullif(p_payload ->> 'isActive', '')::boolean, true)
  )
  on conflict (id) do update set
    code = excluded.code,
    description_en = excluded.description_en,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    minimum_order_amount = excluded.minimum_order_amount,
    maximum_discount_amount = excluded.maximum_discount_amount,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    usage_limit = excluded.usage_limit,
    per_customer_limit = excluded.per_customer_limit,
    is_active = excluded.is_active
  returning * into saved;

  perform public.log_admin_action(
    case when coupon_id is null then 'coupon.created' else 'coupon.updated' end,
    'coupon', saved.id::text, saved.code, before_value, to_jsonb(saved), null
  );

  return jsonb_build_object('ok', true, 'id', saved.id);
end;
$$;

create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_status public.order_status,
  p_customer_note text default null,
  p_internal_note text default null,
  p_restock boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record record;
  order_item record;
  transition record;
  should_restock boolean;
begin
  perform public.require_permission('orders.view');

  select id, order_number, status, stock_restored_at
  into order_record
  from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if order_record.status = p_status then
    raise exception 'invalid_transition:already_%', p_status;
  end if;

  select * into transition
  from public.order_status_transitions
  where from_status = order_record.status and to_status = p_status;

  if not found then
    raise exception 'invalid_transition:%_to_%', order_record.status, p_status;
  end if;

  perform public.require_permission(transition.required_permission);

  -- Cancellations always return goods that never left the building. Returns are
  -- opt-in: a returned garment usually needs inspection before it is sellable
  -- again, so the caller decides explicitly.
  should_restock := coalesce(
    p_restock,
    case when p_status = 'cancelled' then true else false end
  );

  -- stock_restored_at is what makes restocking happen exactly once. A retried
  -- cancellation, or a cancel followed by a return, cannot add the stock twice.
  if should_restock and p_status in ('cancelled', 'returned')
     and order_record.stock_restored_at is null then
    perform set_config('tara.stock_write', 'on', true);
    for order_item in
      select product_variant_id, quantity from public.order_items where order_id = p_order_id
    loop
      insert into public.inventory_adjustments (
        product_variant_id, order_id, previous_quantity, new_quantity, delta,
        reason, note, adjusted_by
      )
      select
        v.id, p_order_id, v.stock_quantity, v.stock_quantity + order_item.quantity,
        order_item.quantity, p_status::text || '_restock', order_record.order_number, auth.uid()
      from public.product_variants v where v.id = order_item.product_variant_id;

      update public.product_variants
        set stock_quantity = stock_quantity + order_item.quantity
        where id = order_item.product_variant_id;
    end loop;
    perform set_config('tara.stock_write', 'off', true);

    update public.orders set stock_restored_at = now() where id = p_order_id;
  end if;

  update public.orders
    set status = p_status,
        cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
        delivered_at = case when p_status = 'delivered' then now() else delivered_at end
    where id = p_order_id;

  insert into public.order_tracking_events (
    order_id, status, note_en, created_by, is_customer_visible
  ) values (
    p_order_id, p_status, nullif(trim(coalesce(p_customer_note, '')), ''), auth.uid(), true
  );

  if nullif(trim(coalesce(p_internal_note, '')), '') is not null then
    insert into public.order_internal_notes (order_id, author_id, author_name, note)
    select p_order_id, auth.uid(), coalesce(pr.full_name, pr.email, ''), trim(p_internal_note)
    from public.profiles pr where pr.id = auth.uid();
  end if;

  perform public.log_admin_action(
    'order.status_changed', 'order', p_order_id::text, order_record.order_number,
    jsonb_build_object('status', order_record.status),
    jsonb_build_object('status', p_status, 'restocked', should_restock),
    p_internal_note
  );

  insert into public.notification_outbox (template, recipient, payload)
  select 'order_' || p_status::text, coalesce(o.customer_email, ''),
         jsonb_build_object('orderNumber', o.order_number, 'status', p_status)
  from public.orders o
  where o.id = p_order_id and coalesce(o.customer_email, '') <> ''
    and p_status::text in ('confirmed', 'shipped', 'delivered', 'cancelled');

  return jsonb_build_object('ok', true, 'status', p_status, 'restocked', should_restock);
end;
$$;

grant execute on function public.get_guest_order_tracking(text, text) to anon, authenticated;
grant execute on function public.admin_transition_order(uuid, public.order_status, text, text, boolean)
  to authenticated;
grant execute on function public.admin_save_coupon(jsonb) to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;

commit;
