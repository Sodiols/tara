/*
TARA MIGRATION 0011 -- Remove the dead bilingual columns

Run after 0010. Safe to re-run. One transaction.

  THIS IS THE ONLY MIGRATION IN THIS SERIES THAT DESTROYS DATA.
  It is a separate file for exactly that reason: so it can be reviewed, and
  deferred, on its own. Everything in 0009 and 0010 works whether or not this
  has been applied.

WHY
---
TARA shipped bilingual and was made English-only in migration 0005, which took
the careful route: it left every `_bn` column in place and merely gave the
not-null ones a default of '' so English-only writes would succeed. That was
right at the time -- it kept a rollback possible.

Several releases later nothing reads a `_bn` column, nothing writes a meaningful
value into one, and they have become a liability rather than a safety net:

  * every insert carries eight extra columns of empty strings;
  * place_order() copied product_name_bn and colour_bn into order_items on every
    line of every order, so the hottest write path in the system did pointless
    work;
  * `select *` on products, variants and order items shipped them across the wire;
  * a developer reading the schema cannot tell that they are dead.

profiles.preferred_language and newsletter_subscribers.preferred_language go the
same way. Both were fixed at 'en' for every row written since 0005, and the two
admin screens that displayed them were showing a column that could only ever say
one thing.

WHAT THIS DOES
--------------
Drops the columns, and rebuilds the product search index, which was built over
name_en and name_bn together.

Every function that referenced one of these columns was already rewritten in
migration 0010, so nothing here has to touch a function body.

WHAT IS NOT REMOVED
-------------------
  * The Taka symbol. It is a currency symbol, not interface text.
  * Bangladeshi place names. bd_divisions and bd_districts hold the standard
    English spellings of real places, which have nothing to do with translation.
  * Any English content. name_en, description_en, comment_en and the rest are
    the live columns and are untouched.

DATA LOSS
---------
The Bangla text in existing rows is deleted with the columns. Every one of them
has an English sibling on the same row that the application has used exclusively
since 0005, so no order, product, review or tracking event loses information the
store actually uses.

If you want an archive, take it BEFORE running this:

  create table public.bilingual_archive as
    select id, name_bn, description_bn, fabric_bn from public.products;

VERIFY
------
  select table_name, column_name from information_schema.columns
  where table_schema = 'public'
    and (column_name like '%\_bn' or column_name = 'preferred_language');
  -- expect zero rows
*/

begin;

alter table public.categories           drop column if exists name_bn;
alter table public.categories           drop column if exists description_bn;
alter table public.collections          drop column if exists name_bn;
alter table public.collections          drop column if exists description_bn;
alter table public.products             drop column if exists name_bn;
alter table public.products             drop column if exists description_bn;
alter table public.products             drop column if exists fabric_bn;
alter table public.products             drop column if exists material_bn;
alter table public.products             drop column if exists care_instructions_bn;
alter table public.products             drop column if exists size_guide_note_bn;
alter table public.product_images       drop column if exists alt_bn;
alter table public.product_variants     drop column if exists colour_bn;
alter table public.order_items          drop column if exists product_name_bn;
alter table public.order_items          drop column if exists colour_bn;
alter table public.order_tracking_events drop column if exists note_bn;
alter table public.reviews              drop column if exists comment_bn;
alter table public.coupons              drop column if exists description_bn;
alter table public.profiles             drop column if exists preferred_language;
alter table public.newsletter_subscribers drop column if exists preferred_language;

-- The full-text search index in the base schema was built over name_en and
-- name_bn together. Rebuild it on the English column alone.
drop index if exists public.products_name_search_idx;
create index if not exists products_name_search_idx
  on public.products using gin (
    to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(product_code, ''))
  );

commit;
