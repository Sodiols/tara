/*
TARA MIGRATION 0005 — English-only storefront, Bangla columns kept for compatibility

Run after 0004_cod_only_standard_delivery.sql. Safe to re-run.

WHY THIS EXISTS
---------------
The storefront and the admin panel are now English only. Nothing in the
application reads or writes a `_bn` column any more.

Several `_bn` columns were declared `not null` WITHOUT a default:

  categories.name_bn
  collections.name_bn
  products.name_bn
  products.description_bn
  products.fabric_bn
  product_variants.colour_bn
  order_items.product_name_bn
  order_items.colour_bn

An insert that omits one of those columns fails with a not-null violation.
So the moment the admin panel stopped sending Bangla values, creating a
category, a collection, a product, a variant — and therefore placing an
order, because place_order() inserts order_items — would have broken.

WHAT THIS MIGRATION DOES
------------------------
Gives every one of those columns a default of ''. That is the smallest change
that makes English-only writes succeed.

WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--------------------------------------------
  * It does NOT drop a single column. Every `_bn` column stays exactly where
    it is, with every existing value intact.
  * It does NOT rewrite existing rows. Historic products, orders, order items,
    reviews, variants, categories and collections keep the Bangla text they
    were saved with, so old order history and invoices still read the same.
  * It does NOT change any RLS policy, grant, trigger, or business-rule
    function. place_order(), the stock guards, the coupon rules and the order
    status state machine are untouched.
  * It does NOT relax `not null`. The columns stay `not null`; they simply
    fill themselves with '' when the application omits them.

This means a rollback to a Bangla-aware build would still work: the columns,
the constraints and the data are all still there.
*/

begin;

alter table public.categories       alter column name_bn         set default '';
alter table public.collections      alter column name_bn         set default '';

alter table public.products         alter column name_bn         set default '';
alter table public.products         alter column description_bn  set default '';
alter table public.products         alter column fabric_bn       set default '';

alter table public.product_variants alter column colour_bn       set default '';

alter table public.order_items      alter column product_name_bn set default '';
alter table public.order_items      alter column colour_bn       set default '';

/*
place_order() copies product_name_bn / colour_bn out of the product and variant
rows into order_items. For a product created by the English-only admin panel
those source values are now '', which satisfies the not-null constraint. No
change to the function is required, so it is left alone on purpose.

Verification — every one of these should report a default of ''::text:

  select table_name, column_name, column_default, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and column_name like '%\_bn'
  order by table_name, column_name;
*/

commit;
