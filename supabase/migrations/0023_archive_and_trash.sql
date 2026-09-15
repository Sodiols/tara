
begin;


create or replace function public.role_permissions(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','customers.manage','coupons.manage',
      'reviews.moderate','messages.manage','newsletter.manage','settings.manage',
      'staff.manage','audit.view','analytics.view','archive.manage'
    ]
    -- 'staff' is the legacy pre-migration role; it maps to manager so existing
    -- staff accounts keep working with no data change.
    when 'staff' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','coupons.manage','reviews.moderate',
      'messages.manage','newsletter.manage','analytics.view'
    ]
    when 'manager' then array[
      'catalogue.manage','inventory.adjust','orders.view','orders.fulfil','orders.cancel',
      'orders.payment','orders.note','customers.view','coupons.manage','reviews.moderate',
      'messages.manage','newsletter.manage','analytics.view'
    ]
    when 'fulfilment' then array[
      'orders.view','orders.fulfil','orders.note','inventory.adjust'
    ]
    when 'support' then array[
      'orders.view','orders.note','customers.view','messages.manage'
    ]
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Columns and the registry
-- ---------------------------------------------------------------------------

alter table public.categories add column if not exists archived_at timestamptz;
alter table public.collections add column if not exists archived_at timestamptz;
alter table public.reviews add column if not exists archived_at timestamptz;

create table if not exists public.archived_items (
  entity_type text not null
    check (entity_type in ('product', 'category', 'collection', 'coupon', 'review')),
  entity_id uuid not null,
  label text not null default '',
  detail text,
  previous_state jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  archived_by_email text not null default '',
  archived_by_role text not null default '',
  primary key (entity_type, entity_id)
);

create index if not exists archived_items_archived_at_idx
  on public.archived_items (archived_at desc);

alter table public.archived_items enable row level security;

drop policy if exists archived_items_admin_read on public.archived_items;
create policy archived_items_admin_read on public.archived_items for select
  using (public.has_permission('archive.manage'));

-- Written only by the SECURITY DEFINER triggers and functions below.
revoke all on table public.archived_items from anon, authenticated;
grant select on table public.archived_items to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Registry writers (internal)
-- ---------------------------------------------------------------------------

create or replace function public.archive_register(
  p_type text,
  p_id uuid,
  p_label text,
  p_detail text,
  p_previous jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
begin
  select id, email, role::text as role into actor
  from public.profiles where id = auth.uid();

  insert into public.archived_items (
    entity_type, entity_id, label, detail, previous_state,
    archived_at, archived_by, archived_by_email, archived_by_role
  ) values (
    p_type, p_id, coalesce(p_label, ''), p_detail, coalesce(p_previous, '{}'::jsonb),
    now(), actor.id, coalesce(actor.email, ''), coalesce(actor.role, 'system')
  )
  on conflict (entity_type, entity_id) do nothing;

  perform public.log_admin_action(
    p_type || '.archived', p_type, p_id::text, p_label, p_previous, null, null
  );
end;
$$;

create or replace function public.archive_unregister(p_type text, p_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.archived_items where entity_type = p_type and entity_id = p_id;
  perform public.log_admin_action(p_type || '.restored', p_type, p_id::text, p_label, null, null, null);
end;
$$;

-- Leaving the archive is an administrator's decision. auth.uid() is null only
-- for the service role and for migrations, which are trusted.
create or replace function public.archive_require_restore_right()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.has_permission('archive.manage') then
    raise exception 'permission_denied:archive.manage' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.archive_register(text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.archive_unregister(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.archive_require_restore_right() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- Products: archived is status = 'archived'.
create or replace function public.products_archive_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'archived' and new.status <> 'archived' then
    perform public.archive_require_restore_right();
    new.archived_at := null;
  elsif new.status = 'archived' and (tg_op = 'INSERT' or old.status <> 'archived') then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.products_archive_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'archived' and (tg_op = 'INSERT' or old.status <> 'archived') then
    perform public.archive_register(
      'product', new.id, new.name_en, new.product_code,
      jsonb_build_object('status', case when tg_op = 'INSERT' then 'draft' else old.status::text end)
    );
  elsif tg_op = 'UPDATE' and old.status = 'archived' and new.status <> 'archived' then
    perform public.archive_unregister('product', new.id, new.name_en);
  end if;
  return null;
end;
$$;

drop trigger if exists products_archive_guard on public.products;
create trigger products_archive_guard
  before insert or update of status on public.products
  for each row execute function public.products_archive_guard();

drop trigger if exists products_archive_sync on public.products;
create trigger products_archive_sync
  after insert or update of status on public.products
  for each row execute function public.products_archive_sync();

-- Categories, collections and coupons: archived is archived_at is not null, and
-- an archived row is never active.
create or replace function public.flag_archive_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null then
    perform public.archive_require_restore_right();
  end if;
  if new.archived_at is not null then
    new.is_active := false;
  end if;
  return new;
end;
$$;

create or replace function public.flag_archive_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity text := tg_argv[0];
  row_label text;
  row_detail text;
begin
  if entity = 'coupon' then
    row_label := new.code;
    row_detail := new.description_en;
  else
    row_label := new.name_en;
    row_detail := '/' || new.slug;
  end if;

  if new.archived_at is not null and (tg_op = 'INSERT' or old.archived_at is null) then
    perform public.archive_register(
      entity, new.id, row_label, row_detail,
      jsonb_build_object('is_active', case when tg_op = 'INSERT' then false else old.is_active end)
    );
  elsif tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null then
    perform public.archive_unregister(entity, new.id, row_label);
  end if;
  return null;
end;
$$;

drop trigger if exists categories_archive_guard on public.categories;
create trigger categories_archive_guard
  before insert or update on public.categories
  for each row execute function public.flag_archive_guard();
drop trigger if exists categories_archive_sync on public.categories;
create trigger categories_archive_sync
  after insert or update of archived_at on public.categories
  for each row execute function public.flag_archive_sync('category');

drop trigger if exists collections_archive_guard on public.collections;
create trigger collections_archive_guard
  before insert or update on public.collections
  for each row execute function public.flag_archive_guard();
drop trigger if exists collections_archive_sync on public.collections;
create trigger collections_archive_sync
  after insert or update of archived_at on public.collections
  for each row execute function public.flag_archive_sync('collection');

drop trigger if exists coupons_archive_guard on public.coupons;
create trigger coupons_archive_guard
  before insert or update on public.coupons
  for each row execute function public.flag_archive_guard();
drop trigger if exists coupons_archive_sync on public.coupons;
create trigger coupons_archive_sync
  after insert or update of archived_at on public.coupons
  for each row execute function public.flag_archive_sync('coupon');

-- Reviews: archived is archived_at is not null, and an archived review is never
-- public. 'rejected' is what the public read policy and the rating trigger
-- already exclude, so neither needs to change.
create or replace function public.reviews_archive_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null then
    perform public.archive_require_restore_right();
  end if;
  if new.archived_at is not null then
    new.status := 'rejected';
  end if;
  return new;
end;
$$;

create or replace function public.reviews_archive_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_name text;
begin
  select name_en into product_name from public.products where id = new.product_id;
  if new.archived_at is not null and old.archived_at is null then
    perform public.archive_register(
      'review', new.id,
      new.author_name || ' · ' || new.rating || '★',
      coalesce(product_name, ''),
      jsonb_build_object('status', old.status::text)
    );
  elsif old.archived_at is not null and new.archived_at is null then
    perform public.archive_unregister('review', new.id, new.author_name);
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_archive_guard on public.reviews;
create trigger reviews_archive_guard
  before update on public.reviews
  for each row execute function public.reviews_archive_guard();
drop trigger if exists reviews_archive_sync on public.reviews;
create trigger reviews_archive_sync
  after update of archived_at on public.reviews
  for each row execute function public.reviews_archive_sync();

revoke execute on function public.products_archive_guard() from public, anon, authenticated;
revoke execute on function public.products_archive_sync() from public, anon, authenticated;
revoke execute on function public.flag_archive_guard() from public, anon, authenticated;
revoke execute on function public.flag_archive_sync() from public, anon, authenticated;
revoke execute on function public.reviews_archive_guard() from public, anon, authenticated;
revoke execute on function public.reviews_archive_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill what is already archived
-- ---------------------------------------------------------------------------

update public.products set archived_at = coalesce(archived_at, updated_at)
where status = 'archived' and archived_at is null;

insert into public.archived_items (entity_type, entity_id, label, detail, previous_state, archived_at, archived_by_role)
select 'product', p.id, p.name_en, p.product_code, '{"status":"draft"}'::jsonb, p.archived_at, 'unknown'
from public.products p where p.status = 'archived'
on conflict (entity_type, entity_id) do nothing;

insert into public.archived_items (entity_type, entity_id, label, detail, previous_state, archived_at, archived_by_role)
select 'coupon', c.id, c.code, c.description_en, '{"is_active":false}'::jsonb, c.archived_at, 'unknown'
from public.coupons c where c.archived_at is not null
on conflict (entity_type, entity_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Archive, restore, purge
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
  case p_type
    when 'product' then
      perform public.require_permission('catalogue.manage');
      update public.products set status = 'archived'
        where id = p_id and status <> 'archived' returning id into found_id;
    when 'category' then
      perform public.require_permission('catalogue.manage');
      update public.categories set archived_at = now()
        where id = p_id and archived_at is null returning id into found_id;
    when 'collection' then
      perform public.require_permission('catalogue.manage');
      update public.collections set archived_at = now()
        where id = p_id and archived_at is null returning id into found_id;
    when 'coupon' then
      perform public.require_permission('coupons.manage');
      update public.coupons set archived_at = now()
        where id = p_id and archived_at is null returning id into found_id;
    when 'review' then
      perform public.require_permission('reviews.moderate');
      update public.reviews set archived_at = now()
        where id = p_id and archived_at is null returning id into found_id;
    else
      raise exception 'unknown_archive_type';
  end case;

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
  entry public.archived_items%rowtype;
  previous_status text;
  found_id uuid;
begin
  perform public.require_permission('archive.manage');

  select * into entry from public.archived_items
  where entity_type = p_type and entity_id = p_id;
  if not found then raise exception 'not_archived'; end if;

  case p_type
    when 'product' then
      -- Back to what it was; a product archived straight from "active" goes live
      -- again only if it still meets the storefront's requirements, otherwise it
      -- comes back as a draft for someone to finish.
      previous_status := coalesce(entry.previous_state ->> 'status', 'draft');
      if previous_status not in ('draft', 'active') then previous_status := 'draft'; end if;
      if previous_status = 'active' and exists (
        select 1 from public.products
        where id = p_id and (coalesce(trim(description_en), '') = '' or coalesce(trim(fabric_en), '') = '')
      ) then
        previous_status := 'draft';
      end if;
      update public.products set status = previous_status::public.product_status
        where id = p_id returning id into found_id;
    when 'category' then
      update public.categories
        set archived_at = null, is_active = coalesce((entry.previous_state ->> 'is_active')::boolean, true)
        where id = p_id returning id into found_id;
    when 'collection' then
      update public.collections
        set archived_at = null, is_active = coalesce((entry.previous_state ->> 'is_active')::boolean, true)
        where id = p_id returning id into found_id;
    when 'coupon' then
      update public.coupons
        set archived_at = null, is_active = coalesce((entry.previous_state ->> 'is_active')::boolean, false)
        where id = p_id returning id into found_id;
    when 'review' then
      previous_status := coalesce(entry.previous_state ->> 'status', 'pending');
      if previous_status not in ('pending', 'approved', 'rejected') then previous_status := 'pending'; end if;
      update public.reviews
        set archived_at = null, status = previous_status::public.review_status
        where id = p_id returning id into found_id;
    else
      raise exception 'unknown_archive_type';
  end case;

  if found_id is null then
    -- The row is gone (for example a review removed with its product): the
    -- registry entry is stale, so clear it rather than leave a ghost.
    delete from public.archived_items where entity_type = p_type and entity_id = p_id;
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
declare
  entry public.archived_items%rowtype;
  snapshot jsonb;
  storage_paths text[] := array[]::text[];
begin
  perform public.require_permission('archive.manage');

  select * into entry from public.archived_items
  where entity_type = p_type and entity_id = p_id
  for update;
  if not found then raise exception 'not_archived'; end if;

  case p_type
    when 'product' then
      if exists (select 1 from public.order_items where product_id = p_id) then
        raise exception 'retained_order_history';
      end if;
      select to_jsonb(p) into snapshot from public.products p where id = p_id and status = 'archived';
      if snapshot is null then raise exception 'not_archived'; end if;

      select coalesce(array_agg(storage_path) filter (where coalesce(storage_path, '') <> ''), array[]::text[])
        into storage_paths
        from public.product_images where product_id = p_id;

      -- Archived reviews of this product go with it; their Trash entries too.
      delete from public.archived_items
        where entity_type = 'review'
          and entity_id in (select id from public.reviews where product_id = p_id);

      -- Cascades: images, variants (and their cart lines and stock movements),
      -- reviews. None of it is referenced by an order, which
      -- was checked above.
      delete from public.products where id = p_id;

    when 'category' then
      if exists (select 1 from public.products where category_id = p_id) then
        raise exception 'retained_in_use';
      end if;
      select to_jsonb(c) into snapshot from public.categories c where id = p_id and archived_at is not null;
      if snapshot is null then raise exception 'not_archived'; end if;
      delete from public.categories where id = p_id;

    when 'collection' then
      if exists (select 1 from public.products where collection_id = p_id) then
        raise exception 'retained_in_use';
      end if;
      select to_jsonb(c) into snapshot from public.collections c where id = p_id and archived_at is not null;
      if snapshot is null then raise exception 'not_archived'; end if;
      delete from public.collections where id = p_id;

    when 'coupon' then
      if exists (select 1 from public.coupon_redemptions where coupon_id = p_id)
         or exists (select 1 from public.coupons where id = p_id and usage_count > 0) then
        raise exception 'retained_order_history';
      end if;
      select to_jsonb(c) into snapshot from public.coupons c where id = p_id and archived_at is not null;
      if snapshot is null then raise exception 'not_archived'; end if;
      delete from public.coupons where id = p_id;

    when 'review' then
      select to_jsonb(r) into snapshot from public.reviews r where id = p_id and archived_at is not null;
      if snapshot is null then
        delete from public.archived_items where entity_type = p_type and entity_id = p_id;
        raise exception 'item_not_found';
      end if;
      delete from public.reviews where id = p_id;

    else
      raise exception 'unknown_archive_type';
  end case;

  delete from public.archived_items where entity_type = p_type and entity_id = p_id;

  perform public.log_admin_action(
    p_type || '.purged', p_type, p_id::text, entry.label, snapshot, null, null
  );

  return jsonb_build_object('ok', true, 'storagePaths', to_jsonb(storage_paths));
end;
$$;

revoke execute on function public.admin_archive_item(text, uuid) from public, anon;
revoke execute on function public.admin_restore_archived_item(text, uuid) from public, anon;
revoke execute on function public.admin_purge_archived_item(text, uuid) from public, anon;
grant execute on function public.admin_archive_item(text, uuid) to authenticated;
grant execute on function public.admin_restore_archived_item(text, uuid) to authenticated;
grant execute on function public.admin_purge_archived_item(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. No direct deletes of catalogue rows through the API
-- ---------------------------------------------------------------------------

revoke delete on table public.products, public.categories, public.collections, public.product_variants
  from anon, authenticated;

commit;
