begin;

-- ---------------------------------------------------------------------------
-- 1. Columns, registry type, freeze
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists archived_at timestamptz;
create index if not exists orders_archived_at_idx on public.orders (archived_at) where archived_at is not null;

alter table public.archived_items drop constraint if exists archived_items_entity_type_check;
alter table public.archived_items add constraint archived_items_entity_type_check
  check (entity_type in ('product', 'category', 'collection', 'coupon', 'review', 'order'));

create or replace function public.orders_archive_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived_at is not null and new.archived_at is null then
    perform public.archive_require_restore_right();
  elsif old.archived_at is not null
     and (new.status is distinct from old.status or new.payment_status is distinct from old.payment_status) then
    raise exception 'order_archived';
  end if;
  return new;
end;
$$;

create or replace function public.orders_archive_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    perform public.archive_register(
      'order', new.id, new.order_number,
      initcap(replace(new.status::text, '_', ' ')) || ' · ৳' || trim(to_char(new.total, 'FM999,999,990.00')),
      jsonb_build_object('status', new.status::text)
    );
  elsif old.archived_at is not null and new.archived_at is null then
    perform public.archive_unregister('order', new.id, new.order_number);
  end if;
  return null;
end;
$$;

drop trigger if exists orders_archive_guard on public.orders;
create trigger orders_archive_guard
  before update on public.orders
  for each row execute function public.orders_archive_guard();

drop trigger if exists orders_archive_sync on public.orders;
create trigger orders_archive_sync
  after update of archived_at on public.orders
  for each row execute function public.orders_archive_sync();

revoke execute on function public.orders_archive_guard() from public, anon, authenticated;
revoke execute on function public.orders_archive_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Keep the 0023 catalogue logic as internal helpers, wrap it with orders
-- ---------------------------------------------------------------------------
--
-- Renamed rather than copied, so there is one implementation of each rule. The
-- helpers lose their grants: they are reachable only through the wrappers,
-- which make the permission check first.

do $$
begin
  if to_regprocedure('public.archive_catalogue_archive_item(text,uuid)') is null then
    alter function public.admin_archive_item(text, uuid) rename to archive_catalogue_archive_item;
  end if;
  if to_regprocedure('public.archive_catalogue_restore_item(text,uuid)') is null then
    alter function public.admin_restore_archived_item(text, uuid) rename to archive_catalogue_restore_item;
  end if;
  if to_regprocedure('public.archive_catalogue_purge_item(text,uuid)') is null then
    alter function public.admin_purge_archived_item(text, uuid) rename to archive_catalogue_purge_item;
  end if;
end;
$$;

revoke execute on function public.archive_catalogue_archive_item(text, uuid) from public, anon, authenticated;
revoke execute on function public.archive_catalogue_restore_item(text, uuid) from public, anon, authenticated;
revoke execute on function public.archive_catalogue_purge_item(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Order purge
-- ---------------------------------------------------------------------------

create or replace function public.purge_archived_order(p_id uuid, p_restock_shipped boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record record;
  item record;
  redemption record;
  should_restock boolean;
  item_count integer;
begin
  -- Repeated here, not only in the callers, so the rule holds wherever this is
  -- reached from.
  perform public.require_permission('archive.manage');

  select id, order_number, status, payment_status, total, created_at, stock_restored_at, archived_at
    into order_record
    from public.orders where id = p_id
    for update;
  if not found then
    delete from public.archived_items where entity_type = 'order' and entity_id = p_id;
    raise exception 'item_not_found';
  end if;
  if order_record.archived_at is null then raise exception 'not_archived'; end if;

  select count(*) into item_count from public.order_items where order_id = p_id;

  -- 1. Stock, exactly once.
  should_restock := order_record.stock_restored_at is null and (
    order_record.status in ('pending', 'confirmed', 'processing', 'packed')
    or (coalesce(p_restock_shipped, false) and order_record.status in ('shipped', 'delivered'))
  );

  if should_restock then
    perform set_config('tara.stock_write', 'on', true);
    for item in
      select product_variant_id, sum(quantity)::integer as quantity
      from public.order_items where order_id = p_id
      group by product_variant_id
    loop
      insert into public.inventory_adjustments (
        product_variant_id, order_id, previous_quantity, new_quantity, delta,
        reason, note, adjusted_by
      )
      select v.id, p_id, v.stock_quantity, v.stock_quantity + item.quantity, item.quantity,
             'order_deleted_restock', order_record.order_number, auth.uid()
      from public.product_variants v where v.id = item.product_variant_id;

      update public.product_variants
        set stock_quantity = stock_quantity + item.quantity
        where id = item.product_variant_id;
    end loop;
    perform set_config('tara.stock_write', 'off', true);
  end if;

  -- 2. Coupon usage.
  for redemption in
    select coupon_id, count(*)::integer as uses
    from public.coupon_redemptions where order_id = p_id
    group by coupon_id
  loop
    update public.coupons
      set usage_count = greatest(usage_count - redemption.uses, 0)
      where id = redemption.coupon_id;
  end loop;

  -- 3. Reviews stay; only their link to this order goes.
  update public.reviews set order_item_id = null
    where order_item_id in (select id from public.order_items where order_id = p_id);

  -- 4. The order and everything that exists only because of it.
  delete from public.archived_items where entity_type = 'order' and entity_id = p_id;
  delete from public.orders where id = p_id;

  -- 5. Accountability without personal data.
  perform public.log_admin_action(
    'order.purged', 'order', p_id::text, order_record.order_number,
    jsonb_build_object(
      'orderNumber', order_record.order_number,
      'status', order_record.status,
      'paymentStatus', order_record.payment_status,
      'total', order_record.total,
      'items', item_count,
      'placedAt', order_record.created_at,
      'stockReturned', should_restock
    ),
    null, null
  );

  return jsonb_build_object('ok', true, 'orderNumber', order_record.order_number, 'restocked', should_restock);
end;
$$;

revoke execute on function public.purge_archived_order(uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The public entry points
-- ---------------------------------------------------------------------------

create or replace function public.admin_archive_item(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  if p_type <> 'order' then
    return public.archive_catalogue_archive_item(p_type, p_id);
  end if;

  perform public.require_permission('archive.manage');
  update public.orders set archived_at = now()
    where id = p_id and archived_at is null returning id into found_id;
  if found_id is null then raise exception 'item_not_found'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_restore_archived_item(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  perform public.require_permission('archive.manage');
  if p_type <> 'order' then
    return public.archive_catalogue_restore_item(p_type, p_id);
  end if;

  if not exists (select 1 from public.archived_items where entity_type = 'order' and entity_id = p_id) then
    raise exception 'not_archived';
  end if;
  update public.orders set archived_at = null
    where id = p_id and archived_at is not null returning id into found_id;
  if found_id is null then
    delete from public.archived_items where entity_type = 'order' and entity_id = p_id;
    raise exception 'item_not_found';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_purge_archived_item(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('archive.manage');
  if p_type <> 'order' then
    return public.archive_catalogue_purge_item(p_type, p_id);
  end if;
  -- From the Trash, stock is returned only for orders that never shipped.
  return public.purge_archived_order(p_id, false);
end;
$$;

-- The Orders screen's delete: archives the order first if it is not already,
-- so every permanent delete still passes through the Trash, then purges it.
create or replace function public.admin_purge_archived_order(p_id uuid, p_restock_shipped boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('archive.manage');
  update public.orders set archived_at = now() where id = p_id and archived_at is null;
  return public.purge_archived_order(p_id, p_restock_shipped);
end;
$$;

revoke execute on function public.admin_archive_item(text, uuid) from public, anon;
revoke execute on function public.admin_restore_archived_item(text, uuid) from public, anon;
revoke execute on function public.admin_purge_archived_item(text, uuid) from public, anon;
revoke execute on function public.admin_purge_archived_order(uuid, boolean) from public, anon;
grant execute on function public.admin_archive_item(text, uuid) to authenticated;
grant execute on function public.admin_restore_archived_item(text, uuid) to authenticated;
grant execute on function public.admin_purge_archived_item(text, uuid) to authenticated;
grant execute on function public.admin_purge_archived_order(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. No direct deletes of order data through the API (restated)
-- ---------------------------------------------------------------------------

revoke delete on table public.orders, public.order_items, public.order_tracking_events,
  public.order_internal_notes, public.coupon_redemptions, public.inventory_adjustments
  from anon, authenticated;

commit;
