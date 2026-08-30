/*
TARA MIGRATION 0017 -- The Three Piece category

Run after 0016. Safe to re-run. One transaction.

WHAT THIS DOES
--------------
Adds a fifth shop category, `three-piece`, and renumbers the others so the
database order matches the order the storefront renders:

    0  unstitched-three-piece   Unready Three Piece
    1  three-piece              Three Piece          <- new
    2  ready-three-piece        Two Piece
    3  hijab                    Hijab
    4  accessories              Accessories

WHY A MIGRATION AND NOT THE ADMIN PANEL
---------------------------------------
A category staff create in /admin/categories has no route of its own -- the
storefront gives a top-level page only to the built-in slugs, which are compiled
into `builtInCategoryLabels` in lib/utils.ts. `/three-piece` is now one of those
routes, and a route whose category row does not exist renders an empty listing
rather than a 404, which is a page that looks broken rather than one that says
something.

So the row and the route ship together. Running this file is what makes
`/three-piece` a real page; the row is otherwise identical to one created in the
admin panel, and staff can edit its name, description and imagery there
afterwards exactly as they can for any other category.

THE SLUG IS THE STABLE IDENTIFIER
---------------------------------
As with `unstitched-three-piece` and `ready-three-piece`, `three-piece` is a
live URL the moment this is deployed: it goes into the sitemap, it is linked
from the navigation, the footer, the homepage and the 404 page. The customer-
facing wording lives in `categories.name_en` and can be changed freely. The slug
cannot -- see migration 0007 for what a careless slug rename costs.

NO PRODUCTS ARE MOVED
---------------------
This creates an empty category. Nothing is reassigned to it: which products
belong in Three Piece rather than Unready Three Piece is a merchandising
decision, and it is made per product in /admin/products, not by a guess in a
migration.

VERIFY
------
  select slug, name_en, sort_order, is_active
  from public.categories
  order by sort_order;
  -- expect the five rows above, in that order
*/

begin;

-- `on conflict` rather than a bare insert: this file is re-runnable, and the
-- category may already exist if it was created from /admin/categories first.
-- Only the fields this migration is authoritative for are overwritten -- a
-- description or an image added by staff is left alone.
insert into public.categories (slug, name_en, sort_order, is_active)
values ('three-piece', 'Three Piece', 1, true)
on conflict (slug) do update
  set name_en    = excluded.name_en,
      sort_order = excluded.sort_order,
      is_active  = true;

-- Renumber the rest around it. Written as explicit per-slug updates rather than
-- an offset expression so that re-running cannot keep pushing them further
-- down: these are absolute positions, not increments.
update public.categories set sort_order = 0 where slug = 'unstitched-three-piece';
update public.categories set sort_order = 2 where slug = 'ready-three-piece';
update public.categories set sort_order = 3 where slug = 'hijab';
update public.categories set sort_order = 4 where slug = 'accessories';

commit;
