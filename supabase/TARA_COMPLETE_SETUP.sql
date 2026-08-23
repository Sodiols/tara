/*
TARA COMPLETE SUPABASE SETUP

Run this entire file once in the Supabase SQL Editor.
Do not run only selected sections.
This file safely creates or repairs the TARA schema without deleting
Auth users, customer profiles, orders, customers, or products.
*/

begin;

-- 2-4. Extensions, enums, and sequences

create extension if not exists pgcrypto;
create extension if not exists unaccent;

do $$ begin
  create type public.user_role as enum ('customer', 'staff', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'confirmed', 'processing', 'packed', 'shipped',
    'delivered', 'cancelled', 'returned'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid', 'pending', 'paid', 'failed', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash_on_delivery', 'online');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.delivery_method as enum ('standard', 'express');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_type as enum ('fixed', 'percentage');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_status as enum ('new', 'read', 'resolved');
exception when duplicate_object then null;
end $$;

create sequence if not exists public.order_number_seq start 1000;

-- 5. Tables

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  avatar_url text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'bn')),
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  division text not null,
  district text not null,
  upazila text not null,
  area text not null,
  postal_code text,
  full_address text not null,
  delivery_note text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_bn text not null,
  description_en text,
  description_bn text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_bn text not null,
  description_en text,
  description_bn text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_bn text not null,
  description_en text not null,
  description_bn text not null,
  category_id uuid not null references public.categories(id),
  collection_id uuid references public.collections(id) on delete set null,
  base_price numeric(12,2) not null check (base_price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= base_price),
  fabric_en text not null,
  fabric_bn text not null,
  product_code text not null unique,
  status public.product_status not null default 'draft',
  is_new boolean not null default false,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  care_instructions_en text not null default '',
  care_instructions_bn text not null default '',
  tags text[] not null default '{}',
  unstitched_details jsonb,
  ready_made_details jsonb,
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_en text not null default '',
  alt_bn text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  colour_en text not null,
  colour_bn text not null,
  colour_hex text not null check (colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_variant_id)
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description_en text not null default '',
  description_bn text not null default '',
  discount_type public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_amount numeric(12,2) not null default 0,
  maximum_discount_amount numeric(12,2),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  payment_method public.payment_method not null default 'cash_on_delivery',
  delivery_method public.delivery_method not null default 'standard',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'BDT' check (currency = 'BDT'),
  shipping_address jsonb not null,
  customer_note text,
  tracking_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_variant_id uuid not null references public.product_variants(id),
  product_name_en text not null,
  product_name_bn text not null,
  product_code text not null,
  sku text not null,
  size text not null,
  colour_en text not null,
  colour_bn text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null,
  product_image_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.order_tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note_en text,
  note_bn text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  order_item_id uuid unique references public.order_items(id) on delete cascade,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment_en text not null,
  comment_bn text,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status public.message_status not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'bn')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Missing-column and partial-install repairs
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists preferred_language text not null default 'en';
alter table public.profiles add column if not exists role public.user_role not null default 'customer';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.addresses add column if not exists is_default boolean not null default false;
alter table public.addresses add column if not exists created_at timestamptz not null default now();
alter table public.addresses add column if not exists updated_at timestamptz not null default now();

alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists status public.product_status not null default 'draft';
alter table public.products add column if not exists is_new boolean not null default false;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists is_best_seller boolean not null default false;
alter table public.products add column if not exists care_instructions_en text not null default '';
alter table public.products add column if not exists care_instructions_bn text not null default '';
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists unstitched_details jsonb;
alter table public.products add column if not exists ready_made_details jsonb;
alter table public.products add column if not exists average_rating numeric(3,2) not null default 0;
alter table public.products add column if not exists review_count integer not null default 0;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.product_images add column if not exists updated_at timestamptz not null default now();
alter table public.product_images add column if not exists storage_path text;
alter table public.product_variants add column if not exists price_override numeric(12,2);
alter table public.product_variants add column if not exists stock_quantity integer not null default 0;
alter table public.product_variants add column if not exists low_stock_threshold integer not null default 3;
alter table public.product_variants add column if not exists is_active boolean not null default true;
alter table public.product_variants add column if not exists updated_at timestamptz not null default now();

alter table public.carts add column if not exists updated_at timestamptz not null default now();
alter table public.cart_items add column if not exists quantity integer not null default 1;
alter table public.cart_items add column if not exists updated_at timestamptz not null default now();

alter table public.orders add column if not exists status public.order_status not null default 'pending';
alter table public.orders add column if not exists payment_status public.payment_status not null default 'unpaid';
alter table public.orders add column if not exists payment_method public.payment_method not null default 'cash_on_delivery';
alter table public.orders add column if not exists delivery_method public.delivery_method not null default 'standard';
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists currency text not null default 'BDT';
alter table public.orders add column if not exists customer_note text;
alter table public.orders add column if not exists tracking_token text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.reviews add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.reviews add column if not exists order_item_id uuid references public.order_items(id) on delete cascade;
alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists comment_bn text;
alter table public.reviews add column if not exists status public.review_status not null default 'pending';
alter table public.reviews add column if not exists updated_at timestamptz not null default now();

alter table public.contact_messages add column if not exists status public.message_status not null default 'new';
alter table public.contact_messages add column if not exists updated_at timestamptz not null default now();
alter table public.newsletter_subscribers add column if not exists preferred_language text not null default 'en';
alter table public.newsletter_subscribers add column if not exists is_active boolean not null default true;
alter table public.newsletter_subscribers add column if not exists updated_at timestamptz not null default now();

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions(user_id, created_at desc);

-- 7-15. Indexes, utility functions, Auth trigger, timestamps, addresses, and roles


create index if not exists products_status_idx on public.products(status);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_collection_idx on public.products(collection_id);
create index if not exists products_new_idx on public.products(is_new) where is_new;
create index if not exists products_featured_idx on public.products(is_featured) where is_featured;
create index if not exists products_best_seller_idx on public.products(is_best_seller) where is_best_seller;
create index if not exists products_name_search_idx on public.products using gin (
  to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(name_bn, '') || ' ' || coalesce(product_code, ''))
);
create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);
create unique index if not exists product_primary_image_idx on public.product_images(product_id) where is_primary;
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_variants_stock_idx on public.product_variants(stock_quantity) where is_active;
create index if not exists addresses_user_idx on public.addresses(user_id);
create unique index if not exists addresses_one_default_idx on public.addresses(user_id) where is_default;
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists tracking_events_order_idx on public.order_tracking_events(order_id, created_at);
create index if not exists reviews_product_idx on public.reviews(product_id, status);

-- A percentage discount above 100% would let place_order() compute a
-- negative total (caught by orders_total_check, but only after breaking
-- checkout for anyone using the coupon) — cap it in the schema, not just in
-- the admin UI, so it can never be entered by any client.
alter table public.coupons drop constraint if exists coupons_percentage_max;
alter table public.coupons add constraint coupons_percentage_max
  check (discount_type = 'fixed' or discount_value <= 100);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'addresses', 'categories', 'collections', 'products',
    'product_images', 'product_variants', 'carts', 'cart_items', 'coupons', 'orders',
    'reviews', 'store_settings', 'contact_messages', 'newsletter_subscribers'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, email, phone, preferred_language
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case
      when new.raw_user_meta_data ->> 'preferred_language' = 'bn' then 'bn'
      else 'en'
    end
  )
  on conflict (id) do nothing;

  insert into public.carts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_default_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
      set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists address_default_guard on public.addresses;
create trigger address_default_guard
  before insert or update of is_default on public.addresses
  for each row execute function public.set_default_address();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
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
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'protected_profile_field_change_not_allowed';
  end if;
  if new.role <> old.role
    and current_user not in ('postgres', 'supabase_admin')
    and not public.is_full_admin() then
    raise exception 'role_change_not_allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_role_guard on public.profiles;
create trigger profile_role_guard
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

-- 8. Repair Auth users whose earlier profile trigger failed
insert into public.profiles (
  id, full_name, email, phone, preferred_language
)
select
  auth_user.id,
  coalesce(auth_user.raw_user_meta_data ->> 'full_name', ''),
  coalesce(auth_user.email, ''),
  coalesce(auth_user.raw_user_meta_data ->> 'phone', ''),
  case
    when auth_user.raw_user_meta_data ->> 'preferred_language' = 'bn' then 'bn'
    else 'en'
  end
from auth.users auth_user
on conflict (id) do nothing;

insert into public.carts (user_id)
select auth_user.id
from auth.users auth_user
on conflict (user_id) do nothing;

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

  insert into public.profiles (
    id, full_name, email, phone, preferred_language
  )
  select
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', ''),
    coalesce(auth_user.email, ''),
    coalesce(auth_user.raw_user_meta_data ->> 'phone', ''),
    case
      when auth_user.raw_user_meta_data ->> 'preferred_language' = 'bn' then 'bn'
      else 'en'
    end
  from auth.users auth_user
  where auth_user.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.carts (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select profile.*
  into current_profile
  from public.profiles profile
  where profile.id = auth.uid();

  return current_profile;
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
begin
  if not public.is_full_admin() then
    raise exception 'admin_required';
  end if;
  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_profile_id;
end;
$$;

-- 14-16. Coupons, checkout, orders, tracking, and reviews

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.generate_order_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'TARA-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons%rowtype;
  discount numeric(12,2) := 0;
begin
  select * into c
  from public.coupons
  where upper(code) = upper(trim(p_code))
    and is_active
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or usage_count < usage_limit);

  if not found then return jsonb_build_object('valid', false, 'reason', 'invalid'); end if;
  if p_subtotal < c.minimum_order_amount then
    return jsonb_build_object('valid', false, 'reason', 'minimum_not_met', 'minimum', c.minimum_order_amount);
  end if;

  if c.discount_type = 'fixed' then
    discount := least(c.discount_value, p_subtotal);
  else
    discount := round(p_subtotal * c.discount_value / 100, 2);
    if c.maximum_discount_amount is not null then
      discount := least(discount, c.maximum_discount_amount);
    end if;
  end if;
  return jsonb_build_object('valid', true, 'discount', discount, 'coupon_id', c.id);
end;
$$;

create or replace function public.place_order(
  p_customer jsonb,
  p_shipping_address jsonb,
  p_items jsonb,
  p_delivery_method text,
  p_payment_method text,
  p_coupon_code text default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  variant_record record;
  new_order_id uuid := gen_random_uuid();
  new_order_number text := public.generate_order_number();
  -- 48 hex characters from two v4 UUIDs. NOT gen_random_bytes(): that lives
  -- in the pgcrypto extension and cannot be resolved under `search_path = ''`,
  -- which made every single call to this function fail with 42883.
  new_tracking_token text := substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    1, 48
  );
  current_user_id uuid := auth.uid();
  item_quantity integer;
  unit_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  calculated_delivery numeric(12,2) := 0;
  calculated_discount numeric(12,2) := 0;
  coupon_result jsonb;
  free_threshold numeric(12,2);
  standard_fee numeric(12,2);
  express_fee numeric(12,2);
begin
  if length(trim(coalesce(p_customer ->> 'name', ''))) < 2
    or (p_customer ->> 'phone') !~ '^(\+?88)?01[3-9][0-9]{8}$'
    or length(trim(coalesce(p_shipping_address ->> 'fullAddress', ''))) < 8 then
    raise exception 'invalid_customer_or_address';
  end if;
  if p_payment_method <> 'cash_on_delivery' then
    raise exception 'online_payment_unavailable';
  end if;
  if p_delivery_method not in ('standard', 'express') then
    raise exception 'invalid_delivery_method';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;

  select (value #>> '{}')::numeric into free_threshold from public.store_settings where key = 'free_delivery_threshold';
  select (value #>> '{}')::numeric into standard_fee from public.store_settings where key = 'standard_delivery_fee';
  select (value #>> '{}')::numeric into express_fee from public.store_settings where key = 'express_delivery_fee';
  free_threshold := coalesce(free_threshold, 1500);
  standard_fee := coalesce(standard_fee, 100);
  express_fee := coalesce(express_fee, 180);

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_quantity := (item ->> 'quantity')::integer;
    if item_quantity < 1 or item_quantity > 20 then raise exception 'invalid_quantity'; end if;

    select
      v.id variant_id, v.product_id, v.sku, v.size, v.colour_en, v.colour_bn,
      v.stock_quantity, coalesce(v.price_override, p.base_price) price,
      p.name_en, p.name_bn, p.product_code,
      coalesce((select image_url from public.product_images where product_id = p.id order by is_primary desc, sort_order limit 1), '') image_url
    into variant_record
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = (item ->> 'variantId')::uuid
      and v.is_active and p.status = 'active'
    for update of v;

    if not found then raise exception 'invalid_variant'; end if;
    if variant_record.stock_quantity < item_quantity then raise exception 'out_of_stock:%', variant_record.sku; end if;
    calculated_subtotal := calculated_subtotal + variant_record.price * item_quantity;
  end loop;

  calculated_delivery := case
    when p_delivery_method = 'express' then express_fee
    when calculated_subtotal >= free_threshold then 0
    else standard_fee
  end;

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    coupon_result := public.validate_coupon(p_coupon_code, calculated_subtotal);
    if not coalesce((coupon_result ->> 'valid')::boolean, false) then raise exception 'invalid_coupon'; end if;
    calculated_discount := (coupon_result ->> 'discount')::numeric;
    update public.coupons set usage_count = usage_count + 1 where id = (coupon_result ->> 'coupon_id')::uuid;
  end if;

  insert into public.orders (
    id, order_number, user_id, customer_name, customer_email, customer_phone,
    payment_method, delivery_method, subtotal, delivery_fee, discount_amount,
    total, shipping_address, customer_note, tracking_token
  ) values (
    new_order_id, new_order_number, current_user_id,
    trim(p_customer ->> 'name'), nullif(trim(p_customer ->> 'email'), ''),
    trim(p_customer ->> 'phone'), p_payment_method::public.payment_method,
    p_delivery_method::public.delivery_method, calculated_subtotal,
    calculated_delivery, calculated_discount,
    calculated_subtotal + calculated_delivery - calculated_discount,
    p_shipping_address, nullif(trim(coalesce(p_customer_note, '')), ''),
    new_tracking_token
  );

  if coupon_result is not null then
    insert into public.coupon_redemptions (
      coupon_id, order_id, user_id, discount_amount
    ) values (
      (coupon_result ->> 'coupon_id')::uuid,
      new_order_id,
      current_user_id,
      calculated_discount
    )
    on conflict (coupon_id, order_id) do nothing;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_quantity := (item ->> 'quantity')::integer;
    select
      v.id variant_id, v.product_id, v.sku, v.size, v.colour_en, v.colour_bn,
      coalesce(v.price_override, p.base_price) price,
      p.name_en, p.name_bn, p.product_code,
      coalesce((select image_url from public.product_images where product_id = p.id order by is_primary desc, sort_order limit 1), '') image_url
    into variant_record
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = (item ->> 'variantId')::uuid;

    unit_price := variant_record.price;
    insert into public.order_items (
      order_id, product_id, product_variant_id, product_name_en, product_name_bn,
      product_code, sku, size, colour_en, colour_bn, unit_price, quantity,
      line_total, product_image_url
    ) values (
      new_order_id, variant_record.product_id, variant_record.variant_id,
      variant_record.name_en, variant_record.name_bn, variant_record.product_code,
      variant_record.sku, variant_record.size, variant_record.colour_en,
      variant_record.colour_bn, unit_price, item_quantity,
      unit_price * item_quantity, variant_record.image_url
    );
    update public.product_variants
      set stock_quantity = stock_quantity - item_quantity
      where id = variant_record.variant_id;
  end loop;

  -- English only: note_bn is nullable and deliberately left unset.
  insert into public.order_tracking_events(order_id, status, note_en)
  values (new_order_id, 'pending', 'Order placed');

  if current_user_id is not null then
    delete from public.cart_items where cart_id = (select id from public.carts where user_id = current_user_id);
  end if;

  return jsonb_build_object(
    'orderNumber', new_order_number,
    'trackingToken', new_tracking_token,
    'total', calculated_subtotal + calculated_delivery - calculated_discount
  );
end;
$$;

-- Staff-only order status update. Enforces a forward-moving status state
-- machine (no reviving a cancelled/returned order, no skipping backwards) and
-- restores variant stock exactly once when an order is cancelled or returned,
-- so admin cancellations never leak reserved inventory the way a bare
-- `update orders set status = ...` would.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_payment_status public.payment_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record record;
  order_item record;
  sequence_rank constant text[] := array[
    'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'
  ];
  old_rank int;
  new_rank int;
begin
  if not public.is_staff() then
    raise exception 'not_authorised';
  end if;

  select id, status into order_record from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if order_record.status <> p_status then
    if order_record.status in ('cancelled', 'returned') then
      raise exception 'invalid_transition:order_already_%', order_record.status;
    end if;

    if p_status = 'cancelled' then
      if order_record.status = 'delivered' then
        raise exception 'invalid_transition:use_returned_not_cancelled';
      end if;
    elsif p_status = 'returned' then
      if order_record.status <> 'delivered' then
        raise exception 'invalid_transition:only_delivered_can_be_returned';
      end if;
    else
      old_rank := array_position(sequence_rank, order_record.status::text);
      new_rank := array_position(sequence_rank, p_status::text);
      if old_rank is null or new_rank is null or new_rank <= old_rank then
        raise exception 'invalid_transition:%_to_%', order_record.status, p_status;
      end if;
    end if;

    if p_status in ('cancelled', 'returned') then
      for order_item in
        select product_variant_id, quantity from public.order_items where order_id = p_order_id
      loop
        update public.product_variants
          set stock_quantity = stock_quantity + order_item.quantity
          where id = order_item.product_variant_id;
      end loop;
    end if;
  end if;

  update public.orders
    set status = p_status, payment_status = p_payment_status
    where id = p_order_id;

  insert into public.order_tracking_events (order_id, status, note_en, note_bn, created_by)
  values (p_order_id, p_status, nullif(trim(coalesce(p_note, '')), ''), null, auth.uid());

  return jsonb_build_object('ok', true, 'status', p_status, 'paymentStatus', p_payment_status);
end;
$$;

create or replace function public.get_guest_order_tracking(p_order_number text, p_tracking_token text)
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
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', e.status, 'noteEn', e.note_en, 'noteBn', e.note_bn, 'createdAt', e.created_at
      ) order by e.created_at)
      from public.order_tracking_events e where e.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = p_order_number and o.tracking_token = p_tracking_token;
$$;

create or replace function public.recalculate_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    average_rating = coalesce((select round(avg(rating), 2) from public.reviews where product_id = target_product and status = 'approved'), 0),
    review_count = (select count(*) from public.reviews where product_id = target_product and status = 'approved')
  where p.id = target_product;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_recalculate_rating on public.reviews;
create trigger reviews_recalculate_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalculate_product_rating();


-- 17-18. Contact, newsletter, and storage

create or replace function public.submit_contact_message(
  p_name text, p_email text, p_phone text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  if length(trim(p_name)) < 2 or position('@' in p_email) < 2 or length(trim(p_message)) < 10 then
    raise exception 'invalid_contact_message';
  end if;
  insert into public.contact_messages(name, email, phone, message)
  values (trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), trim(p_message))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.subscribe_newsletter(p_email text, p_language text default 'en')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if position('@' in p_email) < 2 then raise exception 'invalid_email'; end if;
  insert into public.newsletter_subscribers(email, preferred_language, is_active)
  values (lower(trim(p_email)), case when p_language = 'bn' then 'bn' else 'en' end, true)
  on conflict (email) do update set is_active = true, preferred_language = excluded.preferred_language, updated_at = now();
  return true;
end;
$$;


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_storage_read on storage.objects;
drop policy if exists product_images_staff_storage_insert on storage.objects;
drop policy if exists product_images_staff_storage_update on storage.objects;
drop policy if exists product_images_staff_storage_delete on storage.objects;
drop policy if exists avatar_public_storage_read on storage.objects;
drop policy if exists avatar_owner_storage_insert on storage.objects;
drop policy if exists avatar_owner_storage_update on storage.objects;
drop policy if exists avatar_owner_storage_delete on storage.objects;

create policy product_images_public_storage_read on storage.objects for select
  using (bucket_id = 'product-images');
create policy product_images_staff_storage_insert on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_staff());
create policy product_images_staff_storage_update on storage.objects for update
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());
create policy product_images_staff_storage_delete on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_staff());

create policy avatar_public_storage_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatar_owner_storage_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_owner_storage_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_owner_storage_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 19-20. Row Level Security and policies

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_tracking_events enable row level security;
alter table public.reviews enable row level security;
alter table public.store_settings enable row level security;
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists coupon_redemptions_own_or_staff_read on public.coupon_redemptions;
drop policy if exists profiles_select_own_or_staff on public.profiles;
drop policy if exists profiles_update_own_or_staff on public.profiles;
drop policy if exists addresses_own on public.addresses;
drop policy if exists categories_public_read on public.categories;
drop policy if exists categories_staff_manage on public.categories;
drop policy if exists collections_public_read on public.collections;
drop policy if exists collections_staff_manage on public.collections;
drop policy if exists products_public_read on public.products;
drop policy if exists products_staff_manage on public.products;
drop policy if exists product_images_public_read on public.product_images;
drop policy if exists product_images_staff_manage on public.product_images;
drop policy if exists product_variants_public_read on public.product_variants;
drop policy if exists product_variants_staff_manage on public.product_variants;
drop policy if exists carts_own on public.carts;
drop policy if exists cart_items_own on public.cart_items;
drop policy if exists wishlist_own on public.wishlist_items;
drop policy if exists orders_own_or_staff_read on public.orders;
drop policy if exists orders_staff_update on public.orders;
drop policy if exists order_items_owner_or_staff_read on public.order_items;
drop policy if exists tracking_owner_or_staff_read on public.order_tracking_events;
drop policy if exists tracking_staff_manage on public.order_tracking_events;
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_verified_insert on public.reviews;
drop policy if exists reviews_own_pending_update on public.reviews;
drop policy if exists reviews_own_pending_delete on public.reviews;
drop policy if exists coupons_staff_only on public.coupons;
drop policy if exists settings_public_read on public.store_settings;
drop policy if exists settings_staff_manage on public.store_settings;
drop policy if exists messages_staff_read on public.contact_messages;
drop policy if exists messages_staff_update on public.contact_messages;
drop policy if exists newsletter_staff_read on public.newsletter_subscribers;
drop policy if exists newsletter_staff_update on public.newsletter_subscribers;

create policy coupon_redemptions_own_or_staff_read on public.coupon_redemptions for select
  using (user_id = auth.uid() or public.is_staff());

create policy profiles_select_own_or_staff on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own_or_staff on public.profiles for update
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

create policy addresses_own on public.addresses for all
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy categories_public_read on public.categories for select using (is_active or public.is_staff());
create policy categories_staff_manage on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy collections_public_read on public.collections for select using (is_active or public.is_staff());
create policy collections_staff_manage on public.collections for all using (public.is_staff()) with check (public.is_staff());

create policy products_public_read on public.products for select using (status = 'active' or public.is_staff());
create policy products_staff_manage on public.products for all using (public.is_staff()) with check (public.is_staff());
create policy product_images_public_read on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or public.is_staff())));
create policy product_images_staff_manage on public.product_images for all using (public.is_staff()) with check (public.is_staff());
create policy product_variants_public_read on public.product_variants for select
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or public.is_staff());
create policy product_variants_staff_manage on public.product_variants for all using (public.is_staff()) with check (public.is_staff());

create policy carts_own on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy wishlist_own on public.wishlist_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy orders_own_or_staff_read on public.orders for select
  using (user_id = auth.uid() or public.is_staff());
create policy orders_staff_update on public.orders for update
  using (public.is_staff()) with check (public.is_staff());
create policy order_items_owner_or_staff_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy tracking_owner_or_staff_read on public.order_tracking_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy tracking_staff_manage on public.order_tracking_events for all using (public.is_staff()) with check (public.is_staff());

create policy reviews_public_read on public.reviews for select
  using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy reviews_verified_insert on public.reviews for insert
  with check (
    user_id = auth.uid() and order_item_id is not null and exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and oi.product_id = product_id
        and o.user_id = auth.uid() and o.status = 'delivered'
    )
  );
create policy reviews_own_pending_update on public.reviews for update
  using ((user_id = auth.uid() and status = 'pending') or public.is_staff())
  with check ((user_id = auth.uid() and status = 'pending') or public.is_staff());
create policy reviews_own_pending_delete on public.reviews for delete
  using ((user_id = auth.uid() and status = 'pending') or public.is_staff());

create policy coupons_staff_only on public.coupons for all using (public.is_staff()) with check (public.is_staff());
create policy settings_public_read on public.store_settings for select using (true);
create policy settings_staff_manage on public.store_settings for all using (public.is_staff()) with check (public.is_staff());
create policy messages_staff_read on public.contact_messages for select using (public.is_staff());
create policy messages_staff_update on public.contact_messages for update using (public.is_staff()) with check (public.is_staff());
create policy newsletter_staff_read on public.newsletter_subscribers for select using (public.is_staff());
create policy newsletter_staff_update on public.newsletter_subscribers for update using (public.is_staff()) with check (public.is_staff());


-- 21. Explicit table and function permissions
grant usage on schema public to anon, authenticated;

revoke all on table
  public.profiles, public.addresses, public.categories, public.collections,
  public.products, public.product_images, public.product_variants,
  public.carts, public.cart_items, public.wishlist_items, public.coupons,
  public.coupon_redemptions, public.orders, public.order_items,
  public.order_tracking_events, public.reviews, public.store_settings,
  public.contact_messages, public.newsletter_subscribers
from anon, authenticated;

grant select on table
  public.categories, public.collections, public.products, public.product_images,
  public.product_variants, public.reviews, public.store_settings
to anon, authenticated;

grant select, insert, update, delete on table
  public.categories, public.collections, public.products, public.product_images,
  public.product_variants
to authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, phone, avatar_url, preferred_language, updated_at)
  on public.profiles to authenticated;

grant select, insert, update, delete on table
  public.addresses, public.carts, public.cart_items, public.wishlist_items
to authenticated;

grant select, update on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select, insert, update, delete on table public.order_tracking_events to authenticated;
grant select, insert, update, delete on table public.reviews to authenticated;
grant select, insert, update, delete on table public.coupons to authenticated;
grant select on table public.coupon_redemptions to authenticated;
grant select, update on table public.store_settings to authenticated;
grant select, update on table public.contact_messages to authenticated;
grant select, update on table public.newsletter_subscribers to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_full_admin() to anon, authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.set_profile_role(uuid, public.user_role) to authenticated;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text) to anon, authenticated;
grant execute on function public.get_guest_order_tracking(text, text) to anon, authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, public.payment_status, text) to authenticated;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;

-- 22-24. Store settings and complete catalog seed

insert into public.store_settings(key, value) values
  ('free_delivery_threshold', '1500'::jsonb),
  ('standard_delivery_fee', '100'::jsonb),
  ('express_delivery_fee', '180'::jsonb),
  ('currency', '"BDT"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.categories(slug,name_en,name_bn,sort_order) values ('unstitched-three-piece','Unstitched Three Piece','আনস্টিচড থ্রি পিস',0) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.categories(slug,name_en,name_bn,sort_order) values ('ready-three-piece','Ready Three Piece','রেডি থ্রি পিস',1) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.categories(slug,name_en,name_bn,sort_order) values ('accessories','Accessories','অ্যাক্সেসরিজ',2) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.categories(slug,name_en,name_bn,sort_order) values ('collection','Collection','কালেকশন',3) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('eid','Eid Collection','ঈদ কালেকশন',true,0) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('summer','Summer Collection','সামার কালেকশন',true,1) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('winter','Winter Collection','উইন্টার কালেকশন',true,2) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('festive','Festive Collection','ফেস্টিভ কালেকশন',true,3) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('everyday-elegance','Everyday Elegance','এভরিডে এলিগেন্স',false,4) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;
insert into public.collections(slug,name_en,name_bn,is_featured,sort_order) values ('office-edit','Office Edit','অফিস এডিট',false,5) on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'embroidered-lawn-unstitched-set','Embroidered Lawn Unstitched Set','এমব্রয়ডারি লন আনস্টিচড সেট','A refined ivory lawn three piece with hand-finished floral embroidery along the neckline and sleeves, paired with a soft chiffon dupatta.','গলা ও হাতায় হাতে করা ফুলেল এমব্রয়ডারিসহ একটি পরিশীলিত আইভরি লন থ্রি পিস, সাথে নরম শিফন ওড়না।',c.id,col.id,2850,3400,'Pure Lawn Cotton','খাঁটি লন কটন','TR-UN-101','active',true,true,true,'Dry clean recommended. If hand washing, use cold water and mild detergent. Do not wring embroidered panels.','ড্রাই ক্লিন করা ভালো। হাতে ধোয়ার ক্ষেত্রে ঠান্ডা পানি ও মৃদু ডিটারজেন্ট ব্যবহার করুন। এমব্রয়ডারি করা অংশ মোচড়াবেন না।',array['embroidered','lawn','festive'],'{"kameezFabric":{"en":"Pure Lawn Cotton, 3.15 metres","bn":"খাঁটি লন কটন, ৩.১৫ মিটার"},"salwarFabric":{"en":"Cambric Cotton, 2.5 metres","bn":"ক্যামব্রিক কটন, ২.৫ মিটার"},"dupattaFabric":{"en":"Soft Chiffon, 2.5 metres","bn":"নরম শিফন, ২.৫ মিটার"},"workDetails":{"en":"Hand-finished thread embroidery on neckline and sleeves","bn":"গলা ও হাতায় হাতে করা সুতার এমব্রয়ডারি"},"fabricLength":{"en":"Total 8.15 metres (undready)","bn":"মোট ৮.১৫ মিটার (আনস্টিচড)"},"colourInfo":{"en":"Ivory base with wine embroidery thread","bn":"আইভরি বেসের উপর ওয়াইন রঙের সুতার কাজ"}}'::jsonb,'null'::jsonb,4.7,32
from public.categories c left join public.collections col on col.slug='festive' where c.slug='unstitched-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=1125&fit=crop&q=80&auto=format','Embroidered Lawn Unstitched Set','এমব্রয়ডারি লন আনস্টিচড সেট',0,true from public.products p where p.slug='embroidered-lawn-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format','Embroidered Lawn Unstitched Set','এমব্রয়ডারি লন আনস্টিচড সেট',1,false from public.products p where p.slug='embroidered-lawn-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-101-UNDREADY-IVORY','Unstitched','Ivory','আইভরি','#EDE6D9',7,true from public.products where slug='embroidered-lawn-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-101-UNDREADY-WINE','Unstitched','Wine','ওয়াইন','#6F263D',7,true from public.products where slug='embroidered-lawn-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Nusrat J.',5,'The fabric quality is beautiful and the embroidery is so delicate.','কাপড়ের মান খুব সুন্দর এবং এমব্রয়ডারিটা অসাধারণ।','approved','2026-06-02T00:00:00Z'::timestamptz from public.products p where p.slug='embroidered-lawn-unstitched-set' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Nusrat J.' and existing.created_at='2026-06-02T00:00:00Z'::timestamptz);
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Farzana A.',4,'Loved the colour, stitching took it to another level.','রংটা খুব পছন্দ হয়েছে, দর্জির কাজও চমৎকার হয়েছে।','approved','2026-05-20T00:00:00Z'::timestamptz from public.products p where p.slug='embroidered-lawn-unstitched-set' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Farzana A.' and existing.created_at='2026-05-20T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'floral-cotton-unstitched-set','Floral Cotton Unstitched Set','ফ্লোরাল কটন আনস্টিচড সেট','A pastel pink cotton three piece with delicate floral print, designed for warm-weather comfort and everyday elegance.','উষ্ণ আবহাওয়ায় আরাম ও দৈনন্দিন সৌন্দর্যের জন্য তৈরি পাতলা ফুলেল প্রিন্টের একটি পেস্টেল পিংক কটন থ্রি পিস।',c.id,col.id,2450,null,'Printed Cotton','প্রিন্টেড কটন','TR-UN-102','active',true,true,false,'Machine washable in cold water. Iron on medium heat. Wash dark colours separately.','ঠান্ডা পানিতে মেশিনে ধোয়া যাবে। মাঝারি তাপে ইস্ত্রি করুন। গাঢ় রং আলাদা ধুয়ে নিন।',array['printed','cotton','everyday'],'{"kameezFabric":{"en":"Printed Cotton, 3 metres","bn":"প্রিন্টেড কটন, ৩ মিটার"},"salwarFabric":{"en":"Plain Cotton, 2.5 metres","bn":"প্লেইন কটন, ২.৫ মিটার"},"dupattaFabric":{"en":"Cotton Voile, 2.5 metres","bn":"কটন ভয়েল, ২.৫ মিটার"},"workDetails":{"en":"Digital floral print, no embellishment","bn":"ডিজিটাল ফুলেল প্রিন্ট, কোনো বাড়তি কাজ নেই"},"fabricLength":{"en":"Total 8 metres (undready)","bn":"মোট ৮ মিটার (আনস্টিচড)"},"colourInfo":{"en":"Pastel pink with cream floral motifs","bn":"পেস্টেল পিংকের উপর ক্রিম রঙের ফুলেল নকশা"}}'::jsonb,'null'::jsonb,4.5,18
from public.categories c left join public.collections col on col.slug='everyday-elegance' where c.slug='unstitched-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1769031364744-9fecc63d93cd?w=900&h=1125&fit=crop&q=80&auto=format','Floral Cotton Unstitched Set','ফ্লোরাল কটন আনস্টিচড সেট',0,true from public.products p where p.slug='floral-cotton-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1769031364744-9fecc63d93cd?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&h=1125&fit=crop&q=80&auto=format','Floral Cotton Unstitched Set','ফ্লোরাল কটন আনস্টিচড সেট',1,false from public.products p where p.slug='floral-cotton-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-102-UNDREADY-PASTEL-PINK','Unstitched','Pastel Pink','পেস্টেল পিংক','#D8B4A0',10,true from public.products where slug='floral-cotton-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-102-UNDREADY-BEIGE','Unstitched','Beige','বেইজ','#C9BBA5',10,true from public.products where slug='floral-cotton-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Sadia R.',5,'Perfect for summer, very breathable fabric.','গরমের জন্য একদম পারফেক্ট, কাপড়টা খুব আরামদায়ক।','approved','2026-04-11T00:00:00Z'::timestamptz from public.products p where p.slug='floral-cotton-unstitched-set' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Sadia R.' and existing.created_at='2026-04-11T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'wine-chikankari-unstitched-set','Wine Chikankari Unstitched Set','ওয়াইন চিকনকারি আনস্টিচড সেট','Rich wine-coloured georgette with traditional chikankari hand embroidery, perfect for festive occasions and gatherings.','উৎসব ও অনুষ্ঠানের জন্য উপযুক্ত ঐতিহ্যবাহী চিকনকারি হাতের কাজসহ গাঢ় ওয়াইন রঙের জর্জেট।',c.id,col.id,4200,4900,'Georgette','জর্জেট','TR-UN-103','active',false,true,true,'Dry clean only. Store folded in a cool dry place away from direct sunlight.','শুধুমাত্র ড্রাই ক্লিন করুন। সরাসরি রোদ থেকে দূরে ঠান্ডা ও শুকনো জায়গায় ভাঁজ করে রাখুন।',array['chikankari','festive','georgette'],'{"kameezFabric":{"en":"Georgette, 3.25 metres","bn":"জর্জেট, ৩.২৫ মিটার"},"salwarFabric":{"en":"Silk Blend, 2.5 metres","bn":"সিল্ক ব্লেন্ড, ২.৫ মিটার"},"dupattaFabric":{"en":"Net with Border, 2.5 metres","bn":"বর্ডারসহ নেট, ২.৫ মিটার"},"workDetails":{"en":"Hand chikankari embroidery with sequin highlights","bn":"সিকুইনের কাজসহ হাতের চিকনকারি এমব্রয়ডারি"},"fabricLength":{"en":"Total 8.25 metres (undready)","bn":"মোট ৮.২৫ মিটার (আনস্টিচড)"},"colourInfo":{"en":"Deep wine with gold thread accents","bn":"গোল্ডেন সুতার কাজসহ গাঢ় ওয়াইন রং"}}'::jsonb,'null'::jsonb,4.9,41
from public.categories c left join public.collections col on col.slug='festive' where c.slug='unstitched-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format','Wine Chikankari Unstitched Set','ওয়াইন চিকনকারি আনস্টিচড সেট',0,true from public.products p where p.slug='wine-chikankari-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format','Wine Chikankari Unstitched Set','ওয়াইন চিকনকারি আনস্টিচড সেট',1,false from public.products p where p.slug='wine-chikankari-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-103-UNDREADY-WINE','Unstitched','Wine','ওয়াইন','#6F263D',8,true from public.products where slug='wine-chikankari-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Tasnim H.',5,'Absolutely stunning for weddings, got so many compliments.','বিয়ের অনুষ্ঠানের জন্য দারুণ, অনেক প্রশংসা পেয়েছি।','approved','2026-03-15T00:00:00Z'::timestamptz from public.products p where p.slug='wine-chikankari-unstitched-set' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Tasnim H.' and existing.created_at='2026-03-15T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'black-embroidered-unstitched-set','Black Embroidered Unstitched Set','ব্ল্যাক এমব্রয়ডারি আনস্টিচড সেট','A timeless black cotton silk set with subtle self-tone embroidery, versatile enough for both work and evening wear.','কাজ ও সন্ধ্যার পোশাক দুই ক্ষেত্রেই উপযোগী, হালকা সেলফ-টোন এমব্রয়ডারিসহ কালজয়ী কালো কটন সিল্ক সেট।',c.id,col.id,3100,null,'Cotton Silk','কটন সিল্ক','TR-UN-104','active',false,false,true,'Dry clean recommended for the first wash. Iron on low heat.','প্রথমবার ড্রাই ক্লিন করা ভালো। কম তাপে ইস্ত্রি করুন।',array['office','classic'],'{"kameezFabric":{"en":"Cotton Silk, 3.15 metres","bn":"কটন সিল্ক, ৩.১৫ মিটার"},"salwarFabric":{"en":"Cotton, 2.5 metres","bn":"কটন, ২.৫ মিটার"},"dupattaFabric":{"en":"Chiffon, 2.5 metres","bn":"শিফন, ২.৫ মিটার"},"workDetails":{"en":"Self-tone thread embroidery on neckline","bn":"গলায় সেলফ-টোন সুতার এমব্রয়ডারি"},"fabricLength":{"en":"Total 8.15 metres (undready)","bn":"মোট ৮.১৫ মিটার (আনস্টিচড)"},"colourInfo":{"en":"Solid black with tonal embroidery","bn":"একরঙা কালোর উপর সেলফ-টোন কাজ"}}'::jsonb,'null'::jsonb,4.6,27
from public.categories c left join public.collections col on col.slug='office-edit' where c.slug='unstitched-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1642618277064-73c0bd608111?w=900&h=1125&fit=crop&q=80&auto=format','Black Embroidered Unstitched Set','ব্ল্যাক এমব্রয়ডারি আনস্টিচড সেট',0,true from public.products p where p.slug='black-embroidered-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1642618277064-73c0bd608111?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&h=1125&fit=crop&q=80&auto=format','Black Embroidered Unstitched Set','ব্ল্যাক এমব্রয়ডারি আনস্টিচড সেট',1,false from public.products p where p.slug='black-embroidered-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-104-UNDREADY-BLACK','Unstitched','Black','কালো','#171717',16,true from public.products where slug='black-embroidered-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'printed-cotton-unstitched-set','Printed Cotton Unstitched Set','প্রিন্টেড কটন আনস্টিচড সেট','An everyday beige cotton set with a soft geometric print, light enough for daily wear at home or work.','নরম জ্যামিতিক প্রিন্টসহ একটি নিত্যদিনের বেইজ কটন সেট, ঘরে বা কাজে পরার জন্য যথেষ্ট হালকা।',c.id,col.id,1950,null,'Cotton','কটন','TR-UN-105','active',false,false,false,'Machine washable. Wash inside out to preserve print.','মেশিনে ধোয়া যাবে। প্রিন্ট অক্ষুণ্ণ রাখতে উল্টো করে ধুয়ে নিন।',array['everyday','printed'],'{"kameezFabric":{"en":"Cotton, 3 metres","bn":"কটন, ৩ মিটার"},"salwarFabric":{"en":"Cotton, 2.5 metres","bn":"কটন, ২.৫ মিটার"},"dupattaFabric":{"en":"Cotton Voile, 2.5 metres","bn":"কটন ভয়েল, ২.৫ মিটার"},"workDetails":{"en":"Geometric print, no embellishment","bn":"জ্যামিতিক প্রিন্ট, কোনো বাড়তি কাজ নেই"},"fabricLength":{"en":"Total 8 metres (undready)","bn":"মোট ৮ মিটার (আনস্টিচড)"},"colourInfo":{"en":"Beige with brown geometric pattern","bn":"বাদামি জ্যামিতিক নকশাসহ বেইজ রং"}}'::jsonb,'null'::jsonb,4.3,9
from public.categories c left join public.collections col on col.slug='everyday-elegance' where c.slug='unstitched-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format','Printed Cotton Unstitched Set','প্রিন্টেড কটন আনস্টিচড সেট',0,true from public.products p where p.slug='printed-cotton-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format','Printed Cotton Unstitched Set','প্রিন্টেড কটন আনস্টিচড সেট',1,false from public.products p where p.slug='printed-cotton-unstitched-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-UN-105-UNDREADY-BEIGE','Unstitched','Beige','বেইজ','#C9BBA5',25,true from public.products where slug='printed-cotton-unstitched-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'embroidered-lawn-kurta-set','Embroidered Lawn Kurta Set','এমব্রয়ডারি লন কুর্তা সেট','A ready-to-wear ivory kurta set with hand embroidery detailing on the placket and cuffs, tailored for an easy, relaxed fit.','প্লাকেট ও হাতায় হাতের কাজের বিবরণসহ একটি রেডি-টু-ওয়্যার আইভরি কুর্তা সেট, স্বাচ্ছন্দ্যময় ফিটের জন্য তৈরি।',c.id,col.id,2850,null,'Pure Lawn Cotton','খাঁটি লন কটন','TR-RD-201','active',true,true,true,'Dry clean recommended. Iron on medium heat, avoiding embroidered areas.','ড্রাই ক্লিন করা ভালো। এমব্রয়ডারি অংশ এড়িয়ে মাঝারি তাপে ইস্ত্রি করুন।',array['embroidered','ready-made'],'null'::jsonb,'{"sizeMeasurements":[{"size":"S","chest":"36 in","waist":"32 in","length":"42 in"},{"size":"M","chest":"38 in","waist":"34 in","length":"42.5 in"},{"size":"L","chest":"40 in","waist":"36 in","length":"43 in"},{"size":"XL","chest":"42 in","waist":"38 in","length":"43.5 in"}],"modelHeight":{"en":"5 ft 6 in","bn":"৫ ফুট ৬ ইঞ্চি"},"modelWearingSize":"S","fitInformation":{"en":"Relaxed fit, true to size","bn":"রিল্যাক্সড ফিট, সাইজ অনুযায়ী সঠিক"}}'::jsonb,4.8,36
from public.categories c left join public.collections col on col.slug='festive' where c.slug='ready-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=1125&fit=crop&q=80&auto=format','Embroidered Lawn Kurta Set','এমব্রয়ডারি লন কুর্তা সেট',0,true from public.products p where p.slug='embroidered-lawn-kurta-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&h=1125&fit=crop&q=80&auto=format','Embroidered Lawn Kurta Set','এমব্রয়ডারি লন কুর্তা সেট',1,false from public.products p where p.slug='embroidered-lawn-kurta-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-201-S-IVORY','S','Ivory','আইভরি','#EDE6D9',5,true from public.products where slug='embroidered-lawn-kurta-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-201-M-IVORY','M','Ivory','আইভরি','#EDE6D9',5,true from public.products where slug='embroidered-lawn-kurta-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-201-L-IVORY','L','Ivory','আইভরি','#EDE6D9',5,true from public.products where slug='embroidered-lawn-kurta-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-201-XL-IVORY','XL','Ivory','আইভরি','#EDE6D9',5,true from public.products where slug='embroidered-lawn-kurta-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Rummana K.',5,'Fits perfectly, exactly as shown in pictures.','ছবির মতোই একদম পারফেক্ট ফিট হয়েছে।','approved','2026-06-18T00:00:00Z'::timestamptz from public.products p where p.slug='embroidered-lawn-kurta-set' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Rummana K.' and existing.created_at='2026-06-18T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'pastel-pink-co-ord-set','Pastel Pink Co-ord Set','পেস্টেল পিংক কো-অর্ড সেট','A soft pastel pink georgette co-ord set with a flowy silhouette, ideal for daytime events and casual gatherings.','দিনের অনুষ্ঠান ও সাধারণ আড্ডার জন্য উপযোগী, নরম পেস্টেল পিংক জর্জেট কাপড়ে তৈরি একটি ফ্লোয়ি সিলুয়েট কো-অর্ড সেট।',c.id,col.id,2450,null,'Georgette','জর্জেট','TR-RD-202','active',true,true,false,'Hand wash cold or dry clean. Hang dry in shade.','ঠান্ডা পানিতে হাতে ধুয়ে নিন বা ড্রাই ক্লিন করুন। ছায়ায় ঝুলিয়ে শুকান।',array['co-ord','pastel'],'null'::jsonb,'{"sizeMeasurements":[{"size":"S","chest":"36 in","waist":"30 in","length":"41 in"},{"size":"M","chest":"38 in","waist":"32 in","length":"41.5 in"},{"size":"L","chest":"40 in","waist":"34 in","length":"42 in"}],"modelHeight":{"en":"5 ft 5 in","bn":"৫ ফুট ৫ ইঞ্চি"},"modelWearingSize":"S","fitInformation":{"en":"Flowy, relaxed silhouette","bn":"ফ্লোয়ি, রিল্যাক্সড সিলুয়েট"}}'::jsonb,4.6,14
from public.categories c left join public.collections col on col.slug='everyday-elegance' where c.slug='ready-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1769031364744-9fecc63d93cd?w=900&h=1125&fit=crop&q=80&auto=format','Pastel Pink Co-ord Set','পেস্টেল পিংক কো-অর্ড সেট',0,true from public.products p where p.slug='pastel-pink-co-ord-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1769031364744-9fecc63d93cd?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1784139021760-9f8ecb5c5586?w=900&h=1125&fit=crop&q=80&auto=format','Pastel Pink Co-ord Set','পেস্টেল পিংক কো-অর্ড সেট',1,false from public.products p where p.slug='pastel-pink-co-ord-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1784139021760-9f8ecb5c5586?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-S-PASTEL-PINK','S','Pastel Pink','পেস্টেল পিংক','#D8B4A0',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-S-IVORY','S','Ivory','আইভরি','#EDE6D9',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-M-PASTEL-PINK','M','Pastel Pink','পেস্টেল পিংক','#D8B4A0',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-M-IVORY','M','Ivory','আইভরি','#EDE6D9',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-L-PASTEL-PINK','L','Pastel Pink','পেস্টেল পিংক','#D8B4A0',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-202-L-IVORY','L','Ivory','আইভরি','#EDE6D9',2,true from public.products where slug='pastel-pink-co-ord-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'black-embellished-kurta','Black Embellished Kurta','ব্ল্যাক এমবেলিশড কুর্তা','A structured black kurta with delicate hand embellishment on the collar, designed to transition effortlessly from day to night.','কলারে সূক্ষ্ম হাতের কাজসহ একটি স্ট্রাকচার্ড কালো কুর্তা, দিন থেকে রাত পর্যন্ত অনায়াসে মানানসই।',c.id,col.id,2750,3200,'Cotton Silk','কটন সিল্ক','TR-RD-203','active',false,true,true,'Dry clean only.','শুধুমাত্র ড্রাই ক্লিন করুন।',array['kurta','embellished'],'null'::jsonb,'{"sizeMeasurements":[{"size":"S","chest":"36 in","waist":"32 in","length":"44 in"},{"size":"M","chest":"38 in","waist":"34 in","length":"44.5 in"},{"size":"L","chest":"40 in","waist":"36 in","length":"45 in"},{"size":"XL","chest":"42 in","waist":"38 in","length":"45.5 in"}],"modelHeight":{"en":"5 ft 6 in","bn":"৫ ফুট ৬ ইঞ্চি"},"modelWearingSize":"M","fitInformation":{"en":"Structured, tailored fit","bn":"স্ট্রাকচার্ড, টেইলর্ড ফিট"}}'::jsonb,4.7,29
from public.categories c left join public.collections col on col.slug='office-edit' where c.slug='ready-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1642618277064-73c0bd608111?w=900&h=1125&fit=crop&q=80&auto=format','Black Embellished Kurta','ব্ল্যাক এমবেলিশড কুর্তা',0,true from public.products p where p.slug='black-embellished-kurta' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1642618277064-73c0bd608111?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format','Black Embellished Kurta','ব্ল্যাক এমবেলিশড কুর্তা',1,false from public.products p where p.slug='black-embellished-kurta' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-203-S-BLACK','S','Black','কালো','#171717',4,true from public.products where slug='black-embellished-kurta' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-203-M-BLACK','M','Black','কালো','#171717',4,true from public.products where slug='black-embellished-kurta' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-203-L-BLACK','L','Black','কালো','#171717',4,true from public.products where slug='black-embellished-kurta' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-203-XL-BLACK','XL','Black','কালো','#171717',4,true from public.products where slug='black-embellished-kurta' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Ishrat J.',5,'So versatile, wore it to work and to a dinner both.','খুবই বহুমুখী, অফিসে এবং ডিনারে দুই জায়গায়ই পরেছি।','approved','2026-05-02T00:00:00Z'::timestamptz from public.products p where p.slug='black-embellished-kurta' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Ishrat J.' and existing.created_at='2026-05-02T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'wine-georgette-ready-set','Wine Georgette Ready Set','ওয়াইন জর্জেট রেডি সেট','An elegant ready-to-wear wine georgette three piece with sequin embroidery, made for festive celebrations.','সিকুইনের এমব্রয়ডারিসহ একটি রেডি-টু-ওয়্যার এলিগেন্ট ওয়াইন জর্জেট থ্রি পিস, উৎসব উদযাপনের জন্য তৈরি।',c.id,col.id,4600,null,'Georgette','জর্জেট','TR-RD-204','active',false,false,true,'Dry clean only. Store on a padded hanger.','শুধুমাত্র ড্রাই ক্লিন করুন। প্যাডেড হ্যাঙ্গারে ঝুলিয়ে রাখুন।',array['festive','embellished'],'null'::jsonb,'{"sizeMeasurements":[{"size":"S","chest":"36 in","waist":"32 in","length":"43 in"},{"size":"M","chest":"38 in","waist":"34 in","length":"43.5 in"},{"size":"L","chest":"40 in","waist":"36 in","length":"44 in"}],"modelHeight":{"en":"5 ft 6 in","bn":"৫ ফুট ৬ ইঞ্চি"},"modelWearingSize":"S","fitInformation":{"en":"Semi-fitted, flows from the waist","bn":"সেমি-ফিটেড, কোমর থেকে ফ্লোয়ি"}}'::jsonb,4.9,22
from public.categories c left join public.collections col on col.slug='festive' where c.slug='ready-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format','Wine Georgette Ready Set','ওয়াইন জর্জেট রেডি সেট',0,true from public.products p where p.slug='wine-georgette-ready-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=900&h=1125&fit=crop&q=80&auto=format','Wine Georgette Ready Set','ওয়াইন জর্জেট রেডি সেট',1,false from public.products p where p.slug='wine-georgette-ready-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-204-S-WINE','S','Wine','ওয়াইন','#6F263D',2,true from public.products where slug='wine-georgette-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-204-M-WINE','M','Wine','ওয়াইন','#6F263D',2,true from public.products where slug='wine-georgette-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-204-L-WINE','L','Wine','ওয়াইন','#6F263D',2,true from public.products where slug='wine-georgette-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'beige-linen-ready-set','Beige Linen Ready Set','বেইজ লিনেন রেডি সেট','A minimal beige linen three piece with clean lines, perfect for those who prefer understated everyday elegance.','যারা সাধারণ দৈনন্দিন সৌন্দর্য পছন্দ করেন তাদের জন্য পরিষ্কার লাইনসহ একটি মিনিমাল বেইজ লিনেন থ্রি পিস।',c.id,col.id,2650,null,'Linen','লিনেন','TR-RD-205','active',false,false,false,'Machine washable cold. Iron while slightly damp for best results.','ঠান্ডা পানিতে মেশিনে ধোয়া যাবে। ভালো ফলাফলের জন্য সামান্য ভেজা অবস্থায় ইস্ত্রি করুন।',array['linen','minimal'],'null'::jsonb,'{"sizeMeasurements":[{"size":"S","chest":"36 in","waist":"32 in","length":"42 in"},{"size":"M","chest":"38 in","waist":"34 in","length":"42.5 in"},{"size":"L","chest":"40 in","waist":"36 in","length":"43 in"},{"size":"XL","chest":"42 in","waist":"38 in","length":"43.5 in"}],"modelHeight":{"en":"5 ft 5 in","bn":"৫ ফুট ৫ ইঞ্চি"},"modelWearingSize":"M","fitInformation":{"en":"Straight, relaxed fit","bn":"স্ট্রেইট, রিল্যাক্সড ফিট"}}'::jsonb,4.4,11
from public.categories c left join public.collections col on col.slug='everyday-elegance' where c.slug='ready-three-piece'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format','Beige Linen Ready Set','বেইজ লিনেন রেডি সেট',0,true from public.products p where p.slug='beige-linen-ready-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format','Beige Linen Ready Set','বেইজ লিনেন রেডি সেট',1,false from public.products p where p.slug='beige-linen-ready-set' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-205-S-BEIGE','S','Beige','বেইজ','#C9BBA5',3,true from public.products where slug='beige-linen-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-205-M-BEIGE','M','Beige','বেইজ','#C9BBA5',3,true from public.products where slug='beige-linen-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-205-L-BEIGE','L','Beige','বেইজ','#C9BBA5',3,true from public.products where slug='beige-linen-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-RD-205-XL-BEIGE','XL','Beige','বেইজ','#C9BBA5',3,true from public.products where slug='beige-linen-ready-set' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'minimal-shoulder-bag','Minimal Shoulder Bag','মিনিমাল শোল্ডার ব্যাগ','A structured minimal shoulder bag in soft beige leather, finished with gold-tone hardware and an adjustable strap.','গোল্ড টোন হার্ডওয়্যার ও অ্যাডজাস্টেবল স্ট্র্যাপসহ নরম বেইজ চামড়ায় তৈরি একটি স্ট্রাকচার্ড মিনিমাল শোল্ডার ব্যাগ।',c.id,col.id,1650,null,'Vegan Leather','ভেগান লেদার','TR-AC-301','active',true,true,true,'Wipe with a soft, dry cloth. Avoid prolonged exposure to direct sunlight and moisture.','নরম শুকনো কাপড় দিয়ে মুছে নিন। সরাসরি রোদ ও আর্দ্রতা এড়িয়ে চলুন।',array['bag','everyday'],'null'::jsonb,'null'::jsonb,4.6,24
from public.categories c left join public.collections col on col.slug='accessories-edit' where c.slug='accessories'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1711548244653-72219aa9ac27?w=900&h=1125&fit=crop&q=80&auto=format','Minimal Shoulder Bag','মিনিমাল শোল্ডার ব্যাগ',0,true from public.products p where p.slug='minimal-shoulder-bag' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1711548244653-72219aa9ac27?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1691480150204-66dd1eb77391?w=900&h=1125&fit=crop&q=80&auto=format','Minimal Shoulder Bag','মিনিমাল শোল্ডার ব্যাগ',1,false from public.products p where p.slug='minimal-shoulder-bag' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1691480150204-66dd1eb77391?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-AC-301-ONE-SIZE-BEIGE','One Size','Beige','বেইজ','#C9BBA5',15,true from public.products where slug='minimal-shoulder-bag' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-AC-301-ONE-SIZE-BLACK','One Size','Black','কালো','#171717',15,true from public.products where slug='minimal-shoulder-bag' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;
insert into public.reviews(product_id,author_name,rating,comment_en,comment_bn,status,created_at) select p.id,'Meherun N.',5,'Great everyday size and the hardware looks premium.','দৈনন্দিন ব্যবহারের জন্য সঠিক সাইজ, হার্ডওয়্যারটাও বেশ প্রিমিয়াম লাগে।','approved','2026-06-25T00:00:00Z'::timestamptz from public.products p where p.slug='minimal-shoulder-bag' and not exists (select 1 from public.reviews existing where existing.product_id=p.id and existing.author_name='Meherun N.' and existing.created_at='2026-06-25T00:00:00Z'::timestamptz);

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'structured-tote-bag','Structured Tote Bag','স্ট্রাকচার্ড টোট ব্যাগ','A spacious black structured tote bag, ideal for daily essentials with a secure zip closure and interior pockets.','নিরাপদ জিপ ক্লোজার ও ভিতরে পকেটসহ দৈনন্দিন প্রয়োজনীয় জিনিসপত্রের জন্য উপযুক্ত একটি প্রশস্ত কালো স্ট্রাকচার্ড টোট ব্যাগ।',c.id,col.id,1950,2300,'Vegan Leather','ভেগান লেদার','TR-AC-302','active',false,false,true,'Wipe clean with a damp cloth. Store in dust bag when not in use.','ভেজা কাপড় দিয়ে মুছে পরিষ্কার করুন। ব্যবহার না করলে ডাস্ট ব্যাগে রাখুন।',array['bag','tote'],'null'::jsonb,'null'::jsonb,4.5,16
from public.categories c left join public.collections col on col.slug='accessories-edit' where c.slug='accessories'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1705909237050-7a7625b47fac?w=900&h=1125&fit=crop&q=80&auto=format','Structured Tote Bag','স্ট্রাকচার্ড টোট ব্যাগ',0,true from public.products p where p.slug='structured-tote-bag' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1705909237050-7a7625b47fac?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1605733513597-a8f8341084e6?w=900&h=1125&fit=crop&q=80&auto=format','Structured Tote Bag','স্ট্রাকচার্ড টোট ব্যাগ',1,false from public.products p where p.slug='structured-tote-bag' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1605733513597-a8f8341084e6?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-AC-302-ONE-SIZE-BLACK','One Size','Black','কালো','#171717',21,true from public.products where slug='structured-tote-bag' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'pearl-drop-earrings','Pearl Drop Earrings','পার্ল ড্রপ ইয়াররিং','Elegant gold-plated drop earrings featuring freshwater pearl accents, a subtle finishing touch for any outfit.','ফ্রেশওয়াটার পার্লের কাজসহ গোল্ড-প্লেটেড ড্রপ ইয়াররিং, যেকোনো পোশাকের জন্য একটি সূক্ষ্ম ফিনিশিং টাচ।',c.id,col.id,850,null,'Gold-plated Brass, Freshwater Pearl','গোল্ড-প্লেটেড ব্রাস, ফ্রেশওয়াটার পার্ল','TR-AC-303','active',true,false,false,'Keep away from water and perfume. Store in a jewellery pouch.','পানি ও পারফিউম থেকে দূরে রাখুন। জুয়েলারি পাউচে সংরক্ষণ করুন।',array['jewellery','earrings'],'null'::jsonb,'null'::jsonb,4.8,19
from public.categories c left join public.collections col on col.slug='accessories-edit' where c.slug='accessories'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1561828995-aa79a2db86dd?w=900&h=1125&fit=crop&q=80&auto=format','Pearl Drop Earrings','পার্ল ড্রপ ইয়াররিং',0,true from public.products p where p.slug='pearl-drop-earrings' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1561828995-aa79a2db86dd?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1657291334522-6c1dfb9e2b35?w=900&h=1125&fit=crop&q=80&auto=format','Pearl Drop Earrings','পার্ল ড্রপ ইয়াররিং',1,false from public.products p where p.slug='pearl-drop-earrings' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1657291334522-6c1dfb9e2b35?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-AC-303-ONE-SIZE-GOLD','One Size','Gold','গোল্ড','#B8974E',40,true from public.products where slug='pearl-drop-earrings' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

insert into public.products(slug,name_en,name_bn,description_en,description_bn,category_id,collection_id,base_price,compare_at_price,fabric_en,fabric_bn,product_code,status,is_new,is_featured,is_best_seller,care_instructions_en,care_instructions_bn,tags,unstitched_details,ready_made_details,average_rating,review_count)
select 'layered-gold-necklace','Layered Gold Necklace','লেয়ার্ড গোল্ড নেকলেস','A delicate layered necklace in gold-tone finish, designed to be worn alone or stacked for a festive look.','একা পরার জন্য বা উৎসবের লুকের জন্য স্তরে স্তরে পরার উপযোগী গোল্ড-টোন ফিনিশের একটি সূক্ষ্ম নেকলেস।',c.id,col.id,1250,null,'Gold-plated Brass','গোল্ড-প্লেটেড ব্রাস','TR-AC-304','active',false,true,false,'Avoid contact with water, perfume, and lotion to preserve the finish.','ফিনিশ ঠিক রাখতে পানি, পারফিউম ও লোশন থেকে দূরে রাখুন।',array['jewellery','necklace','festive'],'null'::jsonb,'null'::jsonb,4.6,12
from public.categories c left join public.collections col on col.slug='festive' where c.slug='accessories'
on conflict (slug) do update set name_en=excluded.name_en,name_bn=excluded.name_bn,description_en=excluded.description_en,description_bn=excluded.description_bn,category_id=excluded.category_id,collection_id=excluded.collection_id,base_price=excluded.base_price,compare_at_price=excluded.compare_at_price,fabric_en=excluded.fabric_en,fabric_bn=excluded.fabric_bn,product_code=excluded.product_code,status=excluded.status,is_new=excluded.is_new,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,care_instructions_en=excluded.care_instructions_en,care_instructions_bn=excluded.care_instructions_bn,tags=excluded.tags,unstitched_details=excluded.unstitched_details,ready_made_details=excluded.ready_made_details;
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1657603738389-951c374b740c?w=900&h=1125&fit=crop&q=80&auto=format','Layered Gold Necklace','লেয়ার্ড গোল্ড নেকলেস',0,true from public.products p where p.slug='layered-gold-necklace' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1657603738389-951c374b740c?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_images(product_id,image_url,alt_en,alt_bn,sort_order,is_primary) select p.id,'https://images.unsplash.com/photo-1561828995-aa79a2db86dd?w=900&h=1125&fit=crop&q=80&auto=format','Layered Gold Necklace','লেয়ার্ড গোল্ড নেকলেস',1,false from public.products p where p.slug='layered-gold-necklace' and not exists (select 1 from public.product_images existing where existing.product_id=p.id and existing.image_url='https://images.unsplash.com/photo-1561828995-aa79a2db86dd?w=900&h=1125&fit=crop&q=80&auto=format');
insert into public.product_variants(product_id,sku,size,colour_en,colour_bn,colour_hex,stock_quantity,is_active) select id,'TR-AC-304-ONE-SIZE-GOLD','One Size','Gold','গোল্ড','#B8974E',27,true from public.products where slug='layered-gold-necklace' on conflict (sku) do update set size=excluded.size,colour_en=excluded.colour_en,colour_bn=excluded.colour_bn,colour_hex=excluded.colour_hex,is_active=true;

-- 25. Verification checks: fail the transaction if core setup is incomplete
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'profiles', 'addresses', 'categories', 'collections', 'products',
    'product_images', 'product_variants', 'carts', 'cart_items',
    'wishlist_items', 'coupons', 'coupon_redemptions', 'orders',
    'order_items', 'order_tracking_events', 'reviews', 'store_settings',
    'contact_messages', 'newsletter_subscribers'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'TARA setup verification failed: missing table %', required_table;
    end if;
  end loop;

  if to_regprocedure('public.handle_new_user()') is null
    or to_regprocedure('public.is_staff()') is null
    or to_regprocedure('public.is_full_admin()') is null
    or to_regprocedure('public.place_order(jsonb,jsonb,jsonb,text,text,text,text)') is null then
    raise exception 'TARA setup verification failed: required functions are missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and not tgisinternal
  ) then
    raise exception 'TARA setup verification failed: Auth profile trigger is missing';
  end if;
end;
$$;

select
  'TARA Supabase setup completed successfully' as result,
  (select count(*) from public.products where status = 'active') as active_products,
  (select count(*) from public.product_variants where is_active) as active_variants,
  (select count(*) from public.profiles) as repaired_profiles;

commit;
