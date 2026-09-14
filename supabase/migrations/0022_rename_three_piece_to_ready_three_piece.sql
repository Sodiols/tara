/*
TARA MIGRATION 0022 -- "Three Piece" is now "Ready Three Piece"

Run after 0021. Safe to re-run. One transaction. Destroys nothing.

WHAT CHANGES
------------
The customer-facing name of one category:

    three-piece   Three Piece   ->   Ready Three Piece

`categories.name_en` is what product cards, breadcrumbs and the category page
show whenever it is set, so the storefront wording in lib/utils.ts, the
navigation and the hero only fully takes effect once this has run. Staff can
make the same change by hand in /admin/categories; running this is equivalent.

THE SLUG IS NOT RENAMED
-----------------------
`three-piece` stays exactly as it is, for the reasons migrations 0014 and 0020
give: it is a live route, in the sitemap and in shared links. `/ready-three-piece`
is already a permanent redirect to `/two-piece` (next.config.mjs), so it could
not be reused for this category without breaking every old link to Two Piece.

VERIFY
------
  select slug, name_en from public.categories order by sort_order;
  -- three-piece | Ready Three Piece
*/

begin;

update public.categories
   set name_en = 'Ready Three Piece'
 where slug = 'three-piece'
   and name_en is distinct from 'Ready Three Piece';

commit;
