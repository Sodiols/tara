/*
TARA MIGRATION 0008 -- Fix: "column reference customer_phone is ambiguous"

Run after 0006. Safe to re-run. THIS IS THE REMAINING CHECKOUT BLOCKER.

THE BUG
-------
With 0006 applied, place_order() got past its declarations and its input
validation -- and then died on the very next step:

    42702: column reference "customer_phone" is ambiguous
           It could refer to either a PL/pgSQL variable or a table column.

The function declares a variable named `customer_phone`, and `public.orders`
has a column named `customer_phone`. The duplicate-order guard and the
repeat-cancellation check both query `public.orders` and compare against that
variable:

    select 1 from public.orders
    where normalized_phone = customer_phone      -- variable? or orders.customer_phone?

PostgreSQL refuses to guess, and raises. Because the error is not one of the
strings the application recognises, checkout fell through to its catch-all
message.

This has been present since migration 0002, which introduced both the
`normalized_phone` guard and the variable. It was invisible until now only
because the gen_random_bytes() failure fixed in 0006 happened first, in the
DECLARE block. Between the two, no order has ever been placeable.

THE FIX
-------
Rename the PL/pgSQL variable to `v_customer_phone`. It is now impossible for it
to collide with a column, in this statement or any future one.

The identical name in the INSERT column list is left exactly as it is -- that
one really is `orders.customer_phone`.

ALSO IN THIS MIGRATION
----------------------
The `_bn` column defaults from 0005 are re-applied. They are `alter column ...
set default ''` statements, so running them again is a no-op -- but the very
next thing place_order() does after this fix is insert into `order_items`,
which has two `not null` `_bn` columns. Including them here means this one file
is enough to make checkout work, whether or not 0005 was run.

Migration 0007 (the unstitched category slug) is a separate concern -- catalogue
visibility, not checkout -- and still needs to be run.

WHAT IS NOT CHANGED
-------------------
Pricing, stock locking and deduction, coupon validation and usage counting,
idempotency, duplicate-order and rate-limit protection, the cash-on-delivery
rule and the order event log all behave exactly as before. This migration only
changes what a variable is called.

VERIFY
------
  select public.place_order(
    '{"name":"","email":"","phone":""}'::jsonb, '{}'::jsonb, '[]'::jsonb,
    'standard','cash_on_delivery',null,null,null,null
  );

must raise `invalid_customer_or_address` (not 42702). Then place a real test
order through the website -- it should reach the confirmation screen and appear
in /admin/orders as Pending / Unpaid.
*/

begin;

-- From 0005. Idempotent; included so this file alone unblocks checkout.
alter table public.categories       alter column name_bn         set default '';
alter table public.collections      alter column name_bn         set default '';
alter table public.products         alter column name_bn         set default '';
alter table public.products         alter column description_bn  set default '';
alter table public.products         alter column fabric_bn       set default '';
alter table public.product_variants alter column colour_bn       set default '';
alter table public.order_items      alter column product_name_bn set default '';
alter table public.order_items      alter column colour_bn       set default '';

create or replace function public.place_order(
  p_customer jsonb,
  p_shipping_address jsonb,
  p_items jsonb,
  p_delivery_method text,
  p_payment_method text,
  p_coupon_code text default null,
  p_customer_note text default null,
  p_idempotency_key text default null,
  p_client_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  line record;
  variant_record record;
  existing_order record;
  new_order_id uuid := gen_random_uuid();
  new_order_number text;
  -- 48 hex characters (192 bits), built from two v4 UUIDs.
  --
  -- This used to be encode(gen_random_bytes(24), 'hex'). gen_random_bytes()
  -- lives in the pgcrypto extension, which Supabase installs into the
  -- `extensions` schema -- but this function runs with search_path = '' (as it
  -- must, for a security definer function), so the unqualified call could not
  -- be resolved and raised 42883 on EVERY call. Because the failure was in the
  -- DECLARE block it happened before any validation, so no order could ever be
  -- placed: the checkout always returned the generic "could not be placed".
  --
  -- gen_random_uuid() is a pg_catalog built-in from PostgreSQL 13 onward, so it
  -- resolves under an empty search_path and needs no extension at all.
  new_tracking_token text := substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  );
  current_user_id uuid := auth.uid();
  -- Renamed from `customer_phone`: public.orders has a column of that name,
  -- so every query below that compared against it raised 42702.
  v_customer_phone text;
  calculated_subtotal numeric(12,2) := 0;
  calculated_delivery numeric(12,2) := 0;
  calculated_discount numeric(12,2) := 0;
  coupon_result jsonb;
  coupon_row public.coupons%rowtype;
  free_threshold numeric(12,2);
  standard_fee numeric(12,2);
  cod_enabled boolean;
  order_total numeric(12,2);
  risk text[] := '{}';
  distinct_lines integer;
begin
  -- --- Idempotency: replay the original result instead of double-charging ---
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is not null then
    select order_number, tracking_token, total into existing_order
    from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'orderNumber', existing_order.order_number,
        'trackingToken', existing_order.tracking_token,
        'total', existing_order.total,
        'replayed', true
      );
    end if;
  end if;

  -- --- Input validation -----------------------------------------------------
  v_customer_phone := public.normalize_bd_phone(p_customer ->> 'phone');
  if length(trim(coalesce(p_customer ->> 'name', ''))) < 2
     or v_customer_phone is null
     or length(trim(coalesce(p_shipping_address ->> 'fullAddress', ''))) < 8
     or length(trim(coalesce(p_shipping_address ->> 'district', ''))) < 2
     or length(trim(coalesce(p_shipping_address ->> 'division', ''))) < 2 then
    raise exception 'invalid_customer_or_address';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  -- p_delivery_method and p_payment_method are accepted for signature
  -- compatibility and then ignored: the store runs one of each. A client that
  -- asks for express delivery or an online payment is not rejected with a
  -- confusing error, it simply gets the only option that exists.

  select (value #>> '{}')::boolean into cod_enabled
  from public.store_settings where key = 'cod_enabled';
  cod_enabled := coalesce(cod_enabled, true);
  if not cod_enabled then
    raise exception 'cod_disabled';
  end if;

  -- --- COD abuse protection -------------------------------------------------
  if not public.consume_rate_limit('order:phone', v_customer_phone, 5, 3600) then
    raise exception 'rate_limited';
  end if;
  if p_client_fingerprint is not null
     and not public.consume_rate_limit('order:client', p_client_fingerprint, 10, 3600) then
    raise exception 'rate_limited';
  end if;

  if exists (
    select 1 from public.orders
    where normalized_phone = v_customer_phone
      and created_at > now() - interval '90 seconds'
  ) then
    raise exception 'duplicate_order';
  end if;

  if (
    select count(*) from public.orders
    where normalized_phone = v_customer_phone
      and status = 'cancelled'
      and created_at > now() - interval '30 days'
  ) >= 3 then
    risk := array_append(risk, 'repeat_cancellations');
  end if;
  if current_user_id is null then
    risk := array_append(risk, 'guest_checkout');
  end if;

  -- --- Price the order from authoritative database values -------------------
  select count(*) into distinct_lines
  from (
    select distinct (element ->> 'variantId')::uuid
    from jsonb_array_elements(p_items) as element
  ) unique_variants;
  if distinct_lines = 0 then
    raise exception 'empty_order';
  end if;

  for line in
    select (element ->> 'variantId')::uuid as variant_id,
           sum((element ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as element
    group by 1
    order by 1
  loop
    if line.quantity < 1 or line.quantity > 20 then
      raise exception 'invalid_quantity';
    end if;

    select
      v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en, v.colour_bn,
      v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
      p.name_en, p.name_bn, p.product_code
    into variant_record
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = line.variant_id
      and v.is_active
      and p.status = 'active'
    for update of v;

    if not found then raise exception 'invalid_variant'; end if;
    if variant_record.stock_quantity < line.quantity then
      raise exception 'out_of_stock:%', variant_record.sku;
    end if;

    calculated_subtotal := calculated_subtotal + variant_record.price * line.quantity;
  end loop;

  select (value #>> '{}')::numeric into free_threshold
  from public.store_settings where key = 'free_delivery_threshold';
  select (value #>> '{}')::numeric into standard_fee
  from public.store_settings where key = 'standard_delivery_fee';
  free_threshold := coalesce(free_threshold, 1500);
  standard_fee := coalesce(standard_fee, 100);

  -- One delivery option: the standard fee, waived above the threshold.
  calculated_delivery := case
    when calculated_subtotal >= free_threshold then 0
    else standard_fee
  end;

  -- --- Coupon: locked, re-validated, and usage-counted atomically -----------
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into coupon_row
    from public.coupons
    where upper(code) = upper(trim(p_coupon_code))
    for update;

    if not found then raise exception 'invalid_coupon'; end if;

    coupon_result := public.validate_coupon(
      p_coupon_code, calculated_subtotal, current_user_id, v_customer_phone
    );
    if not coalesce((coupon_result ->> 'valid')::boolean, false) then
      raise exception 'invalid_coupon:%', coalesce(coupon_result ->> 'reason', 'invalid');
    end if;

    if coupon_row.usage_limit is not null
       and coupon_row.usage_count >= coupon_row.usage_limit then
      raise exception 'invalid_coupon:usage_limit';
    end if;

    calculated_discount := (coupon_result ->> 'discount')::numeric;
    update public.coupons
      set usage_count = usage_count + 1
      where id = coupon_row.id;
  end if;

  order_total := calculated_subtotal + calculated_delivery - calculated_discount;
  if order_total < 0 then
    raise exception 'invalid_total';
  end if;

  new_order_number := public.generate_order_number();

  insert into public.orders (
    id, order_number, user_id, customer_name, customer_email, customer_phone,
    normalized_phone, payment_method, delivery_method, subtotal, delivery_fee,
    discount_amount, total, shipping_address, customer_note, tracking_token,
    idempotency_key, client_fingerprint, risk_flags
  ) values (
    new_order_id, new_order_number, current_user_id,
    trim(p_customer ->> 'name'), nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), ''),
    v_customer_phone, v_customer_phone,
    'cash_on_delivery'::public.payment_method,
    'standard'::public.delivery_method,
    calculated_subtotal, calculated_delivery, calculated_discount, order_total,
    p_shipping_address, nullif(trim(coalesce(p_customer_note, '')), ''),
    new_tracking_token, nullif(trim(coalesce(p_idempotency_key, '')), ''),
    p_client_fingerprint, risk
  );

  if coupon_result is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
    values (
      (coupon_result ->> 'coupon_id')::uuid, new_order_id, current_user_id, calculated_discount
    )
    on conflict (coupon_id, order_id) do nothing;
  end if;

  -- --- Line snapshots and stock deduction ----------------------------------
  perform set_config('tara.stock_write', 'on', true);

  for line in
    select (element ->> 'variantId')::uuid as variant_id,
           sum((element ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as element
    group by 1
    order by 1
  loop
    select
      v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en, v.colour_bn,
      v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
      p.name_en, p.name_bn, p.product_code,
      coalesce((
        select image_url from public.product_images
        where product_id = p.id order by is_primary desc, sort_order limit 1
      ), '') as image_url
    into variant_record
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = line.variant_id;

    insert into public.order_items (
      order_id, product_id, product_variant_id, product_name_en, product_name_bn,
      product_code, sku, size, colour_en, colour_bn, unit_price, quantity,
      line_total, product_image_url
    ) values (
      new_order_id, variant_record.product_id, variant_record.variant_id,
      variant_record.name_en, variant_record.name_bn, variant_record.product_code,
      variant_record.sku, variant_record.size, variant_record.colour_en,
      variant_record.colour_bn, variant_record.price, line.quantity,
      variant_record.price * line.quantity, variant_record.image_url
    );

    update public.product_variants
      set stock_quantity = stock_quantity - line.quantity
      where id = variant_record.variant_id;

    insert into public.inventory_adjustments (
      product_variant_id, order_id, previous_quantity, new_quantity, delta, reason, note
    ) values (
      variant_record.variant_id, new_order_id, variant_record.stock_quantity,
      variant_record.stock_quantity - line.quantity, -line.quantity,
      'order_placed', new_order_number
    );
  end loop;

  perform set_config('tara.stock_write', 'off', true);

  -- The storefront is English only. note_bn is nullable and is left unset;
  -- the column itself is kept so historic rows still read back unchanged.
  insert into public.order_tracking_events (
    order_id, status, note_en, is_customer_visible
  ) values (
    new_order_id, 'pending', 'Order placed', true
  );

  insert into public.notification_outbox (template, recipient, payload)
  select 'order_placed', lower(trim(p_customer ->> 'email')),
         jsonb_build_object('orderNumber', new_order_number, 'total', order_total)
  where nullif(trim(coalesce(p_customer ->> 'email', '')), '') is not null;

  insert into public.notification_outbox (template, recipient, payload)
  values (
    'admin_new_order', 'store',
    jsonb_build_object(
      'orderNumber', new_order_number, 'total', order_total,
      'customer', trim(p_customer ->> 'name'), 'phone', v_customer_phone
    )
  );

  if current_user_id is not null then
    delete from public.cart_items
    where cart_id = (select id from public.carts where user_id = current_user_id);
  end if;

  return jsonb_build_object(
    'orderNumber', new_order_number,
    'trackingToken', new_tracking_token,
    'total', order_total,
    'replayed', false
  );
end;
$$;

grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text, text, text)
  to anon, authenticated;

commit;
