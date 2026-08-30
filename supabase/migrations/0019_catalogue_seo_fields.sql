/*
TARA MIGRATION 0019 -- Product SEO fields and image alt text reach the storefront

Run after 0018. Safe to re-run. One transaction. Destroys nothing.

THE PROBLEM
-----------
Three columns were editable in the admin panel, saved correctly, and then had
no effect whatsoever on the live site:

  products.seo_title        the <title> override
  products.seo_description  the meta description override
  product_images.alt_en     image alt text

The storefront never reads those tables directly. Every catalogue read --
listings, search, related products, and the product page itself -- goes through
search_catalogue(), which builds one JSON document per product, and that
projection did not include them. Staff could fill the fields in, watch them
save, reload the product page, and find the old title still in the tab.

WHAT THIS CHANGES
-----------------
Three additions to the item projection. Nothing is removed or renamed:

  seoTitle        null when blank, so the caller falls back to the product name
  seoDescription  null when blank, same
  media           the photographs as objects: url, alt, isPrimary, sortOrder

`images` is deliberately left exactly as it was -- a flat array of URLs in the
same order -- so every existing consumer keeps working and `media` is additive
alongside it rather than a breaking replacement.

NO SCHEMA CHANGE
----------------
No table, column, index or policy is touched. This replaces one function body,
with the same name, argument, return type, volatility, security setting and
search_path that 0009 created.

VERIFY
------
  select jsonb_pretty(public.search_catalogue('{"limit":1}'::jsonb) -> 'items' -> 0);
  -- expect seoTitle, seoDescription and media keys to be present
*/

begin;

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
              'sortOrder', i.sort_order
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


commit;
