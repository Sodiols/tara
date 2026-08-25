/*
TARA MIGRATION 0009 -- Catalogue, shipping geography and the delivery charge

Run after 0008. Safe to re-run. One transaction: it either all applies or none
of it does.

This is the customer-facing half of the production hardening pass. Four faults,
all of which look fine on a fourteen-product test catalogue and none of which
survives contact with a real one.

1. FILTERING RAN AFTER PAGINATION
   The listing fetched the first 24 active products and THEN discarded the ones
   with no matching variant. A shopper filtering on XL saw "the XL products that
   happened to be in the first 24 rows" -- with 800 products, most XL stock was
   simply unreachable. The result count came from the same pre-filter query, so
   the page could say "24 products found" above three cards. And there was no
   secondary sort, so two products tying on price were returned in whatever
   order the planner chose, which can differ between requests: page 2 could
   repeat a product from page 1 and skip another.

2. SHIPPING DESTINATIONS WERE NOT VALIDATED
   place_order() accepted any two strings of two characters or more as the
   division and district. A request built by hand could create a real order for
   "Division: x1, District: y2" -- stock deducted, coupon spent, nothing
   deliverable. The dropdown was wrong too: it listed 30 places, four of which
   (Sylhet Sadar, Zakiganj, Golapganj, Beanibazar) are upazilas of Sylhet
   district rather than districts, and it omitted 40 of the country's 64 real
   districts, so a customer in Barguna could not enter their own address.

3. DELIVERY WAS GIVEN AWAY OUTSIDE SYLHET
   The announcement bar promised free delivery IN SYLHET. The code waived the
   fee EVERYWHERE above the threshold. Every large order shipping to Dhaka was
   delivered free at TARA's expense, because the copy and the calculation had
   been written at different times and nothing connected them.

4. LISTING PAGES READ EVERY REVIEW
   Each of the 24 products on a page pulled its complete approved reviews, full
   comment bodies included, to render a star rating that products already store
   as average_rating. Several hundred rows across the wire to display none of
   them.

WHAT THIS DOES
--------------
  bd_divisions / bd_districts        all 8 divisions, all 64 districts, each
                                     under the division it really belongs to
  resolve_shipping_location()        refuses an unknown division, an unknown
                                     district, AND a real district under the
                                     wrong division
  calculate_delivery_fee()           the single authority on what delivery
                                     costs, driven by store settings
  collection_is_visible()            one visibility rule for every entry point
  search_catalogue()                 every filter applied before paging, a
                                     deterministic sort, a true total, and no
                                     review bodies
  catalogue_facets()                 sidebar options across the whole scope
  place_order()                      validates the destination before locking a
                                     single row of stock, and prices delivery
                                     from calculate_delivery_fee()
  addresses                          division and district only, validated by
                                     the same function checkout uses

data/bangladesh-geography.ts and lib/delivery.ts mirror the geography and the
delivery rule for the browser. The database is the authority; those exist so the
price a customer is shown cannot drift from the price they are charged.

WHAT IS NOT CHANGED
-------------------
Prices, stock locking and deduction, coupon validation and usage counting,
idempotency, duplicate-order detection, the rate limits, cash on delivery and
the order event log all behave exactly as before. Existing orders are untouched:
their shipping_address jsonb keeps whatever it was placed with.

VERIFY
------
  select division_name, count(*) from public.bd_districts group by 1 order by 1;
  -- Barishal 6, Chattogram 11, Dhaka 13, Khulna 10, Mymensingh 4,
  -- Rajshahi 8, Rangpur 8, Sylhet 4 -- 64 in total

  select public.resolve_shipping_location('Sylhet', 'Zakiganj');    -- null (upazila)
  select public.resolve_shipping_location('Sylhet', 'Dhaka');       -- null (wrong division)
  select public.resolve_shipping_location('sylhet', 'moulvibazar'); -- Sylhet / Moulvibazar

  select public.calculate_delivery_fee(2000, 'Sylhet');   -- 0
  select public.calculate_delivery_fee(2000, 'Dhaka');    -- the outside fee
  select public.calculate_delivery_fee(500,  'Sylhet');   -- the inside fee

  select public.search_catalogue('{"sizes":["XL"],"limit":24,"offset":0}'::jsonb) -> 'total';
  select public.catalogue_facets('{"categorySlug":"ready-three-piece"}'::jsonb);

  select public.place_order(
    '{"name":"","email":"","phone":""}'::jsonb, '{}'::jsonb, '[]'::jsonb,
    'standard','cash_on_delivery',null,null,null,null
  );
  -- must raise invalid_customer_or_address
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Geography reference tables
-- ---------------------------------------------------------------------------

create table if not exists public.bd_divisions (
  name text primary key,
  sort_order integer not null default 0
);

create table if not exists public.bd_districts (
  name text primary key,
  division_name text not null references public.bd_divisions(name) on update cascade,
  sort_order integer not null default 0
);

create index if not exists bd_districts_division_idx
  on public.bd_districts(division_name, name);

-- Matching is done on a lowercased key so a saved address written with odd
-- capitalisation still resolves instead of being rejected at checkout.
create index if not exists bd_divisions_lookup_idx
  on public.bd_divisions(lower(name));
create index if not exists bd_districts_lookup_idx
  on public.bd_districts(division_name, lower(name));

insert into public.bd_divisions (name, sort_order) values
  ('Barishal', 0), ('Chattogram', 1), ('Dhaka', 2), ('Khulna', 3),
  ('Mymensingh', 4), ('Rajshahi', 5), ('Rangpur', 6), ('Sylhet', 7)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.bd_districts (name, division_name) values
  -- Barishal (6)
  ('Barguna','Barishal'), ('Barishal','Barishal'), ('Bhola','Barishal'),
  ('Jhalokati','Barishal'), ('Patuakhali','Barishal'), ('Pirojpur','Barishal'),
  -- Chattogram (11)
  ('Bandarban','Chattogram'), ('Brahmanbaria','Chattogram'), ('Chandpur','Chattogram'),
  ('Chattogram','Chattogram'), ('Cox''s Bazar','Chattogram'), ('Cumilla','Chattogram'),
  ('Feni','Chattogram'), ('Khagrachhari','Chattogram'), ('Lakshmipur','Chattogram'),
  ('Noakhali','Chattogram'), ('Rangamati','Chattogram'),
  -- Dhaka (13)
  ('Dhaka','Dhaka'), ('Faridpur','Dhaka'), ('Gazipur','Dhaka'), ('Gopalganj','Dhaka'),
  ('Kishoreganj','Dhaka'), ('Madaripur','Dhaka'), ('Manikganj','Dhaka'),
  ('Munshiganj','Dhaka'), ('Narayanganj','Dhaka'), ('Narsingdi','Dhaka'),
  ('Rajbari','Dhaka'), ('Shariatpur','Dhaka'), ('Tangail','Dhaka'),
  -- Khulna (10)
  ('Bagerhat','Khulna'), ('Chuadanga','Khulna'), ('Jashore','Khulna'),
  ('Jhenaidah','Khulna'), ('Khulna','Khulna'), ('Kushtia','Khulna'),
  ('Magura','Khulna'), ('Meherpur','Khulna'), ('Narail','Khulna'), ('Satkhira','Khulna'),
  -- Mymensingh (4)
  ('Jamalpur','Mymensingh'), ('Mymensingh','Mymensingh'),
  ('Netrokona','Mymensingh'), ('Sherpur','Mymensingh'),
  -- Rajshahi (8)
  ('Bogura','Rajshahi'), ('Chapai Nawabganj','Rajshahi'), ('Joypurhat','Rajshahi'),
  ('Naogaon','Rajshahi'), ('Natore','Rajshahi'), ('Pabna','Rajshahi'),
  ('Rajshahi','Rajshahi'), ('Sirajganj','Rajshahi'),
  -- Rangpur (8)
  ('Dinajpur','Rangpur'), ('Gaibandha','Rangpur'), ('Kurigram','Rangpur'),
  ('Lalmonirhat','Rangpur'), ('Nilphamari','Rangpur'), ('Panchagarh','Rangpur'),
  ('Rangpur','Rangpur'), ('Thakurgaon','Rangpur'),
  -- Sylhet (4)
  ('Habiganj','Sylhet'), ('Moulvibazar','Sylhet'),
  ('Sunamganj','Sylhet'), ('Sylhet','Sylhet')
on conflict (name) do update set division_name = excluded.division_name;

alter table public.bd_divisions enable row level security;
alter table public.bd_districts enable row level security;

drop policy if exists bd_divisions_public_read on public.bd_divisions;
create policy bd_divisions_public_read on public.bd_divisions for select using (true);
drop policy if exists bd_districts_public_read on public.bd_districts;
create policy bd_districts_public_read on public.bd_districts for select using (true);

-- Reference data: readable by everyone, writable by nobody through the API.
revoke insert, update, delete on table public.bd_divisions from anon, authenticated;
revoke insert, update, delete on table public.bd_districts from anon, authenticated;
grant select on table public.bd_divisions, public.bd_districts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Location validation
-- ---------------------------------------------------------------------------

-- Returns {"division": ..., "district": ...} in canonical spelling for a valid
-- pair, or null. Null covers all three ways a pair can be wrong: the division
-- does not exist, the district does not exist, or the district exists but under
-- a different division.
--
-- The 2018 renames are accepted as input so an address saved as "Barisal" or
-- "Chittagong" still checks out, and comes back spelled the current way.
create or replace function public.resolve_shipping_location(
  p_division text,
  p_district text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  division_key text := lower(regexp_replace(trim(coalesce(p_division, '')), '\s+', ' ', 'g'));
  district_key text := lower(regexp_replace(trim(coalesce(p_district, '')), '\s+', ' ', 'g'));
  resolved_division text;
  resolved_district text;
begin
  if division_key = '' or district_key = '' then
    return null;
  end if;

  division_key := case division_key
    when 'barisal' then 'barishal'
    when 'chittagong' then 'chattogram'
    else division_key
  end;

  district_key := case district_key
    when 'jessore' then 'jashore'
    when 'bogra' then 'bogura'
    when 'comilla' then 'cumilla'
    when 'chittagong' then 'chattogram'
    when 'barisal' then 'barishal'
    when 'nawabganj' then 'chapai nawabganj'
    when 'chapainawabganj' then 'chapai nawabganj'
    when 'coxs bazar' then 'cox''s bazar'
    when 'cox bazar' then 'cox''s bazar'
    when 'khagrachari' then 'khagrachhari'
    when 'maulvibazar' then 'moulvibazar'
    when 'moulavibazar' then 'moulvibazar'
    else district_key
  end;

  select d.name into resolved_division
  from public.bd_divisions d where lower(d.name) = division_key;
  if resolved_division is null then return null; end if;

  select t.name into resolved_district
  from public.bd_districts t
  where t.division_name = resolved_division and lower(t.name) = district_key;
  if resolved_district is null then return null; end if;

  return jsonb_build_object('division', resolved_division, 'district', resolved_district);
end;
$$;

grant execute on function public.resolve_shipping_location(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Delivery settings and the one pricing function
-- ---------------------------------------------------------------------------

insert into public.store_settings (key, value, is_public, label) values
  ('delivery_fee_inside_sylhet',  '60'::jsonb,       true, 'Delivery charge inside Sylhet'),
  ('delivery_fee_outside_sylhet', '120'::jsonb,      true, 'Delivery charge outside Sylhet'),
  ('free_delivery_enabled',       'true'::jsonb,     true, 'Free delivery offer enabled'),
  ('free_delivery_division',      '"Sylhet"'::jsonb, true, 'Division eligible for free delivery')
on conflict (key) do update
  set is_public = excluded.is_public, label = excluded.label;

-- An install that had already tuned standard_delivery_fee keeps that number as
-- its inside-Sylhet charge instead of silently reverting to the default, and
-- gets twice that as the outside charge until an administrator sets a real one.
-- Only applied where the new keys are still at their seeded defaults.
do $$
declare
  legacy numeric;
begin
  select (value #>> '{}')::numeric into legacy
  from public.store_settings where key = 'standard_delivery_fee';

  if legacy is not null and legacy > 0 then
    update public.store_settings
      set value = to_jsonb(legacy)
      where key = 'delivery_fee_inside_sylhet' and value = '60'::jsonb;
    update public.store_settings
      set value = to_jsonb(legacy * 2)
      where key = 'delivery_fee_outside_sylhet' and value = '120'::jsonb;
  end if;
end $$;

-- The delivery charge for a subtotal and a destination division.
--
-- Free delivery is an offer in one division only: reaching the threshold
-- outside it changes nothing. An unrecognised division is priced at the outside
-- rate, which is the safe direction -- but place_order() rejects one before this
-- is ever reached, so that branch only protects a future caller.
--
-- lib/delivery.ts implements the identical branches for display.
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
  inside_fee numeric;
  outside_fee numeric;
  threshold numeric;
  offer_enabled boolean;
  offer_division text;
  is_eligible boolean;
begin
  select (value #>> '{}')::numeric into inside_fee
    from public.store_settings where key = 'delivery_fee_inside_sylhet';
  select (value #>> '{}')::numeric into outside_fee
    from public.store_settings where key = 'delivery_fee_outside_sylhet';
  select (value #>> '{}')::numeric into threshold
    from public.store_settings where key = 'free_delivery_threshold';
  select (value #>> '{}')::boolean into offer_enabled
    from public.store_settings where key = 'free_delivery_enabled';
  select (value #>> '{}') into offer_division
    from public.store_settings where key = 'free_delivery_division';

  inside_fee     := greatest(coalesce(inside_fee, 60), 0);
  outside_fee    := greatest(coalesce(outside_fee, 120), 0);
  threshold      := greatest(coalesce(threshold, 1500), 0);
  offer_enabled  := coalesce(offer_enabled, true);
  offer_division := coalesce(nullif(trim(offer_division), ''), 'Sylhet');

  is_eligible := lower(trim(coalesce(p_division, ''))) = lower(offer_division);

  if not is_eligible then
    return outside_fee;
  end if;

  if offer_enabled and coalesce(p_subtotal, 0) >= threshold then
    return 0;
  end if;

  return inside_fee;
end;
$$;

grant execute on function public.calculate_delivery_fee(numeric, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Indexes for the filtered and sorted access patterns
-- ---------------------------------------------------------------------------

-- The three sort orders, each already narrowed to active products, so the
-- planner can walk the index instead of sorting the whole table. The trailing
-- id column is the deterministic tiebreak the pagination depends on.
create index if not exists products_active_created_idx
  on public.products (created_at desc, id) where status = 'active';
create index if not exists products_active_price_idx
  on public.products (base_price, id) where status = 'active';
create index if not exists products_active_popular_idx
  on public.products (review_count desc, id) where status = 'active';

-- The variant EXISTS subquery filters on all three of these together.
create index if not exists product_variants_facet_idx
  on public.product_variants (product_id, size, colour_en, stock_quantity)
  where is_active;

create index if not exists products_active_fabric_idx
  on public.products (fabric_en) where status = 'active';

-- ---------------------------------------------------------------------------
-- 5. Collection visibility, in one place
-- ---------------------------------------------------------------------------

-- A collection is shoppable only while it is active and inside its own
-- scheduling window. Every entry point -- the collection route, the navigation,
-- the sidebar filter, the sitemap -- asks this same question, so a collection
-- can never be withheld from one and offered by another.
create or replace function public.collection_is_visible(p_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collections c
    where c.id = p_collection_id
      and c.is_active
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
  );
$$;

grant execute on function public.collection_is_visible(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. search_catalogue -- filter first, then paginate
-- ---------------------------------------------------------------------------

/*
Accepted keys (all optional):

  slug            text     -- one exact product slug (used by the product page)
  slugs           [text]   -- several exact slugs (wishlist, recently viewed)
  categorySlug    text     -- exact category slug
  collectionSlug  text     -- exact collection slug (visibility is checked)
  query           text     -- matches name, product code or an exact tag
  priceBands      [{min,max}]  -- OR-ed together; disjoint bands stay disjoint
  sizes           [text]   -- variant size
  colours         [text]   -- variant colour
  fabrics         [text]   -- product fabric
  collectionNames [text]   -- collection display names (sidebar filter)
  inStock         boolean
  onSale          boolean
  isNew           boolean
  featured        boolean
  bestSeller      boolean
  sort            'newest' | 'price-low' | 'price-high' | 'popular'
  limit           integer  (1..480, default 24). The listing asks for
                           pageSize * page so that a refresh at page 3 renders
                           everything that was on screen, hence the high cap.
  offset          integer  (>= 0)

Returns: { "total": <int>, "items": [ <product>, ... ] }

The variant conditions are evaluated together against a SINGLE variant row, so
"XL" + "Wine" means the product is available in wine in XL -- not that it has an
XL variant somewhere and a wine variant somewhere else.
*/
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
          'category', coalesce(c.slug, 'collection'),
          'categoryName', c.name_en,
          'price', p.base_price,
          'previousPrice', p.compare_at_price,
          'images', coalesce(media.images, '[]'::jsonb),
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
        select jsonb_agg(i.image_url order by i.is_primary desc, i.sort_order, i.id) as images
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
            select jsonb_agg(jsonb_build_object('name', c2.name, 'hex', c2.hex) order by c2.name)
            from (
              select v.colour_en as name, min(v.colour_hex) as hex
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

grant execute on function public.search_catalogue(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. catalogue_facets -- the sidebar's options
-- ---------------------------------------------------------------------------

/*
The filter sidebar's options.

Computed over the whole scope (category / collection / search term) rather than
over the page being displayed, which is why the sidebar used to lose an option
as soon as you paged past the products that offered it.

Accepts the same categorySlug / collectionSlug / query keys as search_catalogue
and ignores the rest: a facet list that shrank every time you ticked a box in it
would make the filters impossible to undo.
*/
create or replace function public.catalogue_facets(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f_category text := nullif(trim(coalesce(p_filters ->> 'categorySlug', '')), '');
  f_collection text := nullif(trim(coalesce(p_filters ->> 'collectionSlug', '')), '');
  f_query text := nullif(trim(coalesce(p_filters ->> 'query', '')), '');
  f_query_pattern text := case
    when f_query is null then null
    else '%' || regexp_replace(f_query, '[%_\\]', ' ', 'g') || '%'
  end;
  result jsonb;
begin
  with scope as (
    select p.id, p.fabric_en, p.base_price, p.collection_id
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.collections col on col.id = p.collection_id
    where p.status = 'active'
      and (f_category is null or c.slug = f_category)
      and (
        f_collection is null
        or (col.slug = f_collection and public.collection_is_visible(col.id))
      )
      and (
        f_query is null
        or p.name_en ilike f_query_pattern
        or p.product_code ilike f_query_pattern
        or lower(f_query) = any(p.tags)
      )
  )
  select jsonb_build_object(
    -- Every reference below is alias-qualified. `size`, `name` and `colour` are
    -- non-reserved keywords and ordinary column names elsewhere in this schema,
    -- and an unqualified one inside a nested subquery is the kind of reference
    -- that silently binds to the wrong relation when a column is added later.
    'sizes', coalesce((
      select jsonb_agg(d.size order by d.size)
      from (
        select distinct v.size as size
        from public.product_variants v join scope s on s.id = v.product_id
        where v.is_active and v.size not in ('One Size', 'Unstitched')
      ) d
    ), '[]'::jsonb),
    'colours', coalesce((
      select jsonb_agg(d.colour order by d.colour)
      from (
        select distinct v.colour_en as colour
        from public.product_variants v join scope s on s.id = v.product_id
        where v.is_active and coalesce(trim(v.colour_en), '') <> ''
      ) d
    ), '[]'::jsonb),
    'fabrics', coalesce((
      select jsonb_agg(d.fabric order by d.fabric)
      from (
        select distinct trim(s.fabric_en) as fabric
        from scope s where coalesce(trim(s.fabric_en), '') <> ''
      ) d
    ), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(d.name order by d.name)
      from (
        select distinct col.name_en as name
        from scope s
        join public.collections col on col.id = s.collection_id
        where public.collection_is_visible(col.id)
          and coalesce(trim(col.name_en), '') <> ''
      ) d
    ), '[]'::jsonb),
    'minPrice', coalesce((select floor(min(s.base_price)) from scope s), 0),
    'maxPrice', coalesce((select ceil(max(s.base_price)) from scope s), 0),
    'total', (select count(*) from scope s)
  ) into result;

  return result;
end;
$$;

grant execute on function public.catalogue_facets(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. place_order() -- validates the destination, prices delivery by the rule
-- ---------------------------------------------------------------------------
--
-- Written once, in its final form. It reads no Bengali column, so migration
-- 0011 can drop those columns without touching this function -- and can be
-- deferred indefinitely without breaking it.

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
  resolved_location jsonb;
  shipping_division text;
  shipping_district text;
  normalised_address jsonb;
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
     or v_customer_phone is null
     or length(trim(coalesce(p_shipping_address ->> 'fullAddress', ''))) < 8 then
    raise exception 'invalid_customer_or_address';
  end if;

  resolved_location := public.resolve_shipping_location(
    p_shipping_address ->> 'division',
    p_shipping_address ->> 'district'
  );
  if resolved_location is null then
    raise exception 'invalid_shipping_location';
  end if;
  shipping_division := resolved_location ->> 'division';
  shipping_district := resolved_location ->> 'district';

  normalised_address := jsonb_build_object(
    'division', shipping_division,
    'district', shipping_district,
    'fullAddress', trim(p_shipping_address ->> 'fullAddress')
  );

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

  calculated_delivery := public.calculate_delivery_fee(calculated_subtotal, shipping_division);

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

-- ---------------------------------------------------------------------------
-- 9. The saved address book follows checkout
-- ---------------------------------------------------------------------------
--
-- Checkout stopped collecting upazila and area in migration 0004, but the
-- address book did not: both columns were `not null` with no default, so the
-- form still had to demand two fields the order then ignored, and a customer
-- whose upazila was not in the list had to invent one. The division and
-- district on an address were never validated either, so the book could hold
-- "Sylhet / Dhaka" and offer it at checkout, where place_order() now refuses
-- it.
--
-- Existing rows are NOT rewritten. A legacy address naming an unrecognised
-- district stays as it is for the customer to correct; silently rewriting
-- somebody's saved address to a place they did not choose would be worse.

alter table public.addresses alter column upazila drop not null;
alter table public.addresses alter column upazila set default '';
alter table public.addresses alter column area    drop not null;
alter table public.addresses alter column area    set default '';

create or replace function public.validate_address_location()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved jsonb;
begin
  resolved := public.resolve_shipping_location(new.division, new.district);
  if resolved is null then
    raise exception 'invalid_shipping_location';
  end if;
  -- Stored in the canonical spelling, so checkout, the courier label and the
  -- delivery-zone rule all read the same value.
  new.division := resolved ->> 'division';
  new.district := resolved ->> 'district';
  return new;
end;
$$;

drop trigger if exists addresses_validate_location on public.addresses;
create trigger addresses_validate_location
  before insert or update of division, district on public.addresses
  for each row execute function public.validate_address_location();

commit;
