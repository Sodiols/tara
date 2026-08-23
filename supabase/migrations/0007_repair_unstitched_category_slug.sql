/*
TARA MIGRATION 0007 — Repair the unstitched category slug

Run after 0006_fix_place_order_tracking_token.sql. Safe to re-run.

THE BUG
-------
The live database holds the built-in category as:

    slug    = 'unready-three-piece'
    name_en = 'Unready Three Piece'

The application asks for 'unstitched-three-piece' — that is the route
(app/unstitched-three-piece), the value in ProductCategory, the slug in
supabase/TARA_COMPLETE_SETUP.sql, and the word the brand actually uses.

getProducts() resolves a category filter by slug:

    select id from public.categories where slug = 'unstitched-three-piece'

which matched nothing, so the lookup returned early with an empty page. The
result: /unstitched-three-piece — a primary navigation item — rendered
"0 products found" while three active products sat in that very category, and
every product in it showed a breadcrumb built from a slug with no route.

"Unready"/"Undready" is a corrupted find-and-replace of "Unstitched". The same
corruption was present in the TypeScript sources and has been repaired there;
this migration repairs the one row that carries it in the database.

WHAT THIS DOES
--------------
Renames the slug and the display name, in place, by id. Nothing is deleted and
nothing is re-parented: `products.category_id` is a foreign key to
`categories.id`, and the id does not change — so all three products stay
attached to the same row and simply become reachable again.

The rename is guarded so it is a no-op if the slug is already correct, and it
refuses to run if a separate 'unstitched-three-piece' row somehow already
exists (which would otherwise violate the unique index on slug).

WHAT THIS DOES NOT DO
---------------------
It does not touch products, variants, images, orders or order history. It does
not change `name_bn`. Product SKUs that contain the string "UNDREADY"
(TR-UN-101-UNDREADY-IVORY and similar) are deliberately left alone — a SKU is
an opaque identifier that already appears on placed orders and printed
invoices, and no code matches on its text.
*/

begin;

do $$
declare
  wrong_id uuid;
  right_id uuid;
begin
  select id into wrong_id from public.categories where slug = 'unready-three-piece';
  select id into right_id from public.categories where slug = 'unstitched-three-piece';

  if wrong_id is null then
    raise notice 'No unready-three-piece category found — nothing to repair.';
    return;
  end if;

  if right_id is not null then
    raise exception
      'Both unready-three-piece and unstitched-three-piece exist. Merge them by hand: move products.category_id from % to %, then delete the empty row.',
      wrong_id, right_id;
  end if;

  update public.categories
     set slug    = 'unstitched-three-piece',
         name_en = 'Unstitched Three Piece',
         updated_at = now()
   where id = wrong_id;

  raise notice 'Category % renamed to unstitched-three-piece (% products attached).',
    wrong_id,
    (select count(*) from public.products where category_id = wrong_id);
end $$;

/*
VERIFY

  select slug, name_en,
         (select count(*) from public.products p
           where p.category_id = c.id and p.status = 'active') as active_products
  from public.categories c
  order by sort_order, slug;

Expect a row: unstitched-three-piece | Unstitched Three Piece | 3
and no row whose slug is 'unready-three-piece'.

Then load https://www.tarabd.co/unstitched-three-piece — it must list products
rather than "No products found".
*/

commit;
