begin;
create table if not exists public.product_colours (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name_en text not null,
  colour_hex text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_colours_name_not_blank check (btrim(name_en) <> ''),
  constraint product_colours_hex_format check (colour_hex ~* '^#[0-9a-f]{6}$')
);
create unique index if not exists product_colours_unique_name_idx
  on public.product_colours (product_id, lower(btrim(name_en)));
create index if not exists product_colours_product_idx
  on public.product_colours (product_id, sort_order, id);

drop trigger if exists set_product_colours_updated_at on public.product_colours;
create trigger set_product_colours_updated_at
  before update on public.product_colours
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The two relationships
-- ---------------------------------------------------------------------------

-- ON DELETE SET NULL, not CASCADE: losing a colour must never take
-- photographs or purchasable rows with it. An image whose colour is removed
-- becomes a general product image again; a variant keeps its own colour_en
-- and colour_hex text and stays sellable.
alter table public.product_images
  add column if not exists product_colour_id uuid
  references public.product_colours(id) on delete set null;

alter table public.product_variants
  add column if not exists product_colour_id uuid
  references public.product_colours(id) on delete set null;

create index if not exists product_images_colour_idx
  on public.product_images (product_colour_id)
  where product_colour_id is not null;
create index if not exists product_variants_colour_idx
  on public.product_variants (product_colour_id)
  where product_colour_id is not null;

-- ---------------------------------------------------------------------------
-- Integrity: a colour may only be used by its own product
-- ---------------------------------------------------------------------------

/*
A composite foreign key would express this declaratively, but it needs a unique
key on (id, product_id) plus a second index on both child tables purely to
support it. One trigger per table costs nothing on write and states the rule
once.
*/
create or replace function public.product_colour_belongs_to_product()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  owner_id uuid;
begin
  if new.product_colour_id is null then
    return new;
  end if;

  select product_id into owner_id
  from public.product_colours
  where id = new.product_colour_id;

  if owner_id is null then
    raise exception 'colour_not_found';
  end if;
  if owner_id <> new.product_id then
    raise exception 'colour_belongs_to_another_product';
  end if;

  return new;
end;
$fn$;

drop trigger if exists product_images_colour_owner on public.product_images;
create trigger product_images_colour_owner
  before insert or update of product_colour_id, product_id on public.product_images
  for each row execute function public.product_colour_belongs_to_product();

drop trigger if exists product_variants_colour_owner on public.product_variants;
create trigger product_variants_colour_owner
  before insert or update of product_colour_id, product_id on public.product_variants
  for each row execute function public.product_colour_belongs_to_product();

-- ---------------------------------------------------------------------------
-- Integrity: the colour row is the authority for a variant's colour text
-- ---------------------------------------------------------------------------

create or replace function public.product_variant_sync_colour()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  source record;
begin
  if new.product_colour_id is null then
    return new;
  end if;

  select name_en, colour_hex into source
  from public.product_colours
  where id = new.product_colour_id;

  if not found then
    raise exception 'colour_not_found';
  end if;

  -- Whatever the caller sent is discarded. The database decides what "Maroon"
  -- is called and which hex it is drawn in.
  new.colour_en := btrim(source.name_en);
  new.colour_hex := upper(source.colour_hex);
  return new;
end;
$fn$;

drop trigger if exists product_variants_sync_colour on public.product_variants;
create trigger product_variants_sync_colour
  before insert or update of product_colour_id, colour_en, colour_hex
  on public.product_variants
  for each row execute function public.product_variant_sync_colour();

/* Renaming a colour, or recolouring its swatch, rewrites the variants that
   point at it — so the invoice, the inventory list and the catalogue filter
   never show a name the admin panel has stopped using. */
create or replace function public.product_colour_propagate()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if btrim(new.name_en) is distinct from btrim(old.name_en)
     or upper(new.colour_hex) is distinct from upper(old.colour_hex) then
    update public.product_variants
      set colour_en = btrim(new.name_en),
          colour_hex = upper(new.colour_hex)
      where product_colour_id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists product_colours_propagate on public.product_colours;
create trigger product_colours_propagate
  after update on public.product_colours
  for each row execute function public.product_colour_propagate();

/*
Deleting a colour that variants still use is refused.

The exception is the product itself being deleted: the hard delete in 0023
removes the product row first, and the cascade that follows reaches colours and
variants in an order Postgres chooses. Checking that the parent product is
still there tells the two cases apart without weakening the rule.
*/
create or replace function public.product_colour_delete_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.products where id = old.product_id) then
    return old;
  end if;

  if exists (
    select 1 from public.product_variants
    where product_colour_id = old.id
  ) then
    raise exception 'colour_in_use';
  end if;

  return old;
end;
$fn$;

drop trigger if exists product_colours_delete_guard on public.product_colours;
create trigger product_colours_delete_guard
  before delete on public.product_colours
  for each row execute function public.product_colour_delete_guard();

-- ---------------------------------------------------------------------------
-- Backfill: one colour row per (product, colour), not one per size
-- ---------------------------------------------------------------------------

insert into public.product_colours (product_id, name_en, colour_hex, sort_order)
select
  grouped.product_id,
  grouped.name_en,
  grouped.colour_hex,
  row_number() over (
    partition by grouped.product_id order by grouped.first_seen, grouped.name_en
  ) - 1 as sort_order
from (
  select
    v.product_id,
    btrim(v.colour_en) as name_en,
    upper(min(v.colour_hex)) as colour_hex,
    min(v.created_at) as first_seen
  from public.product_variants v
  where coalesce(btrim(v.colour_en), '') <> ''
  group by v.product_id, btrim(v.colour_en)
) grouped
on conflict do nothing;

-- Matched case-insensitively, the same way the unique index reads them.
update public.product_variants v
   set product_colour_id = c.id
  from public.product_colours c
 where c.product_id = v.product_id
   and lower(btrim(c.name_en)) = lower(btrim(v.colour_en))
   and v.product_colour_id is null
   and coalesce(btrim(v.colour_en), '') <> '';

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

alter table public.product_colours enable row level security;

drop policy if exists product_colours_public_read on public.product_colours;
drop policy if exists product_colours_staff_manage on public.product_colours;

-- Customers read active colours of active products; staff see everything,
-- which is what the admin panel's draft products need. The same shape as
-- product_images_public_read, so there is one rule to reason about.
create policy product_colours_public_read on public.product_colours for select
  using (
    (is_active and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    ))
    or public.is_staff()
  );

create policy product_colours_staff_manage on public.product_colours for all
  using (public.has_permission('catalogue.manage'))
  with check (public.has_permission('catalogue.manage'));

revoke all on table public.product_colours from anon, authenticated;
grant select on table public.product_colours to anon;
grant select, insert, update, delete on table public.product_colours to authenticated;

-- ---------------------------------------------------------------------------
-- search_catalogue(): photographs now say which colour they belong to
--
-- Reproduced from 0019 with two additions — `colourId` on each media entry and
-- `id` on each colour — so the product page can group photographs by colour
-- without a second query. Everything else is byte-identical, and listings
-- simply ignore the new fields.
-- ---------------------------------------------------------------------------

create or replace function public.search_catalogue(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f_slug text := nullif(trim(coalesce(p_filters ->> 'slug', '')), '');
  f_slugs text[] := case
    when jsonb_typeof(p_filters -> 'slugs') = 'array'
     and jsonb_array_length(p_filters -> 'slugs') > 0
    then array(select jsonb_array_elements_text(p_filters -> 'slugs')) else null end;
  f_category text := nullif(trim(coalesce(p_filters ->> 'categorySlug', '')), '');
  f_collection text := nullif(trim(coalesce(p_filters ->> 'collectionSlug', '')), '');
  f_query text := nullif(trim(coalesce(p_filters ->> 'query', '')), '');
  f_bands jsonb := case
    when jsonb_typeof(p_filters -> 'priceBands') = 'array'
     and jsonb_array_length(p_filters -> 'priceBands') > 0
    then p_filters -> 'priceBands' else null end;
  f_sizes text[] := case
    when jsonb_typeof(p_filters -> 'sizes') = 'array'
     and jsonb_array_length(p_filters -> 'sizes') > 0
    then array(select jsonb_array_elements_text(p_filters -> 'sizes')) else null end;
  f_colours text[] := case
    when jsonb_typeof(p_filters -> 'colours') = 'array'
     and jsonb_array_length(p_filters -> 'colours') > 0
    then array(select jsonb_array_elements_text(p_filters -> 'colours')) else null end;
  f_fabrics text[] := case
    when jsonb_typeof(p_filters -> 'fabrics') = 'array'
     and jsonb_array_length(p_filters -> 'fabrics') > 0
    then array(select jsonb_array_elements_text(p_filters -> 'fabrics')) else null end;
  f_collection_names text[] := case
    when jsonb_typeof(p_filters -> 'collectionNames') = 'array'
     and jsonb_array_length(p_filters -> 'collectionNames') > 0
    then array(select jsonb_array_elements_text(p_filters -> 'collectionNames')) else null end;
  f_in_stock boolean := coalesce((p_filters ->> 'inStock')::boolean, false);
  f_on_sale boolean := coalesce((p_filters ->> 'onSale')::boolean, false);
  f_is_new boolean := coalesce((p_filters ->> 'isNew')::boolean, false);
  f_featured boolean := coalesce((p_filters ->> 'featured')::boolean, false);
  f_best_seller boolean := coalesce((p_filters ->> 'bestSeller')::boolean, false);
  f_sort text := coalesce(nullif(trim(coalesce(p_filters ->> 'sort', '')), ''), 'newest');
  -- 480 = 20 pages of 24, which is the most the listing will ever ask for in
  -- one request. It has to be at least that: getProducts() requests
  -- pageSize * page so a refresh at page 3 re-renders all 72 products the
  -- shopper had revealed, and a lower cap here would silently truncate it while
  -- the client still believed there was more.
  f_limit integer := least(480, greatest(1, coalesce((p_filters ->> 'limit')::integer, 24)));
  f_offset integer := greatest(0, coalesce((p_filters ->> 'offset')::integer, 0));
  -- ILIKE metacharacters are neutralised rather than escaped: a shopper typing
  -- "50%" is looking for products, not building a pattern.
  f_query_pattern text := case
    when f_query is null then null
    else '%' || regexp_replace(f_query, '[%_\\]', ' ', 'g') || '%'
  end;
  result jsonb;
begin
  with scope as (
    -- Every filter, variant conditions included, applied BEFORE any paging.
    select p.id, p.base_price, p.created_at, p.review_count
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.collections col on col.id = p.collection_id
    where p.status = 'active'
      and (f_slug is null or p.slug = f_slug)
      and (f_slugs is null or p.slug = any(f_slugs))
      and (f_category is null or c.slug = f_category)
      and (
        f_collection is null
        or (col.slug = f_collection and public.collection_is_visible(col.id))
      )
      and (
        f_collection_names is null
        or (col.name_en = any(f_collection_names) and public.collection_is_visible(col.id))
      )
      and (
        f_query is null
        or p.name_en ilike f_query_pattern
        or p.product_code ilike f_query_pattern
        or lower(f_query) = any(p.tags)
      )
      and (f_fabrics is null or p.fabric_en = any(f_fabrics))
      and (not f_on_sale or p.compare_at_price is not null)
      and (not f_is_new or p.is_new)
      and (not f_featured or p.is_featured)
      and (not f_best_seller or p.is_best_seller)
      and (
        f_bands is null
        or exists (
          select 1
          from jsonb_array_elements(f_bands) as band
          where p.base_price >= coalesce((band ->> 'min')::numeric, 0)
            and p.base_price <= coalesce((band ->> 'max')::numeric, 999999999)
        )
      )
      and (
        (f_sizes is null and f_colours is null and not f_in_stock)
        or exists (
          select 1
          from public.product_variants v
          where v.product_id = p.id
            and v.is_active
            and (f_sizes is null or v.size = any(f_sizes))
            and (f_colours is null or v.colour_en = any(f_colours))
            and (not f_in_stock or v.stock_quantity > 0)
        )
      )
  ),
  -- Only the page's rows are joined out to images, variants and taxonomy, so
  -- the cost of building the payload is proportional to what is displayed
  -- rather than to how many products matched.
  page as (
    select p.*
    from public.products p
    join scope s on s.id = p.id
    order by
      -- Every branch ends in id, so two products that tie on the sort key keep
      -- a stable relative order between requests. Without it, page 2 could
      -- repeat a product from page 1 and skip another.
      case when f_sort = 'price-low' then p.base_price end asc nulls last,
      case when f_sort = 'price-high' then p.base_price end desc nulls last,
      case when f_sort = 'popular' then p.review_count end desc nulls last,
      case when f_sort not in ('price-low', 'price-high', 'popular')
           then p.created_at end desc nulls last,
      p.id
    limit f_limit offset f_offset
  )
  select jsonb_build_object(
    -- The count is of the whole filtered set, variant conditions included, so
    -- "73 products" always means 73 products a shopper could reach by paging.
    'total', (select count(*) from scope),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'slug', p.slug,
          'name', p.name_en,
          'description', p.description_en,
          -- Staff-entered overrides for <title> and the meta description.
          -- Null when blank, so the storefront falls back to name/description.
          'seoTitle', nullif(trim(coalesce(p.seo_title, '')), ''),
          'seoDescription', nullif(trim(coalesce(p.seo_description, '')), ''),
          'category', coalesce(c.slug, 'collection'),
          'categoryName', c.name_en,
          'price', p.base_price,
          'previousPrice', p.compare_at_price,
          'images', coalesce(media.images, '[]'::jsonb),
          -- The same photographs with their stored alt text, primary flag
          -- and order. `images` above is unchanged so nothing that reads a
          -- flat URL array has to change.
          'media', coalesce(media.media, '[]'::jsonb),
          'colours', coalesce(variants.colours, '[]'::jsonb),
          'sizes', coalesce(variants.sizes, '[]'::jsonb),
          'fabric', p.fabric_en,
          'stock', coalesce(variants.total_stock, 0),
          'tags', to_jsonb(p.tags),
          'collection', case
            when col.id is not null and public.collection_is_visible(col.id)
            then col.name_en else '' end,
          'isNew', p.is_new,
          'isSale', p.compare_at_price is not null,
          'isFeatured', p.is_featured,
          'isBestSeller', p.is_best_seller,
          -- Denormalised on the product row and kept current by the
          -- reviews_recalculate_rating trigger. No review bodies are read here.
          'rating', p.average_rating,
          'reviewCount', p.review_count,
          'productCode', p.product_code,
          'careInstructions', p.care_instructions_en,
          'unstitchedDetails', p.unstitched_details,
          'readyMadeDetails', p.ready_made_details
        )
        order by
          case when f_sort = 'price-low' then p.base_price end asc nulls last,
          case when f_sort = 'price-high' then p.base_price end desc nulls last,
          case when f_sort = 'popular' then p.review_count end desc nulls last,
          case when f_sort not in ('price-low', 'price-high', 'popular')
               then p.created_at end desc nulls last,
          p.id
      )
      from page p
      left join public.categories c on c.id = p.category_id
      left join public.collections col on col.id = p.collection_id
      left join lateral (
        select
          jsonb_agg(i.image_url order by i.is_primary desc, i.sort_order, i.id) as images,
          jsonb_agg(
            jsonb_build_object(
              'url', i.image_url,
              -- Blank alt is returned as null, not '': the storefront needs to
              -- tell "nobody has written alt text yet" (derive one from the
              -- product name) from "deliberately decorative".
              'alt', nullif(trim(coalesce(i.alt_en, '')), ''),
              'isPrimary', i.is_primary,
              'sortOrder', i.sort_order,
              -- Null for a general photograph that belongs to the product
              -- rather than to one colourway. The product page groups by this;
              -- listings ignore it.
              'colourId', i.product_colour_id
            ) order by i.is_primary desc, i.sort_order, i.id
          ) as media
        from public.product_images i
        where i.product_id = p.id
      ) media on true
      left join lateral (
        select
          (
            -- Qualified with the derived table's alias throughout: `name` and
            -- `size` are both non-reserved keywords, and an unqualified one
            -- inside a correlated subquery is exactly the kind of reference
            -- that binds to the wrong relation when a column is added later.
            select jsonb_agg(
              jsonb_build_object('name', c2.name, 'hex', c2.hex, 'id', c2.colour_id)
              order by c2.name
            )
            from (
              select v.colour_en as name, min(v.colour_hex) as hex,
                     min(v.product_colour_id::text)::uuid as colour_id
              from public.product_variants v
              where v.product_id = p.id and v.is_active
                and coalesce(trim(v.colour_en), '') <> ''
              group by v.colour_en
            ) c2
          ) as colours,
          (
            select jsonb_agg(to_jsonb(s2.size) order by s2.size)
            from (
              select distinct v.size as size
              from public.product_variants v
              where v.product_id = p.id and v.is_active
            ) s2
          ) as sizes,
          (
            select coalesce(sum(v.stock_quantity), 0)
            from public.product_variants v
            where v.product_id = p.id and v.is_active
          ) as total_stock
      ) variants on true
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order(): the order line stores the photograph of the colour bought
--
-- Reproduced from 0013 with one change — the image chosen for `order_items.
-- product_image_url` prefers the bought colour's own photograph, falling back
-- to the product's primary image exactly as before when the variant has no
-- colour or that colour has no images. The URL is still copied into the order
-- row at order time, so a later catalogue edit cannot rewrite history.
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

grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text, text, text)
  to anon, authenticated;

commit;

/*
VERIFY

  -- one colour per colourway, never one per size
  select p.name_en, c.name_en, count(v.id) as variants
  from public.product_colours c
  join public.products p on p.id = c.product_id
  left join public.product_variants v on v.product_colour_id = c.id
  group by 1, 2 order by 1, 2;

  -- every backfilled variant points at a colour, and the text still matches
  select count(*) as mismatched
  from public.product_variants v
  join public.product_colours c on c.id = v.product_colour_id
  where btrim(v.colour_en) <> btrim(c.name_en);

  -- existing photographs are untouched and still general
  select count(*) filter (where product_colour_id is null) as general,
         count(*) filter (where product_colour_id is not null) as by_colour
  from public.product_images;
*/
