/*
TARA MIGRATION 0013 -- Delivery zones at checkout, and the Hijab category

Run after 0012. Safe to re-run. One transaction.

WHY
---
Checkout asked the customer for a division and a district, and derived the
delivery charge from the division. That was two questions to answer one, and it
made the shopper do the shop's arithmetic: a customer in Habiganj had to know
that Habiganj is in Sylhet division before the price they were quoted made
sense.

It also put the wrong thing in the order. The only fact the charge depends on is
"inside the free-delivery division, or outside it". Everything else about the
division/district pair was ceremony, and the district was being pressed into
service as the city even when it was not one.

WHAT THIS DOES
--------------
  * calculate_delivery_fee_for_zone(subtotal, zone) -- prices from the zone the
    customer actually chose. calculate_delivery_fee(subtotal, division) is kept
    and now delegates to it, so saved addresses and anything still holding a
    division keep working.

  * place_order() accepts the new shipping shape:

        { address, apartment, city, postalCode, deliveryZone, country }

    and still accepts the old one:

        { fullAddress, division, district }

    A legacy caller has its division resolved and mapped to a zone, so an older
    client -- or a request replayed from a queue -- does not start failing. A
    request carrying neither is refused.

    Nothing is invented in the other direction: an order shipping outside
    Sylhet records `deliveryZone: outside_sylhet`, NOT a guessed division. The
    previous plan of writing "Dhaka" on every outside order to satisfy the old
    validator would have put a false address on a real courier label.

  * Adds the Hijab category, idempotently.

WHAT IS NOT CHANGED
-------------------
Idempotency, duplicate-order detection, the phone and client rate limits, stock
locking with `for update`, stock validation, variant validation, coupon locking
and re-validation, the server-calculated subtotal, discount and total, cash on
delivery enforcement, order number generation, tracking token generation, the
signed-in user linkage, the notification outbox, the order event log, SECURITY
DEFINER and `search_path = ''` all behave exactly as before.

Existing orders are untouched. Their shipping_address jsonb keeps the shape it
was written with, and lib/order-address.ts renders both.

VERIFY
------
  select public.calculate_delivery_fee_for_zone(2000, 'inside_sylhet');   -- 0
  select public.calculate_delivery_fee_for_zone(2000, 'outside_sylhet');  -- outside fee
  select public.calculate_delivery_fee_for_zone(500,  'inside_sylhet');   -- inside fee
  select public.calculate_delivery_fee(2000, 'Sylhet');                   -- 0, unchanged

  select slug, name_en from public.categories order by sort_order;
  -- includes hijab

  select public.place_order(
    '{"name":"","email":"","phone":""}'::jsonb, '{}'::jsonb, '[]'::jsonb,
    'standard','cash_on_delivery',null,null,null,null
  );
  -- must raise invalid_customer_or_address
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. The Hijab category
-- ---------------------------------------------------------------------------
--
-- sort_order 2 puts it between Ready Three Piece and Accessories, matching the
-- homepage. Accessories moves to 3 so the two agree.

insert into public.categories (slug, name_en, sort_order, is_active)
values ('hijab', 'Hijab', 2, true)
on conflict (slug) do update
  set name_en = excluded.name_en,
      is_active = true;

update public.categories set sort_order = 3 where slug = 'accessories';

-- ---------------------------------------------------------------------------
-- 2. Delivery pricing by zone
-- ---------------------------------------------------------------------------

-- The charge for a subtotal and a chosen zone.
--
-- Free delivery is an offer in one division only, so it applies to the inside
-- zone and nowhere else: reaching the threshold outside it changes nothing.
-- An unrecognised zone is priced at the outside rate, which is the safe
-- direction -- but place_order() refuses one before this is reached.
--
-- lib/delivery.ts implements the identical branches for display.
create or replace function public.calculate_delivery_fee_for_zone(
  p_subtotal numeric,
  p_zone text
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inside_fee numeric;
  outside_fee numeric;
  threshold numeric;
  offer_enabled boolean;
begin
  select (value #>> '{}')::numeric into inside_fee
    from public.store_settings where key = 'delivery_fee_inside_sylhet';
  select (value #>> '{}')::numeric into outside_fee
    from public.store_settings where key = 'delivery_fee_outside_sylhet';
  select (value #>> '{}')::numeric into threshold
    from public.store_settings where key = 'free_delivery_threshold';
  select (value #>> '{}')::boolean into offer_enabled
    from public.store_settings where key = 'free_delivery_enabled';

  inside_fee    := greatest(coalesce(inside_fee, 60), 0);
  outside_fee   := greatest(coalesce(outside_fee, 120), 0);
  threshold     := greatest(coalesce(threshold, 1500), 0);
  offer_enabled := coalesce(offer_enabled, true);

  if p_zone is distinct from 'inside_sylhet' then
    return outside_fee;
  end if;

  if offer_enabled and coalesce(p_subtotal, 0) >= threshold then
    return 0;
  end if;

  return inside_fee;
end;
$$;

-- Kept for the saved address book and anything else still holding a division.
-- Now a thin wrapper, so there is one implementation of the rule rather than
-- two that can drift.
create or replace function public.calculate_delivery_fee(
  p_subtotal numeric,
  p_division text
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  offer_division text;
begin
  select (value #>> '{}') into offer_division
    from public.store_settings where key = 'free_delivery_division';
  offer_division := coalesce(nullif(trim(offer_division), ''), 'Sylhet');

  return public.calculate_delivery_fee_for_zone(
    p_subtotal,
    case
      when lower(trim(coalesce(p_division, ''))) = lower(offer_division)
        then 'inside_sylhet'
      else 'outside_sylhet'
    end
  );
end;
$$;

-- PUBLIC is stripped first: PostgreSQL grants EXECUTE on a new function to
-- PUBLIC by default, and migration 0012's blanket revoke ran before this file
-- created it. Granting the two roles explicitly keeps the intent visible.
revoke execute on function public.calculate_delivery_fee_for_zone(numeric, text) from public;
grant execute on function public.calculate_delivery_fee_for_zone(numeric, text)
  to anon, authenticated;
grant execute on function public.calculate_delivery_fee(numeric, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Normalising a shipping address, in either shape
-- ---------------------------------------------------------------------------

-- Returns the canonical shipping jsonb plus the delivery zone, or null when the
-- address cannot be delivered to.
--
-- Accepts BOTH shapes. The current checkout sends address/city/deliveryZone; a
-- caller still sending fullAddress/division/district has the division resolved
-- against the real geography and mapped to a zone. Neither shape is guessed
-- into the other: a legacy order keeps its division, and a zone-based order
-- does not acquire an invented one.
create or replace function public.normalize_shipping_address(p_address jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  street text := nullif(trim(coalesce(
    p_address ->> 'address', p_address ->> 'fullAddress', '')), '');
  apartment text := nullif(trim(coalesce(p_address ->> 'apartment', '')), '');
  city text := nullif(trim(coalesce(p_address ->> 'city', '')), '');
  postal text := nullif(trim(coalesce(p_address ->> 'postalCode', '')), '');
  zone text := nullif(trim(coalesce(p_address ->> 'deliveryZone', '')), '');
  legacy jsonb;
  offer_division text;
  result jsonb;
begin
  if street is null or length(street) < 8 then
    return null;
  end if;

  if zone is not null and zone not in ('inside_sylhet', 'outside_sylhet') then
    return null;
  end if;

  -- Legacy shape: derive the city and the zone from the division/district pair
  -- rather than rejecting a caller that has not been updated yet.
  if zone is null then
    legacy := public.resolve_shipping_location(
      p_address ->> 'division', p_address ->> 'district'
    );
    if legacy is null then
      return null;
    end if;

    select (value #>> '{}') into offer_division
      from public.store_settings where key = 'free_delivery_division';
    offer_division := coalesce(nullif(trim(offer_division), ''), 'Sylhet');

    zone := case
      when lower(legacy ->> 'division') = lower(offer_division) then 'inside_sylhet'
      else 'outside_sylhet'
    end;
    city := coalesce(city, legacy ->> 'district');

    -- The division and district really were collected, so they are kept.
    result := jsonb_build_object(
      'address', street,
      'city', city,
      'deliveryZone', zone,
      'country', 'Bangladesh',
      'division', legacy ->> 'division',
      'district', legacy ->> 'district'
    );
  else
    if city is null or length(city) < 2 then
      return null;
    end if;
    result := jsonb_build_object(
      'address', street,
      'city', city,
      'deliveryZone', zone,
      'country', 'Bangladesh'
    );
  end if;

  if apartment is not null then
    result := result || jsonb_build_object('apartment', apartment);
  end if;
  if postal is not null then
    -- Optional, and only stored when it looks like one. A four-digit shape is
    -- checked; membership of a real list is not, because rejecting a valid
    -- address over an unfamiliar code is worse than storing an unusual one.
    if postal ~ '^[0-9]{4}$' then
      result := result || jsonb_build_object('postalCode', postal);
    end if;
  end if;

  return result;
end;
$$;

revoke execute on function public.normalize_shipping_address(jsonb) from public;
grant execute on function public.normalize_shipping_address(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. place_order() -- zone-based delivery, both address shapes
-- ---------------------------------------------------------------------------

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
  new_tracking_token text := substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  );
  current_user_id uuid := auth.uid();
  v_customer_phone text;
  normalised_address jsonb;
  shipping_zone text;
  calculated_subtotal numeric(12,2) := 0;
  calculated_delivery numeric(12,2) := 0;
  calculated_discount numeric(12,2) := 0;
  coupon_result jsonb;
  coupon_row public.coupons%rowtype;
  cod_enabled boolean;
  order_total numeric(12,2);
  risk text[] := '{}';
  distinct_lines integer;
begin
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

  v_customer_phone := public.normalize_bd_phone(p_customer ->> 'phone');
  if length(trim(coalesce(p_customer ->> 'name', ''))) < 2
     or v_customer_phone is null then
    raise exception 'invalid_customer_or_address';
  end if;

  -- The address is normalised and validated before any stock is locked, any
  -- coupon is spent, or any row is written.
  normalised_address := public.normalize_shipping_address(p_shipping_address);
  if normalised_address is null then
    raise exception 'invalid_shipping_location';
  end if;
  shipping_zone := normalised_address ->> 'deliveryZone';

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  select (value #>> '{}')::boolean into cod_enabled
  from public.store_settings where key = 'cod_enabled';
  cod_enabled := coalesce(cod_enabled, true);
  if not cod_enabled then
    raise exception 'cod_disabled';
  end if;

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
      v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en,
      v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
      p.name_en, p.product_code
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

  -- Priced from the zone the customer chose, by the same function the
  -- storefront quotes from.
  calculated_delivery := public.calculate_delivery_fee_for_zone(
    calculated_subtotal, shipping_zone
  );

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
    normalised_address, nullif(trim(coalesce(p_customer_note, '')), ''),
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

  perform set_config('tara.stock_write', 'on', true);

  for line in
    select (element ->> 'variantId')::uuid as variant_id,
           sum((element ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as element
    group by 1
    order by 1
  loop
    select
      v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en,
      v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
      p.name_en, p.product_code,
      coalesce((
        select image_url from public.product_images
        where product_id = p.id order by is_primary desc, sort_order limit 1
      ), '') as image_url
    into variant_record
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = line.variant_id;

    insert into public.order_items (
      order_id, product_id, product_variant_id, product_name_en,
      product_code, sku, size, colour_en, unit_price, quantity,
      line_total, product_image_url
    ) values (
      new_order_id, variant_record.product_id, variant_record.variant_id,
      variant_record.name_en, variant_record.product_code,
      variant_record.sku, variant_record.size, variant_record.colour_en,
      variant_record.price, line.quantity,
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
