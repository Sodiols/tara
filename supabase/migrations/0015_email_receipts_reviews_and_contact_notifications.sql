begin;

-- TARA production email receipts, verified reviews, and contact notifications.
-- Additive only: existing orders, reviews, messages, and notification history
-- remain untouched.

alter table public.notification_outbox
  add column if not exists contact_message_id uuid references public.contact_messages(id) on delete cascade,
  add column if not exists provider_message_id text;

create index if not exists notification_outbox_contact_idx
  on public.notification_outbox(contact_message_id, status)
  where contact_message_id is not null;

create unique index if not exists notification_outbox_contact_once_idx
  on public.notification_outbox(contact_message_id, template)
  where contact_message_id is not null;

-- ---------------------------------------------------------------------------
-- Verified-purchase review workflow
-- ---------------------------------------------------------------------------

create or replace function public.review_eligibility(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate uuid;
  already_reviewed boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false, 'eligible', false, 'reason', 'sign_in');
  end if;

  select oi.id into candidate
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.user_id = auth.uid()
    and o.status = 'delivered'
    and oi.product_id = p_product_id
    and not exists (
      select 1 from public.reviews r where r.order_item_id = oi.id
    )
  order by o.delivered_at desc nulls last, o.created_at desc, oi.created_at desc
  limit 1;

  if candidate is not null then
    return jsonb_build_object('authenticated', true, 'eligible', true);
  end if;

  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.reviews r on r.order_item_id = oi.id
    where o.user_id = auth.uid()
      and o.status = 'delivered'
      and oi.product_id = p_product_id
  ) into already_reviewed;

  return jsonb_build_object(
    'authenticated', true,
    'eligible', false,
    'reason', case when already_reviewed then 'already_reviewed' else 'not_eligible' end
  );
end;
$$;

create or replace function public.submit_verified_review(
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate uuid;
  author text;
  new_review_id uuid;
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
  clean_comment text := trim(coalesce(p_comment, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_rating < 1 or p_rating > 5
     or length(clean_comment) < 10 or length(clean_comment) > 2000
     or length(coalesce(clean_title, '')) > 120 then
    raise exception 'invalid_review';
  end if;

  -- The database, not the browser, chooses the delivered and unreviewed order
  -- item. The row lock plus reviews.order_item_id uniqueness closes races.
  select oi.id into candidate
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.user_id = auth.uid()
    and o.status = 'delivered'
    and oi.product_id = p_product_id
    and not exists (
      select 1 from public.reviews r where r.order_item_id = oi.id
    )
  order by o.delivered_at desc nulls last, o.created_at desc, oi.created_at desc
  limit 1
  for update of oi;

  if candidate is null then
    if exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.reviews r on r.order_item_id = oi.id
      where o.user_id = auth.uid()
        and o.status = 'delivered'
        and oi.product_id = p_product_id
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_reviewed');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'TARA customer')
  into author
  from public.profiles p
  where p.id = auth.uid();

  insert into public.reviews (
    product_id, order_item_id, user_id, author_name, rating, title, comment_en, status
  ) values (
    p_product_id, candidate, auth.uid(), coalesce(author, 'TARA customer'),
    p_rating, clean_title, clean_comment, 'pending'
  )
  returning id into new_review_id;

  return jsonb_build_object('ok', true, 'reviewId', new_review_id, 'status', 'pending');
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_reviewed');
end;
$$;

-- Customers no longer insert reviews directly. The RPC above chooses and
-- verifies the order item itself. Existing select/update/delete RLS stays.
revoke insert on table public.reviews from anon, authenticated;
grant execute on function public.review_eligibility(uuid) to authenticated;
grant execute on function public.submit_verified_review(uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Contact messages: persist first, enqueue exactly once in the same function
-- ---------------------------------------------------------------------------

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_subject text default null,
  p_client_fingerprint text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  clean_email text := lower(trim(coalesce(p_email, '')));
  clean_message text := trim(coalesce(p_message, ''));
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_name, ''))) > 100
     or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(clean_email) > 200
     or (trim(coalesce(p_phone, '')) <> '' and public.normalize_bd_phone(p_phone) is null)
     or length(clean_message) < 10 or length(clean_message) > 3000 then
    raise exception 'invalid_contact_message';
  end if;

  if not public.consume_rate_limit('contact:email', clean_email, 3, 3600) then
    raise exception 'rate_limited';
  end if;
  if p_client_fingerprint is not null
     and not public.consume_rate_limit('contact:client', p_client_fingerprint, 5, 3600) then
    raise exception 'rate_limited';
  end if;

  if exists (
    select 1 from public.contact_messages
    where email = clean_email and message = clean_message
      and created_at > now() - interval '1 hour'
  ) then
    raise exception 'duplicate_message';
  end if;

  insert into public.contact_messages (name, email, phone, message, subject)
  values (
    trim(p_name), clean_email, public.normalize_bd_phone(p_phone), clean_message,
    nullif(trim(coalesce(p_subject, '')), '')
  )
  returning id into new_id;

  insert into public.notification_outbox (
    template, recipient, payload, contact_message_id
  ) values (
    'admin_contact_message', 'store', jsonb_build_object('messageId', new_id), new_id
  )
  on conflict (contact_message_id, template) where contact_message_id is not null do nothing;

  return new_id;
end;
$$;

-- The server action validates checkout email, but place_order() is also an
-- anon-callable RPC. Enforce the same rule at the final write boundary without
-- invalidating historic orders that legitimately have a null email.
create or replace function public.enforce_new_order_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_email is null
     or length(trim(new.customer_email)) > 200
     or lower(trim(new.customer_email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_customer_or_address';
  end if;
  new.customer_email := lower(trim(new.customer_email));
  return new;
end;
$$;

drop trigger if exists orders_require_customer_email on public.orders;
create trigger orders_require_customer_email
before insert on public.orders
for each row execute function public.enforce_new_order_email();

create or replace function public.claim_contact_notification(
  p_message_id uuid,
  p_customer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if not exists (
    select 1 from public.contact_messages m
    where m.id = p_message_id
      and m.email = lower(trim(coalesce(p_customer_email, '')))
  ) then
    return '[]'::jsonb;
  end if;

  with claimable as (
    select id from public.notification_outbox
    where contact_message_id = p_message_id
      and template = 'admin_contact_message'
      and (
        status = 'queued'
        or (status = 'sending' and claimed_at < now() - interval '5 minutes')
      )
      and attempts < 5
    for update skip locked
  ), taken as (
    update public.notification_outbox o
      set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
      from claimable
      where o.id = claimable.id
      returning o.id, o.template, o.recipient, o.payload, o.dispatch_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'template', template, 'recipient', recipient,
    'payload', payload, 'dispatchToken', dispatch_token
  )), '[]'::jsonb) into claimed
  from taken;

  return claimed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claimed-notification snapshots: the only email path to private order/message
-- data. A row id without its single-use dispatch token reveals nothing.
-- ---------------------------------------------------------------------------

create or replace function public.notification_order_snapshot(
  p_id uuid,
  p_dispatch_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'createdAt', o.created_at,
      'customerName', o.customer_name,
      'customerEmail', o.customer_email,
      'customerPhone', o.customer_phone,
      'shippingAddress', o.shipping_address,
      'status', o.status,
      'paymentMethod', o.payment_method,
      'subtotal', o.subtotal,
      'deliveryFee', o.delivery_fee,
      'discountAmount', o.discount_amount,
      'total', o.total,
      'currency', o.currency,
      'trackingToken', o.tracking_token
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'productName', oi.product_name_en,
        'productCode', oi.product_code,
        'sku', oi.sku,
        'size', oi.size,
        'colour', oi.colour_en,
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity,
        'lineTotal', oi.line_total
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where exists (
    select 1 from public.notification_outbox n
    where n.id = p_id
      and n.order_id = o.id
      and n.dispatch_token = trim(coalesce(p_dispatch_token, ''))
      and n.status = 'sending'
  );
$$;

create or replace function public.notification_contact_snapshot(
  p_id uuid,
  p_dispatch_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'email', m.email,
    'phone', m.phone,
    'subject', m.subject,
    'message', m.message,
    'createdAt', m.created_at
  )
  from public.contact_messages m
  where exists (
    select 1 from public.notification_outbox n
    where n.id = p_id
      and n.contact_message_id = m.id
      and n.dispatch_token = trim(coalesce(p_dispatch_token, ''))
      and n.status = 'sending'
  );
$$;

-- Customer-safe receipt data. A signed-in owner can use the account route; a
-- guest must prove possession of the high-entropy tracking token.
create or replace function public.get_customer_receipt(
  p_order_number text,
  p_tracking_token text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'orderNumber', o.order_number,
      'createdAt', o.created_at,
      'customerName', o.customer_name,
      'customerEmail', o.customer_email,
      'customerPhone', o.customer_phone,
      'shippingAddress', o.shipping_address,
      'status', o.status,
      'paymentMethod', o.payment_method,
      'subtotal', o.subtotal,
      'deliveryFee', o.delivery_fee,
      'discountAmount', o.discount_amount,
      'total', o.total,
      'currency', o.currency
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'productName', oi.product_name_en,
        'productCode', oi.product_code,
        'sku', oi.sku,
        'size', oi.size,
        'colour', oi.colour_en,
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity,
        'lineTotal', oi.line_total
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = trim(coalesce(p_order_number, ''))
    and (
      (auth.uid() is not null and o.user_id = auth.uid())
      or (
        length(trim(coalesce(p_tracking_token, ''))) >= 32
        and o.tracking_token = trim(p_tracking_token)
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Delivery result, staff retry, and test-email rate limit
-- ---------------------------------------------------------------------------

create or replace function public.confirm_notification_dispatch_v2(
  p_id uuid,
  p_dispatch_token text,
  p_status text,
  p_error text default null,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched integer;
begin
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'invalid_notification_status';
  end if;

  update public.notification_outbox
    set status = p_status,
        sent_at = case when p_status = 'sent' then now() else sent_at end,
        last_error = case when p_status = 'sent' then null else left(coalesce(p_error, ''), 300) end,
        provider_message_id = case when p_status = 'sent' then left(p_provider_message_id, 200) else provider_message_id end
    where id = p_id
      and dispatch_token = trim(coalesce(p_dispatch_token, ''))
      and status = 'sending';
  get diagnostics matched = row_count;
  return matched > 0;
end;
$$;

create or replace function public.requeue_notification(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('settings.manage');
  update public.notification_outbox
    set status = 'queued', last_error = null, claimed_at = null
    where id = p_id and status in ('failed', 'skipped', 'sending');
  return found;
end;
$$;

create or replace function public.claim_notification_admin(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  perform public.require_permission('settings.manage');
  with claimable as (
    select id from public.notification_outbox
    where id = p_id and status = 'queued'
    for update skip locked
  ), taken as (
    update public.notification_outbox o
      set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
      from claimable
      where o.id = claimable.id
      returning o.id, o.template, o.recipient, o.payload, o.dispatch_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'template', template, 'recipient', recipient,
    'payload', payload, 'dispatchToken', dispatch_token
  )), '[]'::jsonb) into claimed
  from taken;
  return claimed;
end;
$$;

create or replace function public.can_send_test_email()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('settings.manage');
  return public.consume_rate_limit('admin:test_email', auth.uid()::text, 3, 3600);
end;
$$;

revoke execute on function public.review_eligibility(uuid) from public;
revoke execute on function public.submit_verified_review(uuid, integer, text, text) from public;
revoke execute on function public.submit_contact_message(text, text, text, text, text, text) from public;
revoke execute on function public.claim_contact_notification(uuid, text) from public;
revoke execute on function public.notification_order_snapshot(uuid, text) from public;
revoke execute on function public.notification_contact_snapshot(uuid, text) from public;
revoke execute on function public.get_customer_receipt(text, text) from public;
revoke execute on function public.confirm_notification_dispatch_v2(uuid, text, text, text, text) from public;
revoke execute on function public.requeue_notification(uuid) from public;
revoke execute on function public.claim_notification_admin(uuid) from public;
revoke execute on function public.can_send_test_email() from public;
revoke execute on function public.enforce_new_order_email() from public, anon, authenticated;

grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.claim_contact_notification(uuid, text) to anon, authenticated;
grant execute on function public.notification_order_snapshot(uuid, text) to anon, authenticated;
grant execute on function public.notification_contact_snapshot(uuid, text) to anon, authenticated;
grant execute on function public.get_customer_receipt(text, text) to anon, authenticated;
grant execute on function public.confirm_notification_dispatch_v2(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.requeue_notification(uuid) to authenticated;
grant execute on function public.claim_notification_admin(uuid) to authenticated;
grant execute on function public.can_send_test_email() to authenticated;

commit;
