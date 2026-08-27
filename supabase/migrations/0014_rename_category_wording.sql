/*
TARA MIGRATION 0014 -- "Two Piece" and "Unready": the customer-facing rename

Run after 0013. Safe to re-run. One transaction.

WHAT CHANGED
------------
Two categories are now called something different:

    Ready Three Piece        ->  Two Piece
    Unstitched Three Piece   ->  Unready Three Piece

and the placeholder size on a product sold as fabric follows:

    Unstitched               ->  Unready

THE SLUGS ARE NOT RENAMED
-------------------------
`ready-three-piece` and `unstitched-three-piece` stay exactly as they are.

They are live routes, they are in the sitemap and in Search Console, every
product row points at them by id through a category whose slug is one of these,
and customers have the URLs bookmarked and shared. Renaming a slug 404s all of
that in order to change words that `categories.name_en` and
`lib/utils.ts` already change.

Migration 0007 exists precisely because a previous careless rename corrupted
this slug to `unready-three-piece` and made the whole category vanish from the
storefront. That is not repeated here.

So: the slug is the stable identifier, the name is the wording.

THE SIZE VALUE
--------------
`product_variants.size` really does hold the word, and it is shown to the
customer on the product page, in the bag and on the order — so it is renamed.
It has now been spelled three ways in this database:

    "Undready"    a corrupted find-and-replace, repaired by 0007
    "Unstitched"  what 0007 restored
    "Unready"     current

Both older spellings are matched below, so a database that never had 0007
applied cleanly still ends up consistent.

WHAT IS DELIBERATELY NOT RENAMED
--------------------------------
  * `order_items.size` -- order snapshots. An invoice has to keep saying what it
    said when it was issued; rewriting delivered orders to match today's
    vocabulary is falsifying a record. `lib/product-size.ts` resolves all three
    spellings on read, so historic orders and carts still work.

  * `product_variants.sku` -- SKUs containing "UNDREADY" are opaque identifiers
    printed on packing slips and used by staff to find stock. They are not read
    as words by anyone.

  * `unstitched_details` / `ready_made_details` columns -- internal identifiers,
    never rendered as text.

ALSO IN THIS MIGRATION
----------------------
Two functions matched the old size literal and are recreated:

  * catalogue_facets()   kept "Unstitched" out of the Size filter. Now excludes
                         every spelling, so the placeholder cannot appear as a
                         filterable size before OR after the data rename.
  * resolve_cart_lines() mapped "Undready" -> "Unstitched" for saved carts. Now
                         maps both legacy spellings to "Unready".

VERIFY
------
  select slug, name_en from public.categories order by sort_order;
  -- ready-three-piece | Two Piece
  -- unstitched-three-piece | Unready Three Piece

  select distinct size from public.product_variants order by size;
  -- no "Unstitched", no "Undready"

  select public.catalogue_facets('{}'::jsonb) -> 'sizes';
  -- contains no placeholder size
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Category names. The slugs are untouched.
-- ---------------------------------------------------------------------------

update public.categories
   set name_en = 'Two Piece'
 where slug = 'ready-three-piece'
   and name_en is distinct from 'Two Piece';

update public.categories
   set name_en = 'Unready Three Piece'
 where slug = 'unstitched-three-piece'
   and name_en is distinct from 'Unready Three Piece';

-- ---------------------------------------------------------------------------
-- 2. The placeholder size on live variants
-- ---------------------------------------------------------------------------
--
-- Only product_variants. order_items keeps whatever each order was placed with.

update public.product_variants
   set size = 'Unready'
 where size in ('Unstitched', 'Undready');

-- ---------------------------------------------------------------------------
-- 3. Functions that matched the old spelling
-- ---------------------------------------------------------------------------

-- The sidebar's options.
--
-- Only the size exclusion list changed: it now covers every spelling the
-- placeholder has had, so it is filtered out whether or not step 2 has run --
-- which matters because a database restored from an older backup will have the
-- old values back.
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
        where v.is_active
          and v.size not in ('One Size', 'Unready', 'Unstitched', 'Undready')
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

revoke execute on function public.catalogue_facets(jsonb) from public;
grant execute on function public.catalogue_facets(jsonb) to anon, authenticated;

-- Resolves the browser's (product, size, colour) tuples to active variants.
--
-- Only the size mapping changed: a cart saved before either rename now resolves
-- to the current spelling instead of a variant row that no longer exists. Every
-- other rule -- the quantity clamp, the active-variant and active-product
-- joins, dropping lines that no longer resolve rather than failing the save --
-- is unchanged from migration 0010.
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
      case
        when element ->> 'size' in ('Undready', 'Unstitched') then 'Unready'
        else element ->> 'size'
      end as size,
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

-- An implementation detail of replace_cart_items() and merge_cart_items(),
-- exactly as in 0010: never reachable by a client.
revoke execute on function public.resolve_cart_lines(jsonb) from public, anon, authenticated;

commit;
