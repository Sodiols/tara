/*
TARA MIGRATION 0004 — Cash on delivery only, single delivery option

Run after 0003_fix_anon_permission_grants.sql. Safe to re-run.

WHAT CHANGES
------------
The store offers exactly one delivery option and exactly one payment method.
This migration makes the database agree, so the rule holds even if a request
reaches place_order() without going through the checkout form.

  * `p_delivery_method` is ignored. Every new order is 'standard' and is priced
    at the standard fee, waived above the free-delivery threshold.
  * `p_payment_method` is ignored. Every new order is 'cash_on_delivery'.
  * The `express_delivery_fee` and `online_payment_enabled` settings are hidden
    from the storefront so nothing can advertise a method the store will not
    accept.

WHAT IS DELIBERATELY NOT CHANGED
--------------------------------
The `delivery_method` and `payment_method` columns and their enum types stay.
Historical orders placed as 'express' keep their real value, and their invoices
and packing slips keep printing what the customer actually paid for. Dropping
an enum value would rewrite history, and re-adding express later would then be
a schema change rather than a settings change.

The `cod_enabled` setting also stays: switching COD off is the store's kill
switch for taking new orders, and remains enforced inside place_order().
*/

begin;

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
  -- 48 hex characters from two v4 UUIDs. NOT gen_random_bytes(): that lives
  -- in the pgcrypto extension and cannot be resolved under `search_path = ''`,
  -- which made every single call to this function fail with 42883.
  new_tracking_token text := substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  );
  current_user_id uuid := auth.uid();
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

  -- English only: note_bn is nullable and deliberately left unset.
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

-- Hide the settings the store no longer uses. They are kept (rather than
-- deleted) so re-enabling either later is a one-line update, not a migration —
-- but they are no longer world-readable, so nothing on the storefront can
-- advertise a delivery or payment option the checkout will not accept.
update public.store_settings
  set is_public = false
  where key in ('express_delivery_fee', 'online_payment_enabled');

commit;

/*
VERIFY

  select key, value, is_public from public.store_settings
  where key in ('express_delivery_fee', 'online_payment_enabled',
                'standard_delivery_fee', 'free_delivery_threshold', 'cod_enabled')
  order by key;
  -- express_delivery_fee and online_payment_enabled must show is_public = false

Historical orders are untouched:

  select delivery_method, payment_method, count(*)
  from public.orders group by 1, 2;
*/
