/*
TARA MIGRATION 0002 — Production hardening

Run AFTER 0001_role_and_status_enums.sql (which must be executed on its own
because PostgreSQL forbids using a freshly added enum value in the same
transaction that created it).

This migration is additive and idempotent. It does not drop or rename any
existing table or column, so existing customers, orders, products and images
are preserved.

What it does
  1.  New columns on existing tables (SEO, moderation, fulfilment metadata)
  2.  New tables: audit log, inventory adjustments, internal order notes,
      rate-limit buckets, notification outbox, order status transitions
  3.  Role -> permission model (replaces "is_staff() means everything")
  4.  Bangladesh phone normalisation + rate limiting helpers
  5.  place_order() rewritten: duplicate-line oversell fix, coupon locking,
      per-customer coupon limits, idempotency, COD abuse throttling
  6.  Order status state machine with audited transitions, and a hard split
      between customer-visible tracking and private internal notes
  7.  Audited inventory adjustments; direct stock writes blocked
  8.  Admin RPCs for dashboard, analytics, moderation, settings and roles
  9.  Integrity constraints and query indexes
  10. Tightened RLS policies and table/function grants
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns on existing tables
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz;

alter table public.products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists material_en text not null default '',
  add column if not exists material_bn text not null default '',
  add column if not exists size_guide_note_en text not null default '',
  add column if not exists size_guide_note_bn text not null default '',
  add column if not exists archived_at timestamptz;

alter table public.categories
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.collections
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.coupons
  add column if not exists per_customer_limit integer,
  add column if not exists archived_at timestamptz;

alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists client_fingerprint text,
  add column if not exists normalized_phone text,
  add column if not exists stock_restored_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists risk_flags text[] not null default '{}';

alter table public.order_tracking_events
  add column if not exists is_customer_visible boolean not null default true;

alter table public.contact_messages
  add column if not exists handled_by uuid references public.profiles(id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists staff_note text,
  add column if not exists subject text;

alter table public.newsletter_subscribers
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists source text not null default 'website';

alter table public.reviews
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderation_note text;

alter table public.store_settings
  add column if not exists is_public boolean not null default false,
  add column if not exists label text;

alter table public.product_variants
  add column if not exists reserved_quantity integer not null default 0;

-- Existing tracking events written by the previous admin function put staff
-- notes straight into note_en, and the old guest-tracking RPC returned them
-- verbatim to anyone with an order number + token. Anything authored by a
-- staff member is retroactively treated as private; new writes go through the
-- explicit customer-note / internal-note split below.
update public.order_tracking_events
  set is_customer_visible = false
  where created_by is not null
    and (coalesce(note_en, '') <> '' or coalesce(note_bn, '') <> '')
    and is_customer_visible;

-- Backfill the normalised phone used for duplicate/abuse detection.
update public.orders
  set normalized_phone = regexp_replace(customer_phone, '^(\+?88)', '')
  where normalized_phone is null;

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text not null default '',
  actor_role text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  previous_quantity integer not null,
  new_quantity integer not null,
  delta integer not null,
  reason text not null,
  note text,
  adjusted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Internal staff notes live in their own table so no public tracking query can
-- ever reach them, even by accident. Nothing here is granted to anon.
create table if not exists public.order_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.request_throttle (
  bucket text not null,
  identifier text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (bucket, identifier)
);

-- Transactional notifications are recorded here even when no email provider is
-- configured, so nothing is lost and a provider can drain the queue later.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email',
  template text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  required_permission text not null,
  primary key (from_status, to_status)
);

insert into public.order_status_transitions (from_status, to_status, required_permission) values
  ('pending',    'confirmed',  'orders.fulfil'),
  ('pending',    'cancelled',  'orders.cancel'),
  ('confirmed',  'processing', 'orders.fulfil'),
  ('confirmed',  'cancelled',  'orders.cancel'),
  ('processing', 'packed',     'orders.fulfil'),
  ('processing', 'cancelled',  'orders.cancel'),
  ('packed',     'shipped',    'orders.fulfil'),
  ('packed',     'cancelled',  'orders.cancel'),
  ('shipped',    'delivered',  'orders.fulfil'),
  ('shipped',    'returned',   'orders.cancel'),
  ('delivered',  'returned',   'orders.cancel')
on conflict (from_status, to_status) do update
  set required_permission = excluded.required_permission;

-- ---------------------------------------------------------------------------
-- 3. Role -> permission model
-- ---------------------------------------------------------------------------

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid() and is_active),
    'anonymous'
  );
$$;

/*
Permission keys
  catalogue.manage   products, images, variants, categories, collections
  inventory.adjust   change stock with an audited reason
  orders.view        read orders and order detail
  orders.fulfil      move an order forward through the fulfilment pipeline
  orders.cancel      cancel an order or record a return
  orders.payment     change payment status independently of fulfilment
  orders.note        add an internal note to an order
  customers.view     read customer profiles and their order history
  customers.manage   deactivate / reactivate a customer account
  coupons.manage     create, edit, disable, archive coupons
  reviews.moderate   approve or reject reviews
  messages.manage    read and progress contact messages
  newsletter.manage  read, export, unsubscribe newsletter members
  settings.manage    change store settings
  staff.manage       change staff roles
  audit.view         read the admin audit log
  analytics.view     read the analytics dashboard
*/
create or replace function public.role_permissions(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','customers.manage','coupons.manage',
      'reviews.moderate','messages.manage','newsletter.manage','settings.manage',
      'staff.manage','audit.view','analytics.view'
    ]
    -- 'staff' is the legacy pre-migration role; it maps to manager so existing
    -- staff accounts keep working with no data change.
    when 'staff' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','coupons.manage','reviews.moderate',
      'messages.manage','newsletter.manage','analytics.view'
    ]
    when 'manager' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','coupons.manage','reviews.moderate',
      'messages.manage','newsletter.manage','analytics.view'
    ]
    when 'fulfilment' then array[
      'orders.view','orders.fulfil','orders.note','inventory.adjust'
    ]
    when 'support' then array[
      'orders.view','orders.note','customers.view','messages.manage'
    ]
    else array[]::text[]
  end;
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_permission = any (public.role_permissions(public.current_role_name()));
$$;

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select public.role_permissions(public.current_role_name());
$$;

-- Any back-office role. Kept with the original name and semantics so every
-- existing RLS policy that references it continues to work unchanged.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and role::text in ('admin', 'staff', 'manager', 'fulfilment', 'support')
  );
$$;

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role::text = 'admin'
  );
$$;

create or replace function public.require_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_permission) then
    raise exception 'permission_denied:%', p_permission
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Audit log writer
-- ---------------------------------------------------------------------------

create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_entity_label text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
begin
  select id, email, role::text as role into actor
  from public.profiles where id = auth.uid();

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_role, action, entity_type, entity_id,
    entity_label, before_value, after_value, reason
  ) values (
    actor.id, coalesce(actor.email, ''), coalesce(actor.role, 'system'),
    p_action, p_entity_type, p_entity_id, p_entity_label, p_before, p_after,
    nullif(trim(coalesce(p_reason, '')), '')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Bangladesh phone normalisation and rate limiting
-- ---------------------------------------------------------------------------

-- Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX and spaced/dashed
-- variants; returns the canonical 11-digit local form, or null if invalid.
create or replace function public.normalize_bd_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
begin
  if p_phone is null then return null; end if;
  digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if digits ~ '^88(01[3-9][0-9]{8})$' then
    digits := substring(digits from 3);
  elsif digits ~ '^(1[3-9][0-9]{8})$' then
    digits := '0' || digits;
  end if;
  if digits ~ '^01[3-9][0-9]{8}$' then
    return digits;
  end if;
  return null;
end;
$$;

-- Fixed-window counter. Returns false once the limit for the window is spent.
-- Deliberately NOT granted to anon/authenticated: only SECURITY DEFINER
-- functions in this schema may consume a bucket, so a client cannot burn
-- another customer's quota.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then
    return true;
  end if;

  insert into public.request_throttle (bucket, identifier, window_started_at, request_count)
  values (p_bucket, p_identifier, now(), 1)
  on conflict (bucket, identifier) do update
    set request_count = case
          when public.request_throttle.window_started_at < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.request_throttle.request_count + 1
        end,
        window_started_at = case
          when public.request_throttle.window_started_at < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.request_throttle.window_started_at
        end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.prune_request_throttle()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.request_throttle where window_started_at < now() - interval '2 days';
$$;

-- ---------------------------------------------------------------------------
-- 6. Stock write guard — all stock movement must be audited
-- ---------------------------------------------------------------------------

create or replace function public.guard_variant_stock_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock_quantity is distinct from old.stock_quantity
     and coalesce(current_setting('tara.stock_write', true), 'off') <> 'on' then
    raise exception 'direct_stock_write_blocked'
      using hint = 'Use admin_adjust_inventory() so the change is recorded in inventory_adjustments.';
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_stock_guard on public.product_variants;
create trigger product_variants_stock_guard
  before update on public.product_variants
  for each row execute function public.guard_variant_stock_write();

-- ---------------------------------------------------------------------------
-- 7. Coupon validation (per-customer limits aware)
-- ---------------------------------------------------------------------------

create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid default null,
  p_phone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons%rowtype;
  discount numeric(12,2) := 0;
  used_by_customer integer := 0;
  actor uuid := coalesce(p_user_id, auth.uid());
  phone text := public.normalize_bd_phone(p_phone);
begin
  if p_subtotal is null or p_subtotal < 0 then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  select * into c
  from public.coupons
  where upper(code) = upper(trim(p_code))
    and is_active
    and archived_at is null
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or usage_count < usage_limit);

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  if p_subtotal < c.minimum_order_amount then
    return jsonb_build_object(
      'valid', false, 'reason', 'minimum_not_met', 'minimum', c.minimum_order_amount
    );
  end if;

  if c.per_customer_limit is not null then
    select count(*) into used_by_customer
    from public.coupon_redemptions r
    join public.orders o on o.id = r.order_id
    where r.coupon_id = c.id
      and o.status not in ('cancelled')
      and (
        (actor is not null and r.user_id = actor)
        or (phone is not null and o.normalized_phone = phone)
      );
    if used_by_customer >= c.per_customer_limit then
      return jsonb_build_object('valid', false, 'reason', 'per_customer_limit');
    end if;
  end if;

  if c.discount_type = 'fixed' then
    discount := least(c.discount_value, p_subtotal);
  else
    discount := round(p_subtotal * c.discount_value / 100, 2);
    if c.maximum_discount_amount is not null then
      discount := least(discount, c.maximum_discount_amount);
    end if;
  end if;

  return jsonb_build_object(
    'valid', true, 'discount', discount, 'coupon_id', c.id, 'code', c.code
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. place_order — rewritten
-- ---------------------------------------------------------------------------

drop function if exists public.place_order(jsonb, jsonb, jsonb, text, text, text, text);

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
  express_fee numeric(12,2);
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

  if p_delivery_method not in ('standard', 'express') then
    raise exception 'invalid_delivery_method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  select (value #>> '{}')::boolean into cod_enabled
  from public.store_settings where key = 'cod_enabled';
  cod_enabled := coalesce(cod_enabled, true);

  if p_payment_method <> 'cash_on_delivery' then
    raise exception 'online_payment_unavailable';
  end if;
  if not cod_enabled then
    raise exception 'cod_disabled';
  end if;

  -- --- COD abuse protection -------------------------------------------------
  -- Anonymous shoppers can place COD orders, so the throttle is keyed on the
  -- phone number (the thing a fake-order flood must reuse) as well as on the
  -- request fingerprint supplied by the application layer.
  if not public.consume_rate_limit('order:phone', v_customer_phone, 5, 3600) then
    raise exception 'rate_limited';
  end if;
  if p_client_fingerprint is not null
     and not public.consume_rate_limit('order:client', p_client_fingerprint, 10, 3600) then
    raise exception 'rate_limited';
  end if;

  -- Same phone, same minute: almost always a double submit rather than two
  -- genuine orders.
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
  -- Lines are aggregated by variant first. Without this, the same variant sent
  -- twice in one payload passes two independent stock checks and oversells.
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
  select (value #>> '{}')::numeric into express_fee
  from public.store_settings where key = 'express_delivery_fee';
  free_threshold := coalesce(free_threshold, 1500);
  standard_fee := coalesce(standard_fee, 100);
  express_fee := coalesce(express_fee, 180);

  calculated_delivery := case
    when p_delivery_method = 'express' then express_fee
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

    -- Re-check the global cap while holding the row lock, so two concurrent
    -- checkouts cannot both slip past the last remaining use.
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
    v_customer_phone, v_customer_phone, p_payment_method::public.payment_method,
    p_delivery_method::public.delivery_method, calculated_subtotal,
    calculated_delivery, calculated_discount, order_total,
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

-- ---------------------------------------------------------------------------
-- 9. Order state machine, notes, and payment status
-- ---------------------------------------------------------------------------

drop function if exists public.admin_update_order_status(uuid, public.order_status, public.payment_status, text);

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

  -- Cancellations always return goods that never left the building.
  -- Returns are opt-in: returned garments usually need inspection before they
  -- become sellable again, so the caller decides explicitly.
  should_restock := coalesce(
    p_restock,
    case when p_status = 'cancelled' then true else false end
  );

  if should_restock and p_status in ('cancelled', 'returned')
     and order_record.stock_restored_at is null then
    perform set_config('tara.stock_write', 'on', true);
    for order_item in
      select product_variant_id, quantity from public.order_items where order_id = p_order_id
    loop
      insert into public.inventory_adjustments (
        product_variant_id, order_id, previous_quantity, new_quantity, delta, reason, note, adjusted_by
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
    order_id, status, note_en, note_bn, created_by, is_customer_visible
  ) values (
    p_order_id, p_status, nullif(trim(coalesce(p_customer_note, '')), ''), null, auth.uid(), true
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

create or replace function public.admin_update_payment_status(
  p_order_id uuid,
  p_payment_status public.payment_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.payment_status;
  order_number text;
begin
  perform public.require_permission('orders.payment');

  select payment_status, orders.order_number into previous, order_number
  from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  update public.orders set payment_status = p_payment_status where id = p_order_id;

  perform public.log_admin_action(
    'order.payment_changed', 'order', p_order_id::text, order_number,
    jsonb_build_object('paymentStatus', previous),
    jsonb_build_object('paymentStatus', p_payment_status),
    p_note
  );

  return jsonb_build_object('ok', true, 'paymentStatus', p_payment_status);
end;
$$;

create or replace function public.admin_add_order_note(p_order_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  perform public.require_permission('orders.note');
  if length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'note_too_short';
  end if;

  insert into public.order_internal_notes (order_id, author_id, author_name, note)
  select p_order_id, auth.uid(), coalesce(pr.full_name, pr.email, ''), trim(p_note)
  from public.profiles pr where pr.id = auth.uid()
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- Guest tracking. Returns only customer-safe fields: no internal notes, no
-- database ids, no staff identities, no risk flags, no fingerprints.
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
          'noteBn', e.note_bn,
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

-- ---------------------------------------------------------------------------
-- 10. Audited inventory adjustment
-- ---------------------------------------------------------------------------

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_new_quantity integer,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant record;
begin
  perform public.require_permission('inventory.adjust');

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'invalid_quantity';
  end if;
  if p_reason not in (
    'restock', 'correction', 'damaged', 'lost', 'return_to_stock', 'transfer', 'other'
  ) then
    raise exception 'invalid_reason';
  end if;

  select v.id, v.sku, v.stock_quantity into variant
  from public.product_variants v where v.id = p_variant_id for update;
  if not found then raise exception 'variant_not_found'; end if;

  if variant.stock_quantity = p_new_quantity then
    return jsonb_build_object('ok', true, 'unchanged', true, 'stock', p_new_quantity);
  end if;

  perform set_config('tara.stock_write', 'on', true);
  update public.product_variants
    set stock_quantity = p_new_quantity
    where id = p_variant_id;
  perform set_config('tara.stock_write', 'off', true);

  insert into public.inventory_adjustments (
    product_variant_id, previous_quantity, new_quantity, delta, reason, note, adjusted_by
  ) values (
    p_variant_id, variant.stock_quantity, p_new_quantity,
    p_new_quantity - variant.stock_quantity, p_reason,
    nullif(trim(coalesce(p_note, '')), ''), auth.uid()
  );

  perform public.log_admin_action(
    'inventory.adjusted', 'product_variant', p_variant_id::text, variant.sku,
    jsonb_build_object('stock', variant.stock_quantity),
    jsonb_build_object('stock', p_new_quantity, 'reason', p_reason),
    p_note
  );

  return jsonb_build_object('ok', true, 'stock', p_new_quantity);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Admin moderation, settings, roles
-- ---------------------------------------------------------------------------

create or replace function public.admin_moderate_review(
  p_review_id uuid,
  p_status public.review_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare previous public.review_status;
begin
  perform public.require_permission('reviews.moderate');
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'invalid_status';
  end if;

  select status into previous from public.reviews where id = p_review_id for update;
  if not found then raise exception 'review_not_found'; end if;

  update public.reviews
    set status = p_status,
        moderated_by = auth.uid(),
        moderated_at = now(),
        moderation_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_review_id;

  perform public.log_admin_action(
    'review.moderated', 'review', p_review_id::text, null,
    jsonb_build_object('status', previous), jsonb_build_object('status', p_status), p_note
  );

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.admin_update_message_status(
  p_message_id uuid,
  p_status public.message_status,
  p_staff_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare previous public.message_status;
begin
  perform public.require_permission('messages.manage');

  select status into previous from public.contact_messages where id = p_message_id for update;
  if not found then raise exception 'message_not_found'; end if;

  update public.contact_messages
    set status = p_status,
        handled_by = auth.uid(),
        handled_at = now(),
        staff_note = coalesce(nullif(trim(coalesce(p_staff_note, '')), ''), staff_note)
    where id = p_message_id;

  perform public.log_admin_action(
    'message.status_changed', 'contact_message', p_message_id::text, null,
    jsonb_build_object('status', previous), jsonb_build_object('status', p_status), p_staff_note
  );

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.admin_set_newsletter_active(
  p_subscriber_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare subscriber_email text;
begin
  perform public.require_permission('newsletter.manage');

  update public.newsletter_subscribers
    set is_active = p_active,
        unsubscribed_at = case when p_active then null else now() end
    where id = p_subscriber_id
    returning email into subscriber_email;
  if subscriber_email is null then raise exception 'subscriber_not_found'; end if;

  perform public.log_admin_action(
    'newsletter.status_changed', 'newsletter_subscriber', p_subscriber_id::text,
    subscriber_email, null, jsonb_build_object('isActive', p_active), null
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- Public, token-free unsubscribe used by the storefront footer link.
create or replace function public.unsubscribe_newsletter(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.consume_rate_limit('newsletter:unsub', lower(trim(p_email)), 5, 3600) then
    raise exception 'rate_limited';
  end if;
  update public.newsletter_subscribers
    set is_active = false, unsubscribed_at = now()
    where email = lower(trim(p_email));
  -- Always reports success so the endpoint cannot be used to enumerate
  -- which addresses are subscribed.
  return true;
end;
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
    id, code, description_en, description_bn, discount_type, discount_value,
    minimum_order_amount, maximum_discount_amount, starts_at, expires_at,
    usage_limit, per_customer_limit, is_active
  ) values (
    coalesce(coupon_id, gen_random_uuid()),
    normalized_code,
    coalesce(p_payload ->> 'descriptionEn', ''),
    coalesce(p_payload ->> 'descriptionBn', ''),
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
    description_bn = excluded.description_bn,
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

create or replace function public.admin_archive_coupon(p_coupon_id uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare coupon_code text;
begin
  perform public.require_permission('coupons.manage');
  update public.coupons
    set archived_at = case when p_archived then now() else null end,
        is_active = case when p_archived then false else is_active end
    where id = p_coupon_id
    returning code into coupon_code;
  if coupon_code is null then raise exception 'coupon_not_found'; end if;

  perform public.log_admin_action(
    case when p_archived then 'coupon.archived' else 'coupon.restored' end,
    'coupon', p_coupon_id::text, coupon_code, null, null, null
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_save_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  before_value jsonb;
begin
  perform public.require_permission('settings.manage');

  select jsonb_object_agg(key, value) into before_value from public.store_settings;

  for entry in select * from jsonb_each(p_settings) loop
    -- Only keys that already exist can be written, so the settings panel can
    -- never be used to smuggle an arbitrary key (for example a fake API
    -- credential) into a table that anon can read.
    if exists (select 1 from public.store_settings s where s.key = entry.key) then
      update public.store_settings
        set value = entry.value, updated_at = now()
        where key = entry.key;
    end if;
  end loop;

  perform public.log_admin_action(
    'settings.updated', 'store_settings', null, null, before_value, p_settings, null
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_profile_role(
  p_profile_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.user_role;
  target_email text;
  admin_count integer;
begin
  perform public.require_permission('staff.manage');

  if p_profile_id = auth.uid() then
    raise exception 'cannot_change_own_role';
  end if;

  select role, email into previous, target_email
  from public.profiles where id = p_profile_id for update;
  if target_email is null then raise exception 'profile_not_found'; end if;

  -- Never allow the store to be left without an administrator.
  if previous::text = 'admin' and p_role::text <> 'admin' then
    select count(*) into admin_count
    from public.profiles where role::text = 'admin' and is_active;
    if admin_count <= 1 then
      raise exception 'last_admin_protected';
    end if;
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_profile_id;

  perform public.log_admin_action(
    'staff.role_changed', 'profile', p_profile_id::text, target_email,
    jsonb_build_object('role', previous), jsonb_build_object('role', p_role), null
  );
end;
$$;

-- Called by the outbox drainer in lib/notifications.ts after it has attempted
-- delivery through whichever provider is configured.
create or replace function public.admin_mark_notification(
  p_id uuid,
  p_status text,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('settings.manage');
  if p_status not in ('sent', 'failed', 'skipped', 'queued') then
    raise exception 'invalid_status';
  end if;

  update public.notification_outbox
    set status = p_status,
        attempts = attempts + 1,
        last_error = nullif(trim(coalesce(p_error, '')), ''),
        sent_at = case when p_status = 'sent' then now() else sent_at end
    where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_customer_active(
  p_profile_id uuid,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target_email text;
begin
  perform public.require_permission('customers.manage');
  if p_profile_id = auth.uid() then raise exception 'cannot_change_own_status'; end if;

  update public.profiles set is_active = p_active where id = p_profile_id
    returning email into target_email;
  if target_email is null then raise exception 'profile_not_found'; end if;

  perform public.log_admin_action(
    'customer.status_changed', 'profile', p_profile_id::text, target_email,
    null, jsonb_build_object('isActive', p_active), p_reason
  );
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Dashboard and analytics — one round trip each, real data only
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka';
begin
  perform public.require_permission('orders.view');

  select jsonb_build_object(
    'todayOrders', (
      select count(*) from public.orders
      where created_at >= day_start and status <> 'cancelled'
    ),
    'todayRevenue', (
      select coalesce(sum(total), 0) from public.orders
      where created_at >= day_start and status not in ('cancelled', 'returned')
    ),
    'totalRevenue', (
      select coalesce(sum(total), 0) from public.orders
      where status not in ('cancelled', 'returned')
    ),
    'statusCounts', (
      select coalesce(jsonb_object_agg(status, count), '{}'::jsonb)
      from (
        select status::text as status, count(*) as count
        from public.orders group by status
      ) s
    ),
    'totalCustomers', (select count(*) from public.profiles where role::text = 'customer'),
    'newCustomersThisWeek', (
      select count(*) from public.profiles
      where role::text = 'customer' and created_at >= now() - interval '7 days'
    ),
    'activeProducts', (select count(*) from public.products where status = 'active'),
    'draftProducts', (select count(*) from public.products where status = 'draft'),
    'lowStockVariants', (
      select count(*) from public.product_variants
      where is_active and stock_quantity > 0 and stock_quantity <= low_stock_threshold
    ),
    'outOfStockVariants', (
      select count(*) from public.product_variants where is_active and stock_quantity = 0
    ),
    'pendingReviews', (select count(*) from public.reviews where status = 'pending'),
    'unreadMessages', (select count(*) from public.contact_messages where status = 'new'),
    'activeCoupons', (
      select count(*) from public.coupons
      where is_active and archived_at is null
        and (expires_at is null or expires_at > now())
    ),
    'couponDiscountTotal', (
      select coalesce(sum(discount_amount), 0) from public.coupon_redemptions
    ),
    'averageOrderValue', (
      select coalesce(round(avg(total), 2), 0) from public.orders
      where status not in ('cancelled', 'returned')
    ),
    'recentOrders', coalesce((
      select jsonb_agg(row_to_json(o))
      from (
        select id, order_number, customer_name, status, payment_status, total, created_at
        from public.orders order by created_at desc limit 8
      ) o
    ), '[]'::jsonb),
    'recentCustomers', coalesce((
      select jsonb_agg(row_to_json(c))
      from (
        select id, full_name, email, created_at
        from public.profiles where role::text = 'customer'
        order by created_at desc limit 6
      ) c
    ), '[]'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select oi.product_id, oi.product_name_en as name,
               sum(oi.quantity)::int as units,
               sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.status not in ('cancelled', 'returned')
        group by oi.product_id, oi.product_name_en
        order by units desc limit 6
      ) t
    ), '[]'::jsonb),
    'attentionInventory', coalesce((
      select jsonb_agg(row_to_json(v))
      from (
        select pv.id, pv.sku, pv.size, pv.colour_en, pv.stock_quantity,
               pv.low_stock_threshold, p.name_en as product_name, p.id as product_id
        from public.product_variants pv
        join public.products p on p.id = pv.product_id
        where pv.is_active and pv.stock_quantity <= pv.low_stock_threshold
        order by pv.stock_quantity asc limit 8
      ) v
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  since timestamptz := now() - make_interval(days => window_days);
  result jsonb;
begin
  perform public.require_permission('analytics.view');

  select jsonb_build_object(
    'windowDays', window_days,
    'revenueTrend', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select (date_trunc('day', o.created_at at time zone 'Asia/Dhaka'))::date as day,
               count(*)::int as orders,
               coalesce(sum(o.total), 0) as revenue
        from public.orders o
        where o.created_at >= since and o.status not in ('cancelled', 'returned')
        group by 1
      ) t
    ), '[]'::jsonb),
    'averageOrderValue', (
      select coalesce(round(avg(total), 2), 0) from public.orders
      where created_at >= since and status not in ('cancelled', 'returned')
    ),
    'statusDistribution', coalesce((
      select jsonb_object_agg(status, count)
      from (
        select status::text as status, count(*) as count from public.orders
        where created_at >= since group by status
      ) s
    ), '{}'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select oi.product_name_en as name, sum(oi.quantity)::int as units,
               sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.created_at >= since and o.status not in ('cancelled', 'returned')
        group by 1 order by units desc limit 10
      ) t
    ), '[]'::jsonb),
    'topCategories', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select c.name_en as name, sum(oi.quantity)::int as units,
               sum(oi.line_total) as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        join public.products p on p.id = oi.product_id
        join public.categories c on c.id = p.category_id
        where o.created_at >= since and o.status not in ('cancelled', 'returned')
        group by 1 order by revenue desc limit 8
      ) t
    ), '[]'::jsonb),
    'customerGrowth', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select (date_trunc('day', created_at at time zone 'Asia/Dhaka'))::date as day,
               count(*)::int as customers
        from public.profiles
        where created_at >= since and role::text = 'customer'
        group by 1
      ) t
    ), '[]'::jsonb),
    'couponPerformance', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select c.code, count(r.id)::int as redemptions,
               coalesce(sum(r.discount_amount), 0) as discount
        from public.coupon_redemptions r
        join public.coupons c on c.id = r.coupon_id
        where r.created_at >= since
        group by c.code order by redemptions desc limit 10
      ) t
    ), '[]'::jsonb),
    'cancellationRate', (
      select case when count(*) = 0 then 0
             else round(100.0 * count(*) filter (where status = 'cancelled') / count(*), 2)
             end
      from public.orders where created_at >= since
    ),
    'returnRate', (
      select case when count(*) = 0 then 0
             else round(100.0 * count(*) filter (where status = 'returned') / count(*), 2)
             end
      from public.orders where created_at >= since
    ),
    'codShare', (
      select case when count(*) = 0 then 0
             else round(100.0 * count(*) filter (where payment_method = 'cash_on_delivery') / count(*), 2)
             end
      from public.orders where created_at >= since
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_customer_summary(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('customers.view');
  return (
    select jsonb_build_object(
      'totalOrders', count(*) filter (where o.status not in ('cancelled')),
      'totalSpend', coalesce(sum(o.total) filter (where o.status not in ('cancelled', 'returned')), 0),
      'lastOrderAt', max(o.created_at),
      'cancelledOrders', count(*) filter (where o.status = 'cancelled')
    )
    from public.orders o where o.user_id = p_profile_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Hardened public form RPCs
-- ---------------------------------------------------------------------------

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_subject text default null,
  p_client_fingerprint text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  clean_email text := lower(trim(coalesce(p_email, '')));
  clean_message text := trim(coalesce(p_message, ''));
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_name, ''))) > 100
     or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean_email) > 200
     or length(clean_message) < 10 or length(clean_message) > 3000 then
    raise exception 'invalid_contact_message';
  end if;

  if not public.consume_rate_limit('contact:email', clean_email, 3, 3600) then
    raise exception 'rate_limited';
  end if;
  if p_client_fingerprint is not null
     and not public.consume_rate_limit('contact:client', p_client_fingerprint, 5, 3600) then
    raise exception 'rate_limited';
  end if;

  -- Identical message from the same address within the hour is a resubmit.
  if exists (
    select 1 from public.contact_messages
    where email = clean_email and message = clean_message
      and created_at > now() - interval '1 hour'
  ) then
    raise exception 'duplicate_message';
  end if;

  insert into public.contact_messages (name, email, phone, message, subject)
  values (
    trim(p_name), clean_email,
    public.normalize_bd_phone(p_phone),
    clean_message,
    nullif(trim(coalesce(p_subject, '')), '')
  )
  returning id into new_id;

  return new_id;
end;
$$;

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

  insert into public.newsletter_subscribers (email, preferred_language, is_active)
  values (clean_email, case when p_language = 'bn' then 'bn' else 'en' end, true)
  on conflict (email) do update
    set is_active = true,
        unsubscribed_at = null,
        preferred_language = excluded.preferred_language,
        updated_at = now();
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Integrity constraints
-- ---------------------------------------------------------------------------

create unique index if not exists orders_idempotency_key_idx
  on public.orders(idempotency_key) where idempotency_key is not null;

-- Added NOT VALID so an existing production database with legacy rows still
-- migrates cleanly. New and updated rows are enforced immediately. Once any
-- historical rows are reconciled, promote each one with:
--   alter table public.orders validate constraint orders_total_matches_lines;
alter table public.orders drop constraint if exists orders_total_matches_lines;
alter table public.orders add constraint orders_total_matches_lines
  check (total = subtotal + delivery_fee - discount_amount) not valid;

alter table public.orders drop constraint if exists orders_discount_within_subtotal;
alter table public.orders add constraint orders_discount_within_subtotal
  check (discount_amount <= subtotal) not valid;

alter table public.order_items drop constraint if exists order_items_line_total_check;
alter table public.order_items add constraint order_items_line_total_check
  check (line_total = unit_price * quantity and unit_price >= 0) not valid;

alter table public.coupons drop constraint if exists coupons_usage_within_limit;
alter table public.coupons add constraint coupons_usage_within_limit
  check (usage_limit is null or usage_count <= usage_limit) not valid;

alter table public.coupons drop constraint if exists coupons_code_format;
alter table public.coupons add constraint coupons_code_format
  check (code ~ '^[A-Z0-9_-]{3,30}$') not valid;

alter table public.coupons drop constraint if exists coupons_date_order;
alter table public.coupons add constraint coupons_date_order
  check (starts_at is null or expires_at is null or expires_at > starts_at) not valid;

alter table public.collections drop constraint if exists collections_date_order;
alter table public.collections add constraint collections_date_order
  check (starts_at is null or ends_at is null or ends_at > starts_at) not valid;

alter table public.coupons drop constraint if exists coupons_per_customer_limit_check;
alter table public.coupons add constraint coupons_per_customer_limit_check
  check (per_customer_limit is null or per_customer_limit > 0);

alter table public.product_variants drop constraint if exists product_variants_reserved_check;
alter table public.product_variants add constraint product_variants_reserved_check
  check (reserved_quantity >= 0 and reserved_quantity <= stock_quantity);

-- ---------------------------------------------------------------------------
-- 15. Indexes for the queries the admin panel and storefront actually run
-- ---------------------------------------------------------------------------

create index if not exists orders_order_number_idx on public.orders(order_number);
create index if not exists orders_phone_idx on public.orders(normalized_phone, created_at desc);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status, created_at desc);
create index if not exists orders_email_idx on public.orders(lower(customer_email));
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists order_items_variant_idx on public.order_items(product_variant_id);
create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_updated_idx on public.products(updated_at desc);
create index if not exists product_variants_sku_idx on public.product_variants(sku);
create index if not exists product_variants_low_stock_idx
  on public.product_variants(stock_quantity) where is_active and stock_quantity = 0;
create index if not exists coupons_code_idx on public.coupons(upper(code));
create index if not exists reviews_status_idx on public.reviews(status, created_at desc);
create index if not exists messages_status_idx on public.contact_messages(status, created_at desc);
create index if not exists newsletter_active_idx on public.newsletter_subscribers(is_active, created_at desc);
create index if not exists audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id);
create index if not exists audit_log_actor_idx on public.admin_audit_log(actor_id, created_at desc);
create index if not exists inventory_adjustments_variant_idx
  on public.inventory_adjustments(product_variant_id, created_at desc);
create index if not exists order_internal_notes_order_idx
  on public.order_internal_notes(order_id, created_at desc);
create index if not exists notification_outbox_status_idx
  on public.notification_outbox(status, created_at);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(lower(email));

-- ---------------------------------------------------------------------------
-- 16. RLS on the new tables, and tightened policies on existing ones
-- ---------------------------------------------------------------------------

alter table public.admin_audit_log enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.order_internal_notes enable row level security;
alter table public.request_throttle enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.order_status_transitions enable row level security;

drop policy if exists audit_log_admin_read on public.admin_audit_log;
create policy audit_log_admin_read on public.admin_audit_log for select
  using (public.has_permission('audit.view'));

drop policy if exists inventory_adjustments_staff_read on public.inventory_adjustments;
create policy inventory_adjustments_staff_read on public.inventory_adjustments for select
  using (public.has_permission('inventory.adjust') or public.has_permission('orders.view'));

-- Internal notes: readable only by back-office roles that hold orders.view.
-- There is deliberately no policy granting anon anything on this table.
drop policy if exists order_internal_notes_staff_read on public.order_internal_notes;
create policy order_internal_notes_staff_read on public.order_internal_notes for select
  using (public.has_permission('orders.view'));

drop policy if exists status_transitions_staff_read on public.order_status_transitions;
create policy status_transitions_staff_read on public.order_status_transitions for select
  using (public.has_permission('orders.view'));

-- request_throttle gets no policy at all: it is reachable only from SECURITY
-- DEFINER functions, so no client can burn another customer's quota.

-- The outbox is readable by administrators so a failed notification is
-- visible in the admin panel rather than silently lost. Rows are only ever
-- written by SECURITY DEFINER functions.
drop policy if exists notification_outbox_admin_read on public.notification_outbox;
create policy notification_outbox_admin_read on public.notification_outbox for select
  using (public.has_permission('settings.manage'));

-- Store settings: only rows explicitly flagged public are world-readable.
drop policy if exists settings_public_read on public.store_settings;
create policy settings_public_read on public.store_settings for select
  using (is_public or public.is_staff());
drop policy if exists settings_staff_manage on public.store_settings;
create policy settings_staff_manage on public.store_settings for all
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Catalogue writes now require the catalogue permission rather than "any
-- back-office login", so fulfilment and support staff cannot edit products.
drop policy if exists products_staff_manage on public.products;
create policy products_staff_manage on public.products for all
  using (public.has_permission('catalogue.manage'))
  with check (public.has_permission('catalogue.manage'));

drop policy if exists product_images_staff_manage on public.product_images;
create policy product_images_staff_manage on public.product_images for all
  using (public.has_permission('catalogue.manage'))
  with check (public.has_permission('catalogue.manage'));

-- Variant rows may be created/edited by catalogue managers, and stock-only
-- updates by fulfilment; the stock guard trigger still forces every quantity
-- change through admin_adjust_inventory().
drop policy if exists product_variants_staff_manage on public.product_variants;
create policy product_variants_staff_manage on public.product_variants for all
  using (public.has_permission('catalogue.manage') or public.has_permission('inventory.adjust'))
  with check (public.has_permission('catalogue.manage') or public.has_permission('inventory.adjust'));

drop policy if exists categories_staff_manage on public.categories;
create policy categories_staff_manage on public.categories for all
  using (public.has_permission('catalogue.manage'))
  with check (public.has_permission('catalogue.manage'));

drop policy if exists collections_staff_manage on public.collections;
create policy collections_staff_manage on public.collections for all
  using (public.has_permission('catalogue.manage'))
  with check (public.has_permission('catalogue.manage'));

-- Reviews: customers may edit only their own still-pending review. Staff
-- moderation goes through admin_moderate_review() so it is always audited,
-- which is why the staff escape hatch is removed from these policies.
drop policy if exists reviews_own_pending_update on public.reviews;
create policy reviews_own_pending_update on public.reviews for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists reviews_own_pending_delete on public.reviews;
create policy reviews_own_pending_delete on public.reviews for delete
  using (user_id = auth.uid() and status = 'pending');

-- Orders are never updated directly any more; every change is an audited RPC.
drop policy if exists orders_staff_update on public.orders;
drop policy if exists tracking_staff_manage on public.order_tracking_events;

drop policy if exists orders_own_or_staff_read on public.orders;
create policy orders_own_or_staff_read on public.orders for select
  using (user_id = auth.uid() or public.has_permission('orders.view'));

drop policy if exists order_items_owner_or_staff_read on public.order_items;
create policy order_items_owner_or_staff_read on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.user_id = auth.uid() or public.has_permission('orders.view'))
  ));

-- A signed-in customer sees only events flagged customer-visible on their own
-- order, so an internal-only event could never surface in "My orders" either.
drop policy if exists tracking_owner_or_staff_read on public.order_tracking_events;
create policy tracking_owner_or_staff_read on public.order_tracking_events for select
  using (
    (
      is_customer_visible
      and exists (
        select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
      )
    )
    or public.has_permission('orders.view')
  );

drop policy if exists coupon_redemptions_own_or_staff_read on public.coupon_redemptions;
create policy coupon_redemptions_own_or_staff_read on public.coupon_redemptions for select
  using (user_id = auth.uid() or public.has_permission('coupons.manage'));

drop policy if exists coupons_staff_only on public.coupons;
create policy coupons_read_staff on public.coupons for select
  using (public.has_permission('coupons.manage'));

drop policy if exists messages_staff_read on public.contact_messages;
create policy messages_staff_read on public.contact_messages for select
  using (public.has_permission('messages.manage'));
drop policy if exists messages_staff_update on public.contact_messages;

drop policy if exists newsletter_staff_read on public.newsletter_subscribers;
create policy newsletter_staff_read on public.newsletter_subscribers for select
  using (public.has_permission('newsletter.manage'));
drop policy if exists newsletter_staff_update on public.newsletter_subscribers;

-- Profiles: a customer sees only their own row; back-office roles that hold
-- customers.view (or orders.view, needed to render an order's customer) may
-- read others. Nobody may update another profile directly — role changes go
-- through set_profile_role() and status through admin_set_customer_active().
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles for select
  using (
    id = auth.uid()
    or public.has_permission('customers.view')
    or public.has_permission('orders.view')
  );
drop policy if exists profiles_update_own_or_staff on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Addresses belong to exactly one customer. Support staff can see an order's
-- shipping snapshot on the order itself, so there is no reason to expose the
-- customer's whole address book to the back office.
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 17. Grants
-- ---------------------------------------------------------------------------

revoke all on table
  public.admin_audit_log, public.inventory_adjustments, public.order_internal_notes,
  public.request_throttle, public.notification_outbox, public.order_status_transitions
from anon, authenticated;

grant select on table
  public.admin_audit_log, public.inventory_adjustments, public.order_internal_notes,
  public.order_status_transitions, public.notification_outbox
to authenticated;

-- Direct writes to these tables are withdrawn: every mutation now runs through
-- a SECURITY DEFINER RPC that checks a permission and writes an audit record.
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

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_full_admin() to anon, authenticated;
-- anon needs this too: the catalogue's `FOR ALL` staff-write policies are also
-- evaluated on SELECT, so an anonymous shopper reading a product calls it. It
-- reports on the caller's own role and returns false for anon, so granting it
-- leaks nothing while preventing "permission denied for function" on every
-- storefront read.
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.normalize_bd_phone(text) to anon, authenticated;

grant execute on function public.validate_coupon(text, numeric, uuid, text) to anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.get_guest_order_tracking(text, text) to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

grant execute on function public.admin_transition_order(uuid, public.order_status, text, text, boolean) to authenticated;
grant execute on function public.admin_update_payment_status(uuid, public.payment_status, text) to authenticated;
grant execute on function public.admin_add_order_note(uuid, text) to authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_moderate_review(uuid, public.review_status, text) to authenticated;
grant execute on function public.admin_update_message_status(uuid, public.message_status, text) to authenticated;
grant execute on function public.admin_set_newsletter_active(uuid, boolean) to authenticated;
grant execute on function public.admin_save_coupon(jsonb) to authenticated;
grant execute on function public.admin_archive_coupon(uuid, boolean) to authenticated;
grant execute on function public.admin_save_settings(jsonb) to authenticated;
grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_analytics(integer) to authenticated;
grant execute on function public.admin_customer_summary(uuid) to authenticated;
grant execute on function public.admin_set_customer_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_mark_notification(uuid, text, text) to authenticated;
grant execute on function public.set_profile_role(uuid, public.user_role) to authenticated;

-- consume_rate_limit, log_admin_action, require_permission, role_permissions,
-- prune_request_throttle and the trigger functions are intentionally NOT
-- granted: they are only reachable from inside SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- 18. Store settings catalogue
-- ---------------------------------------------------------------------------

insert into public.store_settings (key, value, is_public, label) values
  ('store_name',              '"TARA"'::jsonb,        true,  'Store name'),
  ('support_phone',           '""'::jsonb,            true,  'Support phone'),
  ('whatsapp_number',         '""'::jsonb,            true,  'WhatsApp number'),
  ('support_email',           '""'::jsonb,            true,  'Support email'),
  ('store_address',           '""'::jsonb,            true,  'Store address'),
  ('facebook_url',            '""'::jsonb,            true,  'Facebook URL'),
  ('instagram_url',           '""'::jsonb,            true,  'Instagram URL'),
  ('tiktok_url',              '""'::jsonb,            true,  'TikTok URL'),
  ('free_delivery_threshold', '1500'::jsonb,          true,  'Free delivery threshold'),
  ('standard_delivery_fee',   '100'::jsonb,           true,  'Standard delivery fee'),
  ('express_delivery_fee',    '180'::jsonb,           true,  'Express delivery fee'),
  ('currency',                '"BDT"'::jsonb,         true,  'Currency'),
  ('cod_enabled',             'true'::jsonb,          true,  'Cash on delivery enabled'),
  ('online_payment_enabled',  'false'::jsonb,         true,  'Online payment enabled'),
  ('maintenance_mode',        'false'::jsonb,         true,  'Maintenance mode'),
  ('low_stock_alert_enabled', 'true'::jsonb,          false, 'Low stock alerts'),
  ('order_notification_email','""'::jsonb,            false, 'Internal order notification inbox')
on conflict (key) do update
  set is_public = excluded.is_public,
      label = excluded.label;

-- Existing installs seeded these four before is_public existed.
update public.store_settings set is_public = true
  where key in ('free_delivery_threshold', 'standard_delivery_fee', 'express_delivery_fee', 'currency');

commit;
