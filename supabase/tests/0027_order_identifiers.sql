/*
Database tests for migration 0027 -- order numbers and tracking tokens.

    psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0027_order_identifiers.sql

Run as the database owner (the `postgres` connection string of a TESTING
project, never production). Everything happens inside one transaction that is
rolled back at the end, including the temporary replacement of the order
number generator used to force a collision -- DDL in PostgreSQL is
transactional, so nothing here outlives the run. The catalogue must hold at
least one active variant with stock (supabase/seed/development_seed.sql).

Each block raises on failure, so ON_ERROR_STOP turns any failure into a
non-zero exit. A clean run prints the NOTICE lines and ends in ROLLBACK.

These are the properties the anon-key integration suite cannot reach: the
generators themselves, collision retry, the immutability trigger and the
INSERT shape check.
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Shapes, alphabet, uniqueness and spread of the generators
-- ---------------------------------------------------------------------------

do $$
declare
  total integer;
  distinct_total integer;
  symbols integer;
  low integer;
  high integer;
begin
  -- Every value in the right shape.
  if exists (
    select 1 from generate_series(1, 5000)
    where not public.is_current_order_number(public.generate_order_number(now()))
  ) then
    raise exception 'FAIL: generate_order_number produced a value in the wrong shape';
  end if;
  if exists (
    select 1 from generate_series(1, 5000)
    where not public.is_current_tracking_token(public.generate_tracking_token())
  ) then
    raise exception 'FAIL: generate_tracking_token produced a value in the wrong shape';
  end if;

  -- No repeats in a large sample (50 and 100 random bits respectively).
  select count(*), count(distinct v) into total, distinct_total
  from (select public.generate_order_number(now()) as v from generate_series(1, 20000)) s;
  if total <> distinct_total then
    raise exception 'FAIL: % duplicate order numbers in 20000', total - distinct_total;
  end if;
  select count(*), count(distinct v) into total, distinct_total
  from (select public.generate_tracking_token() as v from generate_series(1, 20000)) s;
  if total <> distinct_total then
    raise exception 'FAIL: % duplicate tracking tokens in 20000', total - distinct_total;
  end if;

  -- All 32 symbols occur, none outside the alphabet, and roughly evenly: over
  -- 64000 symbols each should appear about 2000 times (sd ~44). A generator
  -- with a modulo bias or a fixed UUID nibble would show up here.
  select count(*), min(n), max(n) into symbols, low, high
  from (
    select c, count(*) as n
    from (
      select regexp_split_to_table(substr(public.generate_tracking_token(), 5), '') as c
      from generate_series(1, 3200)
    ) chars
    group by c
  ) counts;
  if symbols <> 32 then
    raise exception 'FAIL: % distinct symbols, expected 32', symbols;
  end if;
  if low < 1700 or high > 2300 then
    raise exception 'FAIL: uneven symbol spread (min %, max %)', low, high;
  end if;
  if exists (
    select 1 from generate_series(1, 2000)
    where public.generate_tracking_token() ~ '[01IO]'
       or public.generate_order_number(now()) ~ '-[^-]*[01IO][^-]*$'
  ) then
    raise exception 'FAIL: an ambiguous symbol was generated';
  end if;

  raise notice 'ok: generator shapes, uniqueness and spread';
end;
$$;

-- YY-MM is the order's month in Asia/Dhaka, not UTC.
do $$
begin
  if public.generate_order_number('2024-01-31 20:00:00+00') not like 'TARA-24-02-%' then
    raise exception 'FAIL: 20:00 UTC on 31 Jan is 1 Feb in Dhaka';
  end if;
  if public.generate_order_number('2026-09-28 20:15:00+06') not like 'TARA-26-09-%' then
    raise exception 'FAIL: wrong year/month';
  end if;
  raise notice 'ok: year and month from the store time zone';
end;
$$;

-- Recognisers: current and legacy shapes, nothing else.
do $$
begin
  if not public.is_valid_order_number('TARA-26-09-8F42K7M9Q2')
    or not public.is_valid_order_number('TARA-20260928-001042')
    or public.is_valid_order_number('TARA-26-13-8F42K7M9Q2')
    or public.is_valid_order_number('18427')
    or not public.is_valid_tracking_token('TRK-X7M9Q2LA84KP7N6R5BCD')
    or not public.is_valid_tracking_token(repeat('0123456789abcdef', 3))
    or public.is_valid_tracking_token('TRK-X7M9Q2LA84KP7N6R5BC0')
    or public.is_valid_tracking_token(gen_random_uuid()::text)
    or public.is_valid_tracking_token(null) then
    raise exception 'FAIL: recogniser disagreement';
  end if;
  raise notice 'ok: recognisers';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Constraints
-- ---------------------------------------------------------------------------

do $$
declare
  names text[];
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.orders'::regclass
      and attname in ('order_number', 'tracking_token')
      and not attnotnull
  ) then
    raise exception 'FAIL: order_number or tracking_token is nullable';
  end if;

  select array_agg(c.relname::text) into names
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where i.indrelid = 'public.orders'::regclass
    and i.indisunique and i.indnkeyatts = 1 and i.indpred is null
    and a.attname in ('order_number', 'tracking_token');
  if coalesce(array_length(names, 1), 0) < 2 then
    raise exception 'FAIL: missing a unique index (found %)', names;
  end if;
  if exists (select 1 from unnest(names) n where not public.is_order_identifier_constraint(n)) then
    raise exception 'FAIL: is_order_identifier_constraint does not recognise %', names;
  end if;
  if public.is_order_identifier_constraint('orders_pkey')
    or exists (
      select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
      where i.indrelid = 'public.orders'::regclass and i.indisunique
        and a.attname = 'idempotency_key'
        and public.is_order_identifier_constraint(c.relname)
    ) then
    raise exception 'FAIL: a non-identifier constraint would be retried';
  end if;
  raise notice 'ok: NOT NULL and UNIQUE on both identifiers (%)', names;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. place_order: a real order, then a forced collision, then exhaustion
-- ---------------------------------------------------------------------------

create temp table test_variant as
  select v.id from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.is_active and p.status = 'active' and v.stock_quantity >= 3
  order by v.stock_quantity desc limit 1;

create or replace function pg_temp.test_order(p_phone text)
returns jsonb
language sql
as $$
  select public.place_order(
    jsonb_build_object('name', 'SQL Identifier Test', 'email', 'sql-identifier-test@example.com', 'phone', p_phone),
    jsonb_build_object('address', 'House 12, Road 3, Test Area', 'city', 'Sylhet', 'deliveryZone', 'inside_sylhet'),
    jsonb_build_array(jsonb_build_object('variantId', (select id from test_variant), 'quantity', 1)),
    'standard', 'cash_on_delivery', null, null, null, null
  );
$$;

create or replace function pg_temp.test_phone()
returns text
language sql
volatile
as $$ select '019' || lpad((floor(random() * 1e8))::bigint::text, 8, '0'); $$;

create temp table test_placed (order_number text, tracking_token text);

do $$
declare
  result jsonb;
begin
  if not exists (select 1 from test_variant) then
    raise exception 'SETUP: no active variant with stock >= 3; seed the catalogue first';
  end if;

  result := pg_temp.test_order(pg_temp.test_phone());
  if not public.is_current_order_number(result ->> 'orderNumber')
    or not public.is_current_tracking_token(result ->> 'trackingToken') then
    raise exception 'FAIL: place_order returned %', result;
  end if;
  if not exists (
    select 1 from public.orders
    where order_number = result ->> 'orderNumber'
      and tracking_token = result ->> 'trackingToken'
  ) then
    raise exception 'FAIL: the returned identifiers are not the stored ones';
  end if;
  insert into test_placed values (result ->> 'orderNumber', result ->> 'trackingToken');
  raise notice 'ok: place_order stores and returns %', result ->> 'orderNumber';
end;
$$;

-- Force a collision: the first number drawn is one that already exists.
create temp table test_forced (value text);
-- A sequence, not a table: sequences are not rolled back, so the count
-- survives the failed checkout in the exhaustion test below.
create temp sequence test_calls;

create or replace function public.generate_order_number(p_created_at timestamptz default now())
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  forced text;
begin
  perform nextval('pg_temp.test_calls');
  delete from pg_temp.test_forced
    where ctid = (select ctid from pg_temp.test_forced limit 1)
    returning value into forced;
  if forced is not null then return forced; end if;
  return 'TARA-' || to_char(coalesce(p_created_at, now()) at time zone 'Asia/Dhaka', 'YY-MM')
    || '-' || public.secure_random_code(10);
end;
$$;

do $$
declare
  existing text := (select order_number from test_placed);
  result jsonb;
  calls integer;
  mark bigint;
begin
  insert into test_forced values (existing);
  mark := nextval('pg_temp.test_calls');
  result := pg_temp.test_order(pg_temp.test_phone());
  calls := nextval('pg_temp.test_calls') - mark - 1;
  if result ->> 'orderNumber' = existing then
    raise exception 'FAIL: a colliding order number was stored';
  end if;
  if calls <> 2 then
    raise exception 'FAIL: expected exactly one retry, generator was called % times', calls;
  end if;
  if (select count(*) from public.orders where order_number = existing) <> 1 then
    raise exception 'FAIL: the collision changed the existing order';
  end if;
  raise notice 'ok: a collision on order_number is retried once with a fresh value';
end;
$$;

-- Five collisions in a row: the retry is bounded and the real error surfaces.
do $$
declare
  existing text := (select order_number from test_placed);
  calls integer;
  mark bigint;
  before_count bigint := (select count(*) from public.orders);
begin
  insert into test_forced select existing from generate_series(1, 10);
  mark := nextval('pg_temp.test_calls');
  begin
    perform pg_temp.test_order(pg_temp.test_phone());
    raise exception 'FAIL: place_order succeeded with every candidate colliding';
  exception when unique_violation then
    null;
  end;
  calls := nextval('pg_temp.test_calls') - mark - 1;
  if calls <> 5 then
    raise exception 'FAIL: expected 5 bounded attempts, got %', calls;
  end if;
  if (select count(*) from public.orders) <> before_count then
    raise exception 'FAIL: a failed checkout left an order behind';
  end if;
  raise notice 'ok: retry is bounded at 5 and then raises unique_violation atomically';
end;
$$;

delete from test_forced;

-- ---------------------------------------------------------------------------
-- 4. Immutability, and legitimate updates still work
-- ---------------------------------------------------------------------------

do $$
declare
  target text := (select order_number from test_placed);
begin
  begin
    update public.orders set order_number = public.generate_order_number(now()) where order_number = target;
    raise exception 'FAIL: order_number was changed';
  exception when restrict_violation then
    null;
  end;

  begin
    update public.orders set tracking_token = public.generate_tracking_token() where order_number = target;
    raise exception 'FAIL: tracking_token was changed';
  exception when restrict_violation then
    null;
  end;

  begin
    update public.orders set order_number = null where order_number = target;
    raise exception 'FAIL: order_number was cleared';
  exception when restrict_violation or not_null_violation then
    null;
  end;

  -- Ordinary updates are untouched by the guard.
  update public.orders
    set customer_note = 'identifier test note', updated_at = now()
    where order_number = target;
  if not found then
    raise exception 'FAIL: an ordinary update was blocked';
  end if;

  raise notice 'ok: identifiers are immutable; other columns still update';
end;
$$;

-- New rows must use the new shapes, whoever inserts them.
do $$
declare
  template public.orders%rowtype;
begin
  select * into template from public.orders where order_number = (select order_number from test_placed);
  template.id := gen_random_uuid();
  template.idempotency_key := null;

  template.order_number := 'TARA-20260928-999999';
  template.tracking_token := public.generate_tracking_token();
  begin
    insert into public.orders select template.*;
    raise exception 'FAIL: a legacy-shaped order number was inserted';
  exception when others then
    if sqlerrm <> 'invalid_order_number' then raise; end if;
  end;

  template.order_number := public.generate_order_number(now());
  template.tracking_token := repeat('ab', 24);
  begin
    insert into public.orders select template.*;
    raise exception 'FAIL: a legacy-shaped tracking token was inserted';
  exception when others then
    if sqlerrm <> 'invalid_tracking_token' then raise; end if;
  end;

  template.tracking_token := (select tracking_token from test_placed);
  begin
    insert into public.orders select template.*;
    raise exception 'FAIL: a duplicate tracking token was inserted';
  exception when unique_violation then
    null;
  end;

  raise notice 'ok: new rows need current shapes and unique values';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The public lookup
-- ---------------------------------------------------------------------------

do $$
declare
  placed record;
  snapshot jsonb;
  internal_id uuid;
begin
  select * into placed from test_placed;
  select id into internal_id from public.orders where order_number = placed.order_number;

  snapshot := public.get_order_tracking(placed.tracking_token);
  if snapshot ->> 'orderNumber' <> placed.order_number then
    raise exception 'FAIL: lookup by token did not find the order';
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(snapshot) k)
     <> array['currency', 'deliveryZone', 'events', 'items', 'orderNumber', 'paymentMethod', 'placedAt', 'status', 'total', 'updatedAt'] then
    raise exception 'FAIL: unexpected keys %', (select array_agg(k) from jsonb_object_keys(snapshot) k);
  end if;
  if snapshot::text ~* 'SQL Identifier Test|House 12|Test Area|identifier test note'
     or snapshot::text like '%' || internal_id::text || '%'
     or snapshot::text like '%' || placed.tracking_token || '%' then
    raise exception 'FAIL: the tracking snapshot leaks private data: %', snapshot;
  end if;

  if public.get_order_tracking(placed.order_number) is not null
    or public.get_order_tracking(internal_id::text) is not null
    or public.get_order_tracking(lower(placed.tracking_token)) is not null
    or public.get_order_tracking(left(placed.tracking_token, 23)) is not null
    or public.get_order_tracking(left(placed.tracking_token, 10) || '%') is not null
    or public.get_order_tracking(null) is not null
    or public.get_order_tracking('') is not null then
    raise exception 'FAIL: tracked an order without its exact token';
  end if;

  -- The older two-identifier lookup now returns the same allowlist.
  if public.get_guest_order_tracking(placed.order_number, placed.tracking_token) <> snapshot then
    raise exception 'FAIL: get_guest_order_tracking disagrees with get_order_tracking';
  end if;

  raise notice 'ok: public lookup is exact and allowlisted';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Idempotency: a replay returns the stored identifiers
-- ---------------------------------------------------------------------------

do $$
declare
  key text := gen_random_uuid()::text;
  phone text := pg_temp.test_phone();
  first jsonb;
  second jsonb;
  args jsonb;
begin
  first := public.place_order(
    jsonb_build_object('name', 'SQL Identifier Test', 'email', 'sql-identifier-test@example.com', 'phone', phone),
    jsonb_build_object('address', 'House 12, Road 3, Test Area', 'city', 'Sylhet', 'deliveryZone', 'inside_sylhet'),
    jsonb_build_array(jsonb_build_object('variantId', (select id from test_variant), 'quantity', 1)),
    'standard', 'cash_on_delivery', null, null, key, null
  );
  second := public.place_order(
    jsonb_build_object('name', 'SQL Identifier Test', 'email', 'sql-identifier-test@example.com', 'phone', phone),
    jsonb_build_object('address', 'House 12, Road 3, Test Area', 'city', 'Sylhet', 'deliveryZone', 'inside_sylhet'),
    jsonb_build_array(jsonb_build_object('variantId', (select id from test_variant), 'quantity', 1)),
    'standard', 'cash_on_delivery', null, null, key, null
  );
  if (second ->> 'replayed')::boolean is not true
    or second ->> 'orderNumber' <> first ->> 'orderNumber'
    or second ->> 'trackingToken' <> first ->> 'trackingToken' then
    raise exception 'FAIL: replay returned % after %', second, first;
  end if;
  if (select count(*) from public.orders where idempotency_key = key) <> 1 then
    raise exception 'FAIL: a replay created a second order';
  end if;
  raise notice 'ok: idempotent replay returns the same order number and token';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.generate_order_number(timestamptz)', 'execute')
    or has_function_privilege('anon', 'public.generate_tracking_token()', 'execute')
    or has_function_privilege('authenticated', 'public.secure_random_code(integer)', 'execute') then
    raise exception 'FAIL: a client role can call a generator';
  end if;
  if not has_function_privilege('anon', 'public.get_order_tracking(text)', 'execute') then
    raise exception 'FAIL: anon cannot use the public lookup';
  end if;
  if has_table_privilege('anon', 'public.orders', 'select')
    or has_table_privilege('anon', 'public.orders', 'insert')
    or has_table_privilege('authenticated', 'public.orders', 'insert')
    or has_table_privilege('authenticated', 'public.orders', 'update') then
    raise exception 'FAIL: a client role can read or write orders directly';
  end if;
  raise notice 'ok: grants';
end;
$$;

rollback;
