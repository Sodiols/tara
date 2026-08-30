/*
TARA MIGRATION 0020 -- The category slugs catch up with their labels

Run after 0019. Safe to re-run. One transaction. Destroys nothing.

WHAT CHANGES
------------
    unstitched-three-piece  ->  unready-three-piece
    ready-three-piece       ->  two-piece

Nothing else. `three-piece`, `hijab`, `accessories` and `collection` keep the
slugs they have.

WHY
---
Migration 0014 renamed what customers are shown -- "Ready Three Piece" became
"Two Piece", "Unstitched Three Piece" became "Unready Three Piece" -- and
deliberately left the slugs alone, because a slug is a live URL and renaming one
breaks every link already shared. That was the right call at the time.

The cost was that the address bar disagreed with the page for two of the five
categories: a shopper on "Two Piece" was looking at /ready-three-piece. For a
storefront being prepared for search, the URL is also a ranking signal and a
thing people read in a result listing, so the disagreement is now worth paying
to remove -- once, with redirects, rather than repeatedly.

THIS IS ONLY ONE THIRD OF THE CHANGE
------------------------------------
A slug rename is three things that must ship together, or the site 404s:

  1. this migration                 the database
  2. app/unready-three-piece/,      the routes
     app/two-piece/
  3. next.config.mjs redirects()    permanent redirects from the old paths

Migration 0007 exists because a slug was once changed without the other two.
Do not apply this file without deploying the code in the same release.

WHAT IS NOT TOUCHED
-------------------
`products.category_id` is a foreign key to `categories.id`, not to the slug, so
no product row moves and no product changes category. Order snapshots are not
touched either -- an invoice keeps saying what it said.

VERIFY
------
  select slug, name_en, sort_order from public.categories order by sort_order;
  -- expect: unready-three-piece, three-piece, two-piece, hijab, accessories
*/

begin;

-- Guarded so a re-run is a no-op rather than an error, and so this cannot
-- clobber a slug that already holds the target name. `where` on the old value
-- means the second run simply matches nothing.
update public.categories
   set slug = 'unready-three-piece'
 where slug = 'unstitched-three-piece'
   and not exists (
     select 1 from public.categories c2 where c2.slug = 'unready-three-piece'
   );

update public.categories
   set slug = 'two-piece'
 where slug = 'ready-three-piece'
   and not exists (
     select 1 from public.categories c2 where c2.slug = 'two-piece'
   );

commit;
