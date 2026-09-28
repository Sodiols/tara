/*
TARA MIGRATION 0027 -- Secure, immutable order numbers and tracking tokens

Run after 0026_launch_offer_and_first_party_analytics.sql. Safe to re-run.

WHAT CHANGES
------------
An order has three identities and this migration keeps them apart:

  id              uuid primary key. Internal. Unchanged.
  order_number    was  TARA-YYYYMMDD-NNNNNN  from public.order_number_seq --
                  sequential, so one order number told you roughly how many
                  orders the store takes and what the neighbouring ones were.
                  now  TARA-YY-MM-XXXXXXXXXX: brand, year and month of creation
                  (Asia/Dhaka), then 10 random symbols (50 bits).
  tracking_token  was  48 lowercase hex characters from two v4 UUIDs.
                  now  TRK-XXXXXXXXXXXXXXXXXXXX: 20 random symbols (100 bits),
                  and it becomes the key of the public page /track/<token>.

The random symbols come from a 32-character alphabet with no 0/O or 1/I:

  ABCDEFGHJKLMNPQRSTUVWXYZ23456789

WHERE THE RANDOMNESS COMES FROM
-------------------------------
gen_random_uuid(). Not Math.random(), not random(), and not pgcrypto's
gen_random_bytes(): that lives in the `extensions` schema on Supabase and could
not be resolved from place_order()'s empty search_path, which is exactly the
outage migration 0006 fixed. gen_random_uuid() is a pg_catalog built-in backed
by pg_strong_random() -- the same OS CSPRNG gen_random_bytes() uses.

A v4 UUID is 16 bytes of which 6 bits are fixed: the high nibble of byte 6
(version) and the top two bits of byte 8 (variant). secure_random_code() skips
byte 6 entirely and takes the LOW five bits of every other byte, which are all
uniformly random -- including byte 8's. Five bits index a 32-symbol alphabet
exactly, so there is no modulo bias.

Neither value is derived from the id, the customer, the phone, the email, the
address, the other identifier, a sequence or anything else about the order.
The order number's YY-MM is the only non-random part, and it is the public
creation month by design.

COLLISIONS
----------
The UNIQUE constraints are the protection. place_order() draws both values,
attempts the insert inside a savepoint, and only if that insert is rejected by
the unique constraint on order_number or tracking_token does it draw again, up
to five attempts. Any other error -- including the idempotency key's own unique
constraint -- is re-raised unchanged. There is no check-then-insert.

IMMUTABILITY
------------
A BEFORE UPDATE trigger rejects any change to order_number or tracking_token,
for every role including the table owner. Status, payment, notes, archive state
and every other column update exactly as before. Permanent deletion is a
DELETE and is unaffected.

A BEFORE INSERT trigger requires every NEW row to carry identifiers in the new
shape. Nothing but place_order() can insert an order (INSERT on public.orders
was revoked from anon and authenticated in 0002/0012 and is not re-granted
here), so in practice this is the belt to that braces.

EXISTING ORDERS
---------------
Kept exactly as they are. Their order numbers are printed on invoices and
sitting in customers' inboxes, their tokens are ~180-bit secrets already mailed
to customers, and both are now immutable. The legacy shapes are recognised
everywhere a token or number is validated, so old tracking details keep
working -- at the new /track/<token> page as well.

There is deliberately no CHECK constraint on the format: a CHECK is evaluated on
every UPDATE of a row, so a legacy row in an unexpected shape would make its
status impossible to change. The INSERT trigger enforces the format for new
rows instead, without touching old ones.

If any row somehow has no order number or no token (the column was added with
ADD COLUMN IF NOT EXISTS in the baseline, so an old database could), it is given
one here: the order number from that order's own created_at year and month plus
fresh randomness, and a fresh TRK- token.

THE TOKEN IS NOW IN A URL
-------------------------
Until now the token was deliberately never put in a URL, because anyone holding
it (plus the order number) could download the full receipt: name, phone and
address. A tracking link is meant to be forwarded, bookmarked and opened on a
courier's phone, so the token alone must not be worth more than the status
page. Therefore:

  * get_order_tracking(token) returns an explicit allowlist -- order number,
    status, dates, item names and quantities, the amount due, the delivery zone
    and the customer-visible timeline. No name, phone, email, address, ids,
    notes, fingerprint, idempotency key or risk flags.
  * get_guest_order_tracking(number, token) now returns that same allowlist.
  * get_customer_receipt() still admits the signed-in owner at any time, but a
    token holder only within the first hour after the order was placed -- the
    confirmation screen, which is the only place a guest downloads it. The
    order_placed email carries the PDF as an attachment, so nothing is lost.

VERIFY
------
  select public.generate_order_number(now());   -- TARA-26-09-XXXXXXXXXX
  select public.generate_tracking_token();      -- TRK-XXXXXXXXXXXXXXXXXXXX
  update public.orders set order_number = 'x' where false;  -- fine: no rows
  -- on a real row, either assignment raises order_identifiers_immutable
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Generation
-- ---------------------------------------------------------------------------

create or replace function public.secure_random_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  raw bytea;
  i integer;
begin
  if p_length is null or p_length < 1 or p_length > 64 then
    raise exception 'invalid_random_code_length';
  end if;

  while length(result) < p_length loop
    raw := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    for i in 0..15 loop
      -- Byte 6 carries the UUID version in its high nibble, which would leave
      -- bit 4 of the low five bits fixed. Every other byte's low five are random.
      continue when i = 6;
      exit when length(result) >= p_length;
      result := result || substr(alphabet, (get_byte(raw, i) & 31) + 1, 1);
    end loop;
  end loop;

  return result;
end;
$$;

-- Replaces the sequence-based generator from the baseline. The zero-argument
-- form is dropped rather than left behind as a way to mint sequential numbers.
drop function if exists public.generate_order_number();

create or replace function public.generate_order_number(p_created_at timestamptz default now())
returns text
language sql
volatile
set search_path = ''
as $$
  select 'TARA-'
    || to_char(coalesce(p_created_at, now()) at time zone 'Asia/Dhaka', 'YY-MM')
    || '-' || public.secure_random_code(10);
$$;

create or replace function public.generate_tracking_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'TRK-' || public.secure_random_code(20);
$$;

-- ---------------------------------------------------------------------------
-- 2. Recognition
-- ---------------------------------------------------------------------------

-- The shape every order number issued from this migration on has.
create or replace function public.is_current_order_number(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_value ~ '^TARA-[0-9]{2}-(0[1-9]|1[0-2])-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$',
    false
  );
$$;

-- Current or legacy. Used wherever an order number arrives from outside.
create or replace function public.is_valid_order_number(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    public.is_current_order_number(p_value) or p_value ~ '^TARA-[0-9]{8}-[0-9]{6,}$',
    false
  );
$$;

-- The shape every token issued from this migration on has.
create or replace function public.is_current_tracking_token(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_value ~ '^TRK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$', false);
$$;

-- Current or legacy. Used before every token lookup, so a malformed value is
-- refused without touching the table and never becomes a pattern.
create or replace function public.is_valid_tracking_token(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    public.is_current_tracking_token(p_value) or p_value ~ '^[0-9a-f]{48}$',
    false
  );
$$;

-- True when a unique_violation's constraint is the one on order_number or on
-- tracking_token -- whatever that constraint happens to be named on this
-- database. Anything else is a real error and place_order() re-raises it.
create or replace function public.is_order_identifier_constraint(p_constraint text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    join pg_catalog.pg_attribute a
      on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.orders'::regclass
      and i.indisunique
      and i.indnkeyatts = 1
      and c.relname = p_constraint
      and a.attname in ('order_number', 'tracking_token')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Existing rows: fill anything missing, never rewrite anything present
-- ---------------------------------------------------------------------------

do $$
declare
  missing record;
  attempt integer;
begin
  for missing in
    select id, created_at from public.orders where order_number is null
  loop
    attempt := 0;
    loop
      attempt := attempt + 1;
      begin
        update public.orders
          set order_number = public.generate_order_number(missing.created_at)
          where id = missing.id;
        exit;
      exception when unique_violation then
        if attempt >= 5 then raise; end if;
      end;
    end loop;
  end loop;

  for missing in
    select id from public.orders where tracking_token is null
  loop
    attempt := 0;
    loop
      attempt := attempt + 1;
      begin
        update public.orders
          set tracking_token = public.generate_tracking_token()
          where id = missing.id;
        exit;
      exception when unique_violation then
        if attempt >= 5 then raise; end if;
      end;
    end loop;
  end loop;
end;
$$;

alter table public.orders alter column order_number set not null;
alter table public.orders alter column tracking_token set not null;

-- The baseline declares both UNIQUE, but tracking_token also arrived through
-- ADD COLUMN IF NOT EXISTS, which on an old database adds the column without
-- the constraint. Make sure a single-column unique index exists for each.
do $$
declare
  target text;
  column_number smallint;
begin
  foreach target in array array['order_number', 'tracking_token'] loop
    select attnum into column_number
    from pg_catalog.pg_attribute
    where attrelid = 'public.orders'::regclass and attname = target and not attisdropped;

    if not exists (
      select 1 from pg_catalog.pg_index
      where indrelid = 'public.orders'::regclass
        and indisunique and indnkeyatts = 1
        and indkey[0] = column_number
        and indpred is null
    ) then
      execute format(
        'alter table public.orders add constraint %I unique (%I)',
        'orders_' || target || '_key', target
      );
    end if;
  end loop;
end;
$$;

-- The unique indexes serve exact lookups by either value. This one is for the
-- admin search box, which filters with ILIKE '%term%'; it is created only
-- where pg_trgm is installed, and the migration does not depend on it.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_trgm') then
    execute (
      select format(
        'create index if not exists orders_order_number_trgm_idx on public.orders using gin (order_number %I.gin_trgm_ops)',
        n.nspname
      )
      from pg_catalog.pg_extension e
      join pg_catalog.pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'pg_trgm'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Immutability, and the new shape for every new row
-- ---------------------------------------------------------------------------

create or replace function public.orders_identifiers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_current_order_number(new.order_number) then
      raise exception 'invalid_order_number';
    end if;
    if not public.is_current_tracking_token(new.tracking_token) then
      raise exception 'invalid_tracking_token';
    end if;
    return new;
  end if;

  if new.order_number is distinct from old.order_number
    or new.tracking_token is distinct from old.tracking_token then
    raise exception 'order_identifiers_immutable'
      using errcode = 'restrict_violation',
            detail = 'order_number and tracking_token cannot change after an order is created.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_identifiers_guard on public.orders;
create trigger orders_identifiers_guard
  before insert or update on public.orders
  for each row execute function public.orders_identifiers_guard();

-- ---------------------------------------------------------------------------
-- 5. place_order(): identifiers drawn inside the transaction, retried only on
--    an identifier collision
--
-- Reproduced from 0026 with exactly two changes: the tracking token is no
-- longer computed in DECLARE, and the orders INSERT sits in the retry loop
-- below. Validation, rate limits, idempotency, stock locking, pricing, the
-- coupon, the launch offer, order items, stock deduction, the timeline, the
-- outbox and the cart clear are byte-for-byte 0026. The signature is
-- unchanged: there is still no parameter through which a caller could name an
-- order number or a token.
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
  -- 0027: both identifiers are drawn fresh for every insert attempt, just
  -- before the insert, rather than once up here. See the retry loop below.
  new_tracking_token text;
  identifier_attempt integer := 0;
  violated_constraint text;
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
  -- New in 0026: the launch offer. Collected while pricing, decided after the
  -- coupon, applied before the total.
  ordered_product_ids uuid[] := '{}';
  first_order boolean;
  offer jsonb;
  offer_discount numeric(12,2) := 0;
  offer_label text;
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
    if not (variant_record.product_id = any(ordered_product_ids)) then
      ordered_product_ids := array_append(ordered_product_ids, variant_record.product_id);
    end if;
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

  /*
  * THE LAUNCH OFFER (new in 0026)
  *
  * Nothing about it comes from the browser. The offer is re-read here, its
  * dates are re-checked here, and whether these products take part is
  * re-checked here -- so an expired offer cannot be applied, a disabled one
  * cannot be applied, and a customer cannot name one.
  *
  * "First order" means this phone number has never placed an order and, if
  * they are signed in, neither has the account. Cancelled orders still count
  * as having ordered: the offer is for new customers, not for people who have
  * ordered and cancelled.
  *
  * It stacks with a coupon, and the combined discount is clamped so it can
  * never exceed the goods -- delivery is never discounted by a money offer,
  * only waived outright by a free-delivery offer.
  */
  first_order := not exists (
    select 1 from public.orders o
    where o.normalized_phone = v_customer_phone
      or (current_user_id is not null and o.user_id = current_user_id)
  );

  offer := public.launch_offer_benefit(
    calculated_subtotal, ordered_product_ids, first_order
  );

  if offer is not null then
    offer_label := offer ->> 'label';
    if coalesce((offer ->> 'freeDelivery')::boolean, false) then
      calculated_delivery := 0;
    end if;
    offer_discount := greatest(coalesce((offer ->> 'discount')::numeric, 0), 0);
    -- Never below zero goods: the coupon has already taken its share.
    offer_discount := least(
      offer_discount,
      greatest(calculated_subtotal - calculated_discount, 0)
    );
    calculated_discount := calculated_discount + offer_discount;
  end if;

  order_total := calculated_subtotal + calculated_delivery - calculated_discount;
  if order_total < 0 then
    raise exception 'invalid_total';
  end if;

  /*
   * 0027: THE ORDER ROW, WITH ITS TWO PUBLIC IDENTIFIERS
   *
   * Everything above -- validation, rate limits, stock locks, pricing, the
   * coupon, the launch offer -- has already happened in this transaction and is
   * not repeated. Only the insert is retried, and only for one reason: the
   * UNIQUE constraint on order_number or tracking_token rejected a freshly
   * drawn random value. That is the collision protection; nothing checks for
   * existence first, because a check-then-insert races.
   *
   * The inner BEGIN ... EXCEPTION block is a savepoint, so a rejected attempt
   * rolls back that one insert and nothing else. Any other unique violation --
   * the idempotency key, above all, when two identical requests race -- and any
   * other error at all is re-raised unchanged, so the customer sees exactly the
   * error they would have seen before this migration. Five attempts is far
   * beyond need: with 50 random bits behind each month prefix, even ten
   * thousand orders in one month have roughly a one-in-twenty-million chance
   * of a single collision, and a second in a row is effectively impossible.
   */
  loop
    identifier_attempt := identifier_attempt + 1;
    new_order_number := public.generate_order_number(now());
    new_tracking_token := public.generate_tracking_token();
    begin
      insert into public.orders (
        id, order_number, user_id, customer_name, customer_email, customer_phone,
        normalized_phone, payment_method, delivery_method, subtotal, delivery_fee,
        discount_amount, total, shipping_address, customer_note, tracking_token,
        idempotency_key, client_fingerprint, risk_flags,
        launch_offer_discount, launch_offer_label
      ) values (
        new_order_id, new_order_number, current_user_id,
        trim(p_customer ->> 'name'), nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), ''),
        v_customer_phone, v_customer_phone,
        'cash_on_delivery'::public.payment_method,
        'standard'::public.delivery_method,
        calculated_subtotal, calculated_delivery, calculated_discount, order_total,
        normalised_address, nullif(trim(coalesce(p_customer_note, '')), ''),
        new_tracking_token, nullif(trim(coalesce(p_idempotency_key, '')), ''),
        p_client_fingerprint, risk,
        offer_discount, offer_label
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if identifier_attempt >= 5
        or not public.is_order_identifier_constraint(violated_constraint) then
        raise;
      end if;
    end;
  end loop;

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
      coalesce(
        (
          -- The photograph of the colour that was actually bought, when the
          -- variant carries one and that colour has images of its own.
          select i.image_url from public.product_images i
          where i.product_id = p.id
            and v.product_colour_id is not null
            and i.product_colour_id = v.product_colour_id
          order by i.is_primary desc, i.sort_order, i.id limit 1
        ),
        (
          select i.image_url from public.product_images i
          where i.product_id = p.id
          order by i.is_primary desc, i.sort_order, i.id limit 1
        ),
        ''
      ) as image_url
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

-- ---------------------------------------------------------------------------
-- 6. The public tracking page: /track/<token>
--
-- The token is the only input. It is validated against the two known shapes
-- before the table is read, and then matched exactly through the unique index:
-- no LIKE, no prefix, no case folding in SQL, no partial token.
--
-- The response is an allowlist, built field by field. Anyone holding a
-- tracking link -- a relative the customer forwarded it to, a courier -- sees
-- where the parcel is and what is due on delivery. They do not see who it is
-- for or where it is going.
-- ---------------------------------------------------------------------------

create or replace function public.get_order_tracking(p_tracking_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.status,
    'placedAt', o.created_at,
    'updatedAt', o.updated_at,
    'paymentMethod', o.payment_method,
    'deliveryZone', o.shipping_address ->> 'deliveryZone',
    'total', o.total,
    'currency', o.currency,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productName', oi.product_name_en,
          'size', oi.size,
          'colour', oi.colour_en,
          'quantity', oi.quantity,
          'imageUrl', oi.product_image_url
        ) order by oi.created_at, oi.id
      )
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', e.status,
          'note', e.note_en,
          'createdAt', e.created_at
        ) order by e.created_at, e.id
      )
      from public.order_tracking_events e
      where e.order_id = o.id and e.is_customer_visible
    ), '[]'::jsonb)
  )
  from public.orders o
  where public.is_valid_tracking_token(p_tracking_token)
    and o.tracking_token = p_tracking_token;
$$;

-- The older form lookup (order number + token). It used to return the name and
-- full address; it now returns exactly what the public page returns, so a
-- client still calling it during a deploy keeps working and learns no more.
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
  select public.get_order_tracking(o.tracking_token)
  from public.orders o
  where public.is_valid_tracking_token(trim(p_tracking_token))
    and o.tracking_token = trim(p_tracking_token)
    and o.order_number = upper(trim(p_order_number));
$$;

-- ---------------------------------------------------------------------------
-- 7. Token checks that assumed a 48-character token
--
-- Both of these refused anything shorter than 32 characters, which every new
-- TRK- token (24 characters) is. They now accept exactly the two real shapes.
-- ---------------------------------------------------------------------------

-- Reproduced from 0010. Only the guard changed.
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
  if not public.is_valid_tracking_token(trim(coalesce(p_tracking_token, ''))) then
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

-- Reproduced from 0015. The guard changed, and the token path now closes an
-- hour after the order was placed: the token is in a shareable URL from this
-- migration on, and a receipt carries the name, phone and address. The signed-in
-- owner's path is unchanged.
create or replace function public.get_customer_receipt(
  p_order_number text,
  p_tracking_token text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'createdAt', o.created_at,
      'customerName', o.customer_name,
      'customerEmail', o.customer_email,
      'customerPhone', o.customer_phone,
      'shippingAddress', o.shipping_address,
      'status', o.status,
      'paymentMethod', o.payment_method,
      'subtotal', o.subtotal,
      'deliveryFee', o.delivery_fee,
      'discountAmount', o.discount_amount,
      'total', o.total,
      'currency', o.currency
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'productName', oi.product_name_en,
        'productCode', oi.product_code,
        'sku', oi.sku,
        'size', oi.size,
        'colour', oi.colour_en,
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity,
        'lineTotal', oi.line_total
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = trim(coalesce(p_order_number, ''))
    and (
      (auth.uid() is not null and o.user_id = auth.uid())
      or (
        public.is_valid_tracking_token(trim(coalesce(p_tracking_token, '')))
        and o.tracking_token = trim(p_tracking_token)
        and o.created_at > now() - interval '1 hour'
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
--
-- The generators and the trigger are reachable only from SECURITY DEFINER code
-- (place_order, the trigger itself). Supabase grants EXECUTE on new public
-- functions to anon and authenticated by default, so they are revoked
-- explicitly: a browser has no business minting identifiers, even useless ones.
-- ---------------------------------------------------------------------------

revoke execute on function public.secure_random_code(integer) from public, anon, authenticated;
revoke execute on function public.generate_order_number(timestamptz) from public, anon, authenticated;
revoke execute on function public.generate_tracking_token() from public, anon, authenticated;
revoke execute on function public.is_order_identifier_constraint(text) from public, anon, authenticated;
revoke execute on function public.orders_identifiers_guard() from public, anon, authenticated;

revoke execute on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text) to anon, authenticated;

-- Restated so a database repaired out of order still ends up correct.
revoke execute on function public.get_guest_order_tracking(text, text) from public;
grant execute on function public.get_guest_order_tracking(text, text) to anon, authenticated;
revoke execute on function public.claim_order_notifications(text, text) from public;
grant execute on function public.claim_order_notifications(text, text) to anon, authenticated;
revoke execute on function public.get_customer_receipt(text, text) from public;
grant execute on function public.get_customer_receipt(text, text) to anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text, text, text)
  to anon, authenticated;

-- Unchanged, and asserted here because everything above depends on it: no
-- client role can write an order row, so no client can choose its identifiers.
revoke insert, update, delete on table public.orders from anon, authenticated;

commit;
