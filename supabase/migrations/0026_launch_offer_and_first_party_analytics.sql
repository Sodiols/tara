  begin;

  -- ---------------------------------------------------------------------------
  -- 1. Product trust: what a photograph shows, and an optional video
  -- ---------------------------------------------------------------------------

  alter table public.product_images
    add column if not exists media_role text;

  do $$ begin
    alter table public.product_images
      add constraint product_images_media_role_known
      check (
        media_role is null
        or media_role in ('front', 'back', 'side', 'fabric', 'detail', 'bottom', 'dupatta', 'model', 'other')
      );
  exception when duplicate_object then null;
  end $$;

  -- Partial: the overwhelming majority of rows are null, and the only question
  -- ever asked of this column is "which roles does this product already have?".
  create index if not exists product_images_media_role_idx
    on public.product_images (product_id, media_role)
    where media_role is not null;

  alter table public.products
    add column if not exists video_url text;

  do $$ begin
    alter table public.products
      add constraint products_video_url_shape
      check (video_url is null or video_url ~ '^https://[^[:space:]]{5,500}$');
  exception when duplicate_object then null;
  end $$;

  -- The delivery estimate and the exchange window, which were written into
  -- components in four places. Seeded with exactly the wording the site already
  -- showed -- nothing here is a new promise.
  insert into public.store_settings (key, value, is_public, label) values
    ('delivery_estimate_inside',  '"2-4 business days"'::jsonb, true, 'Delivery estimate inside the free-delivery division'),
    ('delivery_estimate_outside', '"4-7 business days"'::jsonb, true, 'Delivery estimate elsewhere in Bangladesh'),
    ('exchange_window_days',      '7'::jsonb,                   true, 'Exchange window, in days')
  on conflict (key) do update
    set is_public = excluded.is_public,
        label = excluded.label;

  -- ---------------------------------------------------------------------------
  -- 2. The launch offer
  -- ---------------------------------------------------------------------------

  create table if not exists public.launch_offer (
    -- One offer. The check is what makes a second row impossible, rather than a
    -- convention the next person has to know about.
    id smallint primary key default 1 check (id = 1),
    is_enabled boolean not null default false,
    title text not null default '',
    description text not null default '',
    offer_type text not null default 'free_delivery'
      check (offer_type in ('free_delivery', 'percentage', 'fixed_amount', 'first_order', 'gift')),
    applies_to text not null default 'selected_products'
      check (applies_to in ('site_wide', 'selected_products')),
    -- A percentage (1-90) or an amount in taka, depending on offer_type. Null for
    -- free delivery and for a gift, neither of which carries a number.
    discount_value numeric(12,2) check (discount_value is null or discount_value >= 0),
    minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
    gift_description text not null default '',
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint launch_offer_window check (starts_at is null or ends_at is null or ends_at > starts_at)
  );

  -- Disabled, with no dates and no discount. Nothing is offered to anybody until
  -- an administrator fills this in and switches it on.
  insert into public.launch_offer (id) values (1) on conflict (id) do nothing;

  drop trigger if exists set_launch_offer_updated_at on public.launch_offer;
  create trigger set_launch_offer_updated_at
    before update on public.launch_offer
    for each row execute function public.set_updated_at();

  create table if not exists public.launch_offer_products (
    product_id uuid primary key references public.products(id) on delete cascade,
    -- A hero product is one of the (roughly three) the campaign is built around.
    is_hero boolean not null default false,
    created_at timestamptz not null default now()
  );

  create index if not exists launch_offer_products_hero_idx
    on public.launch_offer_products (is_hero)
    where is_hero;

  alter table public.launch_offer enable row level security;
  alter table public.launch_offer_products enable row level security;

  drop policy if exists launch_offer_public_read on public.launch_offer;
  drop policy if exists launch_offer_staff_manage on public.launch_offer;
  drop policy if exists launch_offer_products_public_read on public.launch_offer_products;
  drop policy if exists launch_offer_products_staff_manage on public.launch_offer_products;

  -- A visitor may read the offer only while it is switched on and inside its
  -- dates. An offer being drafted, or one that has expired, is invisible to
  -- everyone but staff -- the same rule the storefront applies, enforced where a
  -- client cannot skip it.
  create policy launch_offer_public_read on public.launch_offer for select
    using (
      (is_enabled
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now()))
      or public.is_staff()
    );

  create policy launch_offer_staff_manage on public.launch_offer for all
    using (public.has_permission('catalogue.manage'))
    with check (public.has_permission('catalogue.manage'));

  -- Participation names products and nothing else; which products are in a
  -- campaign is not a secret, and the offer row above is what decides whether
  -- anything is being offered at all.
  create policy launch_offer_products_public_read on public.launch_offer_products for select
    using (true);

  create policy launch_offer_products_staff_manage on public.launch_offer_products for all
    using (public.has_permission('catalogue.manage'))
    with check (public.has_permission('catalogue.manage'));

  revoke all on table public.launch_offer from anon, authenticated;
  revoke all on table public.launch_offer_products from anon, authenticated;
  grant select on table public.launch_offer to anon, authenticated;
  grant select on table public.launch_offer_products to anon, authenticated;
  grant insert, update, delete on table public.launch_offer to authenticated;
  grant insert, update, delete on table public.launch_offer_products to authenticated;

  -- Orders record what the offer took off, and what it was called at the time.
  -- `discount_amount` continues to be the whole discount, so every existing
  -- total, invoice and report stays correct; these two only say how much of it
  -- was the campaign rather than a coupon.
  alter table public.orders
    add column if not exists launch_offer_discount numeric(12,2) not null default 0,
    add column if not exists launch_offer_label text;

  do $$ begin
    alter table public.orders
      add constraint orders_launch_offer_discount_positive
      check (launch_offer_discount >= 0);
  exception when duplicate_object then null;
  end $$;

  -- ---------------------------------------------------------------------------
  -- 2a. Reading the offer
  -- ---------------------------------------------------------------------------

  /*
  The offer as the storefront may see it.

  SECURITY DEFINER only so that the date window is evaluated in one place rather
  than being re-derived by every caller; it returns the same rows the RLS policy
  above would allow, and nothing that is not already public. Null means there is
  no live offer, which is the state the shop ships in.

  `productIds` is the participating set, so a product card can carry a badge
  without a second query per card. `heroSlugs` is what the homepage campaign
  section renders.
  */
  create or replace function public.active_launch_offer()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select case
      when o.id is null then null
      else jsonb_build_object(
        'title', o.title,
        'description', o.description,
        'offerType', o.offer_type,
        'appliesTo', o.applies_to,
        'discountValue', o.discount_value,
        'minimumOrderAmount', o.minimum_order_amount,
        'giftDescription', o.gift_description,
        'startsAt', o.starts_at,
        'endsAt', o.ends_at,
        'productIds', case
          when o.applies_to = 'site_wide' then '[]'::jsonb
          else coalesce((
            select jsonb_agg(lp.product_id)
            from public.launch_offer_products lp
            join public.products p on p.id = lp.product_id
            where p.status = 'active'
          ), '[]'::jsonb)
        end,
        'heroSlugs', coalesce((
          select jsonb_agg(p.slug order by p.created_at desc)
          from public.launch_offer_products lp
          join public.products p on p.id = lp.product_id
          where lp.is_hero and p.status = 'active'
        ), '[]'::jsonb)
      )
    end
    from (select * from public.launch_offer where id = 1) o
    where o.is_enabled
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at > now());
  $$;

  revoke execute on function public.active_launch_offer() from public;
  grant execute on function public.active_launch_offer() to anon, authenticated;

  /*
  What the offer is worth on a given basket.

  THE ONE IMPLEMENTATION OF THE ARITHMETIC. `launch_offer_quote()` below is the
  display wrapper and `place_order()` calls this directly, so the figure a
  customer is shown and the figure they are charged are produced by the same
  lines -- the mistake the delivery rule exists to prevent, made once already in
  this codebase and not made again here.

  `p_is_first_order` is passed in rather than looked up, because whether someone
  has ordered before is a fact about a phone number and this function must be
  safe to expose for display. The caller that knows the phone -- place_order() --
  is the only one that answers it truthfully.

  Returns null when no offer is live or the basket does not qualify.
  */
  create or replace function public.launch_offer_benefit(
    p_subtotal numeric,
    p_product_ids uuid[],
    p_is_first_order boolean
  )
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    offer public.launch_offer%rowtype;
    participating boolean;
    discount numeric(12,2) := 0;
    free_delivery boolean := false;
  begin
    select * into offer from public.launch_offer where id = 1;
    if not found or not offer.is_enabled then return null; end if;
    if offer.starts_at is not null and offer.starts_at > now() then return null; end if;
    if offer.ends_at is not null and offer.ends_at <= now() then return null; end if;

    if coalesce(p_subtotal, 0) < offer.minimum_order_amount then return null; end if;

    -- A selected-products offer needs at least one of its products in the basket.
    -- Which products they are is re-read here; the caller's list is only ever the
    -- basket.
    if offer.applies_to = 'site_wide' then
      participating := true;
    else
      participating := exists (
        select 1 from public.launch_offer_products lp
        where lp.product_id = any(coalesce(p_product_ids, '{}'::uuid[]))
      );
    end if;
    if not participating then return null; end if;

    if offer.offer_type = 'first_order' and not coalesce(p_is_first_order, false) then
      return null;
    end if;

    case offer.offer_type
      when 'free_delivery' then
        free_delivery := true;
      when 'percentage', 'first_order' then
        -- A first-order offer is a percentage off, gated on there being no
        -- earlier order. Capped at 90% in the admin schema and again here, so a
        -- mistyped 1000 cannot make an order free.
        discount := round(
          coalesce(p_subtotal, 0) * least(greatest(coalesce(offer.discount_value, 0), 0), 90) / 100,
          2
        );
      when 'fixed_amount' then
        discount := least(
          greatest(coalesce(offer.discount_value, 0), 0),
          coalesce(p_subtotal, 0)
        );
      when 'gift' then
        -- Carries no money. The gift is recorded on the order as a label so the
        -- packing slip shows it.
        discount := 0;
      else
        return null;
    end case;

    return jsonb_build_object(
      'label', left(coalesce(nullif(btrim(offer.title), ''), 'Launch offer'), 120),
      'offerType', offer.offer_type,
      'discount', discount,
      'freeDelivery', free_delivery,
      'giftDescription', offer.gift_description
    );
  end;
  $$;

  -- Deliberately NOT granted. The only caller is place_order(), which is
  -- SECURITY DEFINER and therefore runs as the owner. Exposing it would let a
  -- caller choose p_is_first_order.
  revoke execute on function public.launch_offer_benefit(numeric, uuid[], boolean) from public;

  /*
  The display wrapper: the same arithmetic with no personal input.

  A first-order offer is quoted as worth nothing here, because whether this
  customer has ordered before is not knowable without their phone number and
  guessing in the customer's favour would show a total that checkout then does
  not honour. The storefront shows the offer's own words for that case instead.
  */
  create or replace function public.launch_offer_quote(
    p_subtotal numeric,
    p_product_ids uuid[]
  )
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select public.launch_offer_benefit(p_subtotal, p_product_ids, false);
  $$;

  revoke execute on function public.launch_offer_quote(numeric, uuid[]) from public;
  grant execute on function public.launch_offer_quote(numeric, uuid[]) to anon, authenticated;

  -- ---------------------------------------------------------------------------
  -- 2b. Managing the offer
  -- ---------------------------------------------------------------------------

  create or replace function public.admin_save_launch_offer(p_offer jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    before_value jsonb;
    v_type text := coalesce(p_offer ->> 'offerType', 'free_delivery');
    v_applies text := coalesce(p_offer ->> 'appliesTo', 'selected_products');
    v_value numeric := nullif(p_offer ->> 'discountValue', '')::numeric;
  begin
    perform public.require_permission('catalogue.manage');

    if v_type not in ('free_delivery', 'percentage', 'fixed_amount', 'first_order', 'gift') then
      raise exception 'invalid_offer_type';
    end if;
    if v_applies not in ('site_wide', 'selected_products') then
      raise exception 'invalid_offer_scope';
    end if;
    -- A discount that decides money is bounded here as well as in the form: the
    -- form is a convenience, this is the rule.
    if v_type in ('percentage', 'first_order') then
      if v_value is null or v_value <= 0 or v_value > 90 then
        raise exception 'invalid_discount_value';
      end if;
    elsif v_type = 'fixed_amount' then
      if v_value is null or v_value <= 0 or v_value > 1000000 then
        raise exception 'invalid_discount_value';
      end if;
    else
      v_value := null;
    end if;

    select to_jsonb(o) into before_value from public.launch_offer o where o.id = 1;

    insert into public.launch_offer (id) values (1) on conflict (id) do nothing;

    update public.launch_offer set
      is_enabled = coalesce((p_offer ->> 'isEnabled')::boolean, false),
      title = left(btrim(coalesce(p_offer ->> 'title', '')), 120),
      description = left(btrim(coalesce(p_offer ->> 'description', '')), 400),
      offer_type = v_type,
      applies_to = v_applies,
      discount_value = v_value,
      minimum_order_amount = greatest(coalesce(nullif(p_offer ->> 'minimumOrderAmount', '')::numeric, 0), 0),
      gift_description = left(btrim(coalesce(p_offer ->> 'giftDescription', '')), 200),
      starts_at = nullif(p_offer ->> 'startsAt', '')::timestamptz,
      ends_at = nullif(p_offer ->> 'endsAt', '')::timestamptz
    where id = 1;

    perform public.log_admin_action(
      'launch_offer.updated', 'launch_offer', null, null, before_value, p_offer, null
    );

    return jsonb_build_object('ok', true);
  end;
  $$;

  revoke execute on function public.admin_save_launch_offer(jsonb) from public;
  grant execute on function public.admin_save_launch_offer(jsonb) to authenticated;

  /*
  Replaces the participating set in one statement.

  Sent as the whole list rather than one product at a time, because "these three
  are in the campaign" is a single decision and applying it row by row leaves a
  half-changed campaign live if the second call fails.
  */
  create or replace function public.admin_set_launch_offer_products(
    p_product_ids uuid[],
    p_hero_ids uuid[]
  )
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    members uuid[] := coalesce(p_product_ids, '{}'::uuid[]);
    heroes uuid[] := coalesce(p_hero_ids, '{}'::uuid[]);
  begin
    perform public.require_permission('catalogue.manage');

    if array_length(members, 1) > 500 then
      raise exception 'too_many_products';
    end if;

    -- A hero that is not a member would be shown on the homepage as part of a
    -- campaign it is not in.
    members := array(select distinct unnest(members || heroes));

    delete from public.launch_offer_products
    where product_id <> all(members);

    insert into public.launch_offer_products (product_id, is_hero)
    select p.id, p.id = any(heroes)
    from public.products p
    where p.id = any(members)
    on conflict (product_id) do update set is_hero = excluded.is_hero;

    perform public.log_admin_action(
      'launch_offer.products_set', 'launch_offer_products', null, null, null,
      jsonb_build_object('products', to_jsonb(members), 'heroes', to_jsonb(heroes)), null
    );

    return jsonb_build_object('ok', true, 'products', coalesce(array_length(members, 1), 0));
  end;
  $$;

  revoke execute on function public.admin_set_launch_offer_products(uuid[], uuid[]) from public;
  grant execute on function public.admin_set_launch_offer_products(uuid[], uuid[]) to authenticated;

  -- ---------------------------------------------------------------------------
  -- 3. First-party analytics
  -- ---------------------------------------------------------------------------

  /*
  WHAT IS AND IS NOT STORED

  Stored: an anonymous visitor id and a session id, both minted by the browser
  and meaningful only to this shop; the UTM parameters a link carried; the HOST
  of the referrer; the path landed on; and the events below with the product,
  variant, colour, size, quantity and value each one needs.

  Not stored: IP addresses, user agents, screen or device fingerprints, email
  addresses, phone numbers, names, addresses, anything to do with payment, and
  the full referrer URL -- which on a search engine carries what somebody typed.

  The signed-in customer's id is recorded when there is one, because the shop
  already knows it and it is what lets "this order came from that campaign" work
  across a device change. It is a foreign key to profiles, so deleting a customer
  deletes the link.
  */

  create table if not exists public.analytics_visitors (
    -- Minted by the browser (crypto.randomUUID) and kept in localStorage. Opaque:
    -- it identifies a browser to this shop and to nothing else.
    id uuid primary key,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    user_id uuid references public.profiles(id) on delete set null,
    -- FIRST TOUCH. Written when the visitor row is created and never updated, so
    -- the campaign that first found this person survives every later visit.
    first_source text not null default 'direct',
    first_utm_source text,
    first_utm_medium text,
    first_utm_campaign text,
    first_utm_content text,
    first_utm_term text,
    first_referrer_host text,
    first_landing_path text,
    session_count integer not null default 0
  );

  create table if not exists public.analytics_sessions (
    id uuid primary key,
    visitor_id uuid not null references public.analytics_visitors(id) on delete cascade,
    started_at timestamptz not null default now(),
    last_event_at timestamptz not null default now(),
    user_id uuid references public.profiles(id) on delete set null,
    -- THIS visit's touch, exactly as the link carried it.
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer_host text,
    landing_path text,
    -- The normalised channel: utm_source when there is one, otherwise derived
    -- from the referring host, otherwise 'direct'. Resolved once on insert
    -- because every report groups by it.
    source text not null default 'direct',
    event_count integer not null default 0
  );

  create table if not exists public.analytics_events (
    id bigint generated always as identity primary key,
    visitor_id uuid not null references public.analytics_visitors(id) on delete cascade,
    session_id uuid not null references public.analytics_sessions(id) on delete cascade,
    event_name text not null,
    created_at timestamptz not null default now(),
    path text,
    product_id uuid references public.products(id) on delete set null,
    product_variant_id uuid references public.product_variants(id) on delete set null,
    -- Purchases only. ON DELETE CASCADE: an order permanently deleted from
    -- /admin/archive takes its conversion with it, which is what keeps the
    -- dashboard consistent with the order list.
    order_id uuid references public.orders(id) on delete cascade,
    colour text,
    size text,
    quantity integer check (quantity is null or (quantity > 0 and quantity <= 100)),
    -- Cart or line value in taka. Never a purchase total: purchase revenue is
    -- read from the order itself, so a cancellation changes the report.
    value numeric(12,2) check (value is null or value >= 0),
    -- The few event-specific extras that do not deserve a column of their own --
    -- a search term, a checkout step, which gallery image was opened. Bounded by
    -- the ingest function.
    meta jsonb,
    constraint analytics_events_known_name check (event_name in (
      'session_started', 'page_view', 'product_view', 'product_image_interaction',
      'product_colour_selected', 'product_size_selected', 'add_to_cart',
      'remove_from_cart', 'cart_view', 'begin_checkout', 'checkout_step',
      'purchase', 'search', 'category_view'
    ))
  );

  -- One purchase row per order, ever. This is the idempotency guarantee: a
  -- refreshed confirmation page, a back-and-forward, a retried request and a
  -- second browser tab all insert the same row and the second one is discarded.
  create unique index if not exists analytics_events_purchase_once_idx
    on public.analytics_events (order_id)
    where event_name = 'purchase';

  create index if not exists analytics_events_created_idx
    on public.analytics_events (created_at desc);
  create index if not exists analytics_events_name_created_idx
    on public.analytics_events (event_name, created_at desc);
  create index if not exists analytics_events_session_idx
    on public.analytics_events (session_id, created_at);
  create index if not exists analytics_events_visitor_idx
    on public.analytics_events (visitor_id, created_at);
  create index if not exists analytics_events_product_idx
    on public.analytics_events (product_id, event_name, created_at)
    where product_id is not null;

  create index if not exists analytics_sessions_visitor_idx
    on public.analytics_sessions (visitor_id, started_at);
  create index if not exists analytics_sessions_started_idx
    on public.analytics_sessions (started_at desc);
  create index if not exists analytics_sessions_source_idx
    on public.analytics_sessions (source, started_at desc);
  create index if not exists analytics_sessions_campaign_idx
    on public.analytics_sessions (utm_campaign, started_at desc)
    where utm_campaign is not null;
  create index if not exists analytics_sessions_content_idx
    on public.analytics_sessions (utm_content, started_at desc)
    where utm_content is not null;

  create index if not exists analytics_visitors_first_seen_idx
    on public.analytics_visitors (first_seen_at desc);
  create index if not exists analytics_visitors_user_idx
    on public.analytics_visitors (user_id)
    where user_id is not null;

  -- ---------------------------------------------------------------------------
  -- 3a. Access control
  --
  -- Nobody reads these tables without analytics.view, and nobody writes them
  -- directly at all. anon and authenticated get no table grants whatsoever;
  -- the only way in is track_analytics_events(), which validates everything.
  -- ---------------------------------------------------------------------------

  alter table public.analytics_visitors enable row level security;
  alter table public.analytics_sessions enable row level security;
  alter table public.analytics_events enable row level security;

  drop policy if exists analytics_visitors_staff_read on public.analytics_visitors;
  drop policy if exists analytics_sessions_staff_read on public.analytics_sessions;
  drop policy if exists analytics_events_staff_read on public.analytics_events;

  create policy analytics_visitors_staff_read on public.analytics_visitors for select
    using (public.has_permission('analytics.view'));
  create policy analytics_sessions_staff_read on public.analytics_sessions for select
    using (public.has_permission('analytics.view'));
  create policy analytics_events_staff_read on public.analytics_events for select
    using (public.has_permission('analytics.view'));

  revoke all on table public.analytics_visitors from anon, authenticated;
  revoke all on table public.analytics_sessions from anon, authenticated;
  revoke all on table public.analytics_events from anon, authenticated;
  grant select on table public.analytics_visitors to authenticated;
  grant select on table public.analytics_sessions to authenticated;
  grant select on table public.analytics_events to authenticated;

  -- ---------------------------------------------------------------------------
  -- 3b. Normalising a traffic source
  -- ---------------------------------------------------------------------------

  /*
  utm_source when the link carried one, otherwise the referring host, otherwise
  'direct'.

  The host mapping covers the handful of places a Bangladeshi fashion shop's
  traffic actually comes from and then falls back to the bare host, so an
  unexpected referrer is reported as itself rather than silently becoming
  "other". Nothing here is security sensitive: a UTM parameter is whatever the
  person clicking typed, and it is used for grouping a report and for nothing
  else.
  */
  create or replace function public.resolve_traffic_source(
    p_utm_source text,
    p_referrer_host text
  )
  returns text
  language sql
  immutable
  set search_path = ''
  as $$
    select case
      when nullif(btrim(coalesce(p_utm_source, '')), '') is not null
        then left(lower(btrim(p_utm_source)), 40)
      when coalesce(p_referrer_host, '') = '' then 'direct'
      when p_referrer_host like '%instagram%' then 'instagram'
      when p_referrer_host like '%facebook%' or p_referrer_host like 'fb.%'
        or p_referrer_host like '%messenger%' then 'facebook'
      when p_referrer_host like '%tiktok%' then 'tiktok'
      when p_referrer_host like '%google%' then 'google'
      when p_referrer_host like '%youtube%' then 'youtube'
      when p_referrer_host like '%whatsapp%' then 'whatsapp'
      when p_referrer_host like '%bing%' or p_referrer_host like '%duckduckgo%'
        or p_referrer_host like '%yahoo%' then 'search'
      else left(lower(p_referrer_host), 40)
    end;
  $$;

  revoke execute on function public.resolve_traffic_source(text, text) from public;

  -- ---------------------------------------------------------------------------
  -- 3c. Ingest: the one way in
  -- ---------------------------------------------------------------------------

  /*
  Records a batch of events for one session.

  EVERYTHING IS RE-CHECKED HERE. The route handler in front validates with Zod so
  a mistake gets a useful response, but this is where it is actually enforced:
  unknown event names are dropped, text is truncated, quantities and values are
  bounded, and a product id that does not name a real product becomes null rather
  than a dangling reference.

  IT NEVER RAISES for bad data, because the caller is a page a customer is trying
  to use and analytics is not worth an error. It returns how many rows it kept.

  ABUSE
    * 1000 events per session and 200 sessions per visitor, after which further
      events for that session or visitor are discarded. A visitor id is minted by
      the browser, so it costs an attacker nothing to make a new one -- these
      caps bound the damage from a single id, and the durable rate limit on the
      route bounds the rate.
    * 25 events per call.
    * First touch on the visitor row is written once, at creation, and never
      updated -- so a later request cannot rewrite where a visitor came from.
  */
  create or replace function public.track_analytics_events(p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_visitor uuid := nullif(p_payload ->> 'visitorId', '')::uuid;
    v_session uuid := nullif(p_payload ->> 'sessionId', '')::uuid;
    attribution jsonb := coalesce(p_payload -> 'attribution', '{}'::jsonb);
    v_utm_source text := left(nullif(btrim(coalesce(attribution ->> 'utmSource', '')), ''), 100);
    v_utm_medium text := left(nullif(btrim(coalesce(attribution ->> 'utmMedium', '')), ''), 100);
    v_utm_campaign text := left(nullif(btrim(coalesce(attribution ->> 'utmCampaign', '')), ''), 120);
    v_utm_content text := left(nullif(btrim(coalesce(attribution ->> 'utmContent', '')), ''), 120);
    v_utm_term text := left(nullif(btrim(coalesce(attribution ->> 'utmTerm', '')), ''), 120);
    v_referrer_host text := left(lower(nullif(btrim(coalesce(attribution ->> 'referrerHost', '')), '')), 120);
    v_landing_path text := left(nullif(btrim(coalesce(attribution ->> 'landingPath', '')), ''), 300);
    v_source text;
    v_user uuid := auth.uid();
    session_events integer;
    visitor_sessions integer;
    item jsonb;
    kept integer := 0;
    v_name text;
    v_product uuid;
    v_variant uuid;
    v_quantity integer;
    v_value numeric(12,2);
  begin
    if v_visitor is null or v_session is null then
      return jsonb_build_object('ok', false, 'stored', 0);
    end if;
    if jsonb_typeof(p_payload -> 'events') <> 'array' then
      return jsonb_build_object('ok', false, 'stored', 0);
    end if;

    v_source := public.resolve_traffic_source(v_utm_source, v_referrer_host);

    -- Aliased so the DO UPDATE below can name the existing row unambiguously.
    insert into public.analytics_visitors as visitor (
      id, user_id, first_source, first_utm_source, first_utm_medium,
      first_utm_campaign, first_utm_content, first_utm_term,
      first_referrer_host, first_landing_path, session_count
    ) values (
      v_visitor, v_user, v_source, v_utm_source, v_utm_medium,
      v_utm_campaign, v_utm_content, v_utm_term,
      v_referrer_host, v_landing_path, 0
    )
    on conflict (id) do update
      -- Only the two mutable facts. Every first_* column is deliberately absent
      -- from this list: first touch is written once and is never overwritten.
      set last_seen_at = now(),
          user_id = coalesce(visitor.user_id, excluded.user_id);

    select session_count into visitor_sessions
    from public.analytics_visitors where id = v_visitor;

    if visitor_sessions > 200 then
      return jsonb_build_object('ok', false, 'stored', 0);
    end if;

    insert into public.analytics_sessions as visit (
      id, visitor_id, user_id, utm_source, utm_medium, utm_campaign, utm_content,
      utm_term, referrer_host, landing_path, source
    ) values (
      v_session, v_visitor, v_user, v_utm_source, v_utm_medium, v_utm_campaign,
      v_utm_content, v_utm_term, v_referrer_host, v_landing_path, v_source
    )
    on conflict (id) do update
      set last_event_at = now(),
          user_id = coalesce(visit.user_id, excluded.user_id);

    -- A session belongs to the visitor that created it. A second visitor naming
    -- somebody else's session id is refused rather than allowed to write into it.
    if not exists (
      select 1 from public.analytics_sessions
      where id = v_session and visitor_id = v_visitor
    ) then
      return jsonb_build_object('ok', false, 'stored', 0);
    end if;

    select event_count into session_events
    from public.analytics_sessions where id = v_session;
    if session_events > 1000 then
      return jsonb_build_object('ok', false, 'stored', 0);
    end if;

    for item in
      select entry from jsonb_array_elements(p_payload -> 'events')
        with ordinality as t(entry, idx)
      where idx <= 25
    loop
      v_name := btrim(coalesce(item ->> 'name', ''));
      -- The same list as the check constraint. Named here as well so a bad name
      -- is skipped rather than failing the whole batch.
      if v_name not in (
        'session_started', 'page_view', 'product_view', 'product_image_interaction',
        'product_colour_selected', 'product_size_selected', 'add_to_cart',
        'remove_from_cart', 'cart_view', 'begin_checkout', 'checkout_step',
        'search', 'category_view'
      ) then
        continue;
      end if;

      -- A product id is accepted only when it names a real product. Anything else
      -- is recorded as an event with no product rather than rejected, so one bad
      -- id cannot lose the rest of the batch.
      v_product := null;
      begin
        v_product := nullif(item ->> 'productId', '')::uuid;
      exception when others then
        v_product := null;
      end;
      if v_product is not null
        and not exists (select 1 from public.products where id = v_product) then
        v_product := null;
      end if;

      v_variant := null;
      begin
        v_variant := nullif(item ->> 'variantId', '')::uuid;
      exception when others then
        v_variant := null;
      end;
      if v_variant is not null
        and not exists (select 1 from public.product_variants where id = v_variant) then
        v_variant := null;
      end if;

      -- Cast defensively and clamp. GREATEST/LEAST ignore nulls in Postgres, so
      -- wrapping them round a null would turn "this event has no quantity" into
      -- a quantity of 1 -- which would then be counted.
      v_quantity := null;
      begin
        v_quantity := nullif(item ->> 'quantity', '')::integer;
      exception when others then
        v_quantity := null;
      end;
      if v_quantity is not null then
        v_quantity := least(greatest(v_quantity, 1), 100);
      end if;

      v_value := null;
      begin
        v_value := round(nullif(item ->> 'value', '')::numeric, 2);
      exception when others then
        v_value := null;
      end;
      if v_value is not null then
        v_value := least(greatest(v_value, 0), 99999999);
      end if;

      insert into public.analytics_events (
        visitor_id, session_id, event_name, path, product_id, product_variant_id,
        colour, size, quantity, value, meta
      ) values (
        v_visitor,
        v_session,
        v_name,
        left(nullif(btrim(coalesce(item ->> 'path', '')), ''), 300),
        v_product,
        v_variant,
        left(nullif(btrim(coalesce(item ->> 'colour', '')), ''), 60),
        left(nullif(btrim(coalesce(item ->> 'size', '')), ''), 60),
        v_quantity,
        v_value,
        case
          when jsonb_typeof(item -> 'meta') = 'object'
          and length(item ->> 'meta') <= 1000
          then item -> 'meta'
          else null
        end
      );
      kept := kept + 1;

      if v_name = 'session_started' then
        update public.analytics_visitors
          set session_count = session_count + 1
          where id = v_visitor;
      end if;
    end loop;

    if kept > 0 then
      update public.analytics_sessions
        set event_count = event_count + kept,
            last_event_at = now()
        where id = v_session;
    end if;

    return jsonb_build_object('ok', true, 'stored', kept);
  end;
  $$;

  revoke execute on function public.track_analytics_events(jsonb) from public;
  grant execute on function public.track_analytics_events(jsonb) to anon, authenticated;

  /*
  Records the conversion for one order, exactly once.

  The browser does not get to say that an order exists, what it was worth, or
  whose it was: it presents the order number and that order's tracking token --
  the same pair the guest tracking page requires -- and the order is looked up.
  A wrong pair records nothing and says so in no more detail than "no".

  The row carries the order id and no money. Revenue is read from the order every
  time a report runs, so cancelling, returning or deleting an order removes its
  revenue from the dashboard with no second place to remember to update.

  Idempotent by the unique index above: refreshing the confirmation page, going
  back and forward, reopening it a week later or retrying a dropped request all
  return true and insert nothing new.
  */
  create or replace function public.track_analytics_purchase(
    p_visitor uuid,
    p_session uuid,
    p_order_number text,
    p_tracking_token text
  )
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_order record;
  begin
    if p_visitor is null or p_session is null then return false; end if;

    select o.id, o.total into v_order
    from public.orders o
    where o.order_number = btrim(p_order_number)
      and o.tracking_token = btrim(p_tracking_token);
    if not found then return false; end if;

    if not exists (
      select 1 from public.analytics_sessions
      where id = p_session and visitor_id = p_visitor
    ) then
      return false;
    end if;

    insert into public.analytics_events (
      visitor_id, session_id, event_name, order_id
    ) values (
      p_visitor, p_session, 'purchase', v_order.id
    )
    on conflict do nothing;

    update public.analytics_sessions
      set last_event_at = now(), event_count = event_count + 1
      where id = p_session;

    return true;
  end;
  $$;

  revoke execute on function public.track_analytics_purchase(uuid, uuid, text, text) from public;
  grant execute on function public.track_analytics_purchase(uuid, uuid, text, text) to anon, authenticated;

  -- ---------------------------------------------------------------------------
  -- 4. The marketing dashboard
  -- ---------------------------------------------------------------------------

  /*
  Everything /admin/marketing shows, in one authorised read.

  THE ATTRIBUTION MODEL, IN CODE
  ------------------------------
  `attributed` below is the whole model and the only place it is expressed. A
  session keeps its own campaign; a session that arrived with none inherits the
  most recent EARLIER non-direct session of the same visitor; a visitor who has
  never arrived from a campaign is direct. Every table on the dashboard reads
  from that one CTE, so the source column means the same thing on every row of
  every panel.

  The first-touch columns on `analytics_visitors` are untouched by this function.
  They are kept so a first-touch report can be built later from the same rows
  without re-instrumenting anything.

  WHAT COUNTS AS AN ORDER
  -----------------------
  A purchase event joined to an order that is still real: not cancelled, not
  returned, not archived. Revenue is the order's own `total`, read now rather
  than copied at conversion time, so an order cancelled tomorrow leaves the
  dashboard tomorrow. Deleting an order removes its purchase event outright
  (ON DELETE CASCADE).

  DEFINITIONS, USED CONSISTENTLY
  ------------------------------
    Visitors            distinct visitor ids with at least one event in the window
    Product views       product_view events (the funnel uses distinct visitors)
    Add to Cart Rate    visitors who added to cart / visitors
    Checkout Rate       visitors who began checkout / visitors who added to cart
    Purchase Conversion orders / visitors
    Average order value revenue / orders

  A visitor who arrives twice from two different campaigns is counted once under
  each, because both campaigns genuinely brought them; the summary counts them
  once overall.
  */
  create or replace function public.admin_marketing_analytics(p_filters jsonb default '{}'::jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    f_to timestamptz := coalesce(nullif(p_filters ->> 'to', '')::timestamptz, now());
    f_from timestamptz := coalesce(
      nullif(p_filters ->> 'from', '')::timestamptz,
      now() - interval '30 days'
    );
    f_source text := nullif(btrim(coalesce(p_filters ->> 'source', '')), '');
    f_campaign text := nullif(btrim(coalesce(p_filters ->> 'campaign', '')), '');
    f_content text := nullif(btrim(coalesce(p_filters ->> 'content', '')), '');
    f_creator text := nullif(btrim(coalesce(p_filters ->> 'creator', '')), '');
    f_product uuid;
    result jsonb;
  begin
    perform public.require_permission('analytics.view');

    begin
      f_product := nullif(p_filters ->> 'productId', '')::uuid;
    exception when others then
      f_product := null;
    end;

    if f_from >= f_to then f_from := f_to - interval '1 day'; end if;
    -- Two years is well past any campaign question and keeps one mistyped date
    -- from scanning the whole table.
    if f_to - f_from > interval '730 days' then f_from := f_to - interval '730 days'; end if;

    with attributed as (
      select
        s.id as session_id,
        s.visitor_id,
        s.started_at,
        -- LAST NON-DIRECT, CARRIED FORWARD. This is the model.
        coalesce(nullif(s.source, 'direct'), prior.source, 'direct') as source,
        case when s.source <> 'direct' then s.utm_campaign else prior.utm_campaign end as campaign,
        case when s.source <> 'direct' then s.utm_content else prior.utm_content end as content,
        case when s.source <> 'direct' then s.utm_medium else prior.utm_medium end as medium
      from public.analytics_sessions s
      left join lateral (
        select ps.source, ps.utm_campaign, ps.utm_content, ps.utm_medium
        from public.analytics_sessions ps
        where ps.visitor_id = s.visitor_id
          and ps.started_at < s.started_at
          and ps.source <> 'direct'
        order by ps.started_at desc
        limit 1
      ) prior on true
      where s.last_event_at >= f_from
        and s.started_at <= f_to
    ),
    ev as (
      select
        e.visitor_id,
        e.session_id,
        e.event_name,
        e.product_id,
        e.order_id,
        a.source,
        a.campaign,
        a.content,
        -- A creator link is either utm_source=creator (the creator's name is the
        -- campaign) or a utm_content that names one: creator_<name>_<post>.
        case
          when a.source = 'creator' then nullif(btrim(coalesce(a.campaign, '')), '')
          when a.content ~ '^creator[_-]' then nullif(split_part(a.content, '_', 2), '')
          else null
        end as creator,
        -- Revenue is the live order total, and only while the order is real.
        case
          when e.event_name = 'purchase'
          and o.id is not null
          and o.status not in ('cancelled', 'returned')
          and o.archived_at is null
          then o.total
        end as order_revenue
      from public.analytics_events e
      join attributed a on a.session_id = e.session_id
      left join public.orders o on o.id = e.order_id
      where e.created_at >= f_from
        and e.created_at < f_to
        and (f_source is null or a.source = f_source)
        and (f_campaign is null or a.campaign = f_campaign)
        and (f_content is null or a.content = f_content)
        -- Filtering by product narrows to what happened TO that product, and to
        -- the orders that contain it.
        and (
          f_product is null
          or e.product_id = f_product
          or (
            e.event_name = 'purchase'
            and exists (
              select 1 from public.order_items oi
              where oi.order_id = e.order_id and oi.product_id = f_product
            )
          )
        )
    ),
    filtered as (
      select * from ev
      where f_creator is null or creator = f_creator
    ),
    summary as (
      select
        count(distinct visitor_id) as visitors,
        count(distinct session_id) as sessions,
        count(*) filter (where event_name = 'product_view') as product_views,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(*) filter (where event_name = 'begin_checkout') as checkout_starts,
        count(distinct visitor_id) filter (where event_name = 'product_view') as product_view_visitors,
        count(distinct visitor_id) filter (where event_name = 'add_to_cart') as add_to_cart_visitors,
        count(distinct visitor_id) filter (where event_name = 'begin_checkout') as checkout_visitors,
        count(*) filter (where order_revenue is not null) as orders,
        coalesce(sum(order_revenue), 0)::numeric(14,2) as revenue
      from filtered
    ),
    by_source as (
      select
        source,
        count(distinct visitor_id) as visitors,
        count(*) filter (where event_name = 'product_view') as product_views,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(*) filter (where event_name = 'begin_checkout') as checkout_starts,
        count(*) filter (where order_revenue is not null) as orders,
        coalesce(sum(order_revenue), 0)::numeric(14,2) as revenue
      from filtered
      group by source
    ),
    by_campaign as (
      select
        coalesce(campaign, '(none)') as campaign,
        source,
        count(distinct visitor_id) as visitors,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(*) filter (where event_name = 'begin_checkout') as checkout_starts,
        count(*) filter (where order_revenue is not null) as orders,
        coalesce(sum(order_revenue), 0)::numeric(14,2) as revenue
      from filtered
      group by 1, 2
    ),
    by_content as (
      select
        content,
        source,
        coalesce(campaign, '(none)') as campaign,
        count(distinct visitor_id) as visitors,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(*) filter (where order_revenue is not null) as orders,
        coalesce(sum(order_revenue), 0)::numeric(14,2) as revenue
      from filtered
      where content is not null
      group by 1, 2, 3
    ),
    by_creator as (
      select
        creator,
        count(distinct visitor_id) as visitors,
        count(*) filter (where event_name = 'product_view') as product_views,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(*) filter (where order_revenue is not null) as orders,
        coalesce(sum(order_revenue), 0)::numeric(14,2) as revenue
      from filtered
      where creator is not null
      group by 1
    ),
    product_events as (
      select
        product_id,
        count(distinct visitor_id) filter (where event_name = 'product_view') as view_visitors,
        count(*) filter (where event_name = 'product_view') as product_views,
        count(*) filter (where event_name = 'add_to_cart') as add_to_carts,
        count(distinct visitor_id) filter (where event_name = 'add_to_cart') as add_to_cart_visitors
      from filtered
      where product_id is not null
      group by 1
    ),
    -- Per-product revenue comes from the order's own lines, not from the event,
    -- so a two-product order is split correctly between them.
    product_orders as (
      select
        oi.product_id,
        count(distinct oi.order_id) as orders,
        coalesce(sum(oi.line_total), 0)::numeric(14,2) as revenue
      from filtered f
      join public.order_items oi on oi.order_id = f.order_id
      where f.order_revenue is not null
      group by 1
    ),
    by_product as (
      select
        coalesce(pe.product_id, po.product_id) as product_id,
        coalesce(pe.product_views, 0) as product_views,
        coalesce(pe.view_visitors, 0) as view_visitors,
        coalesce(pe.add_to_carts, 0) as add_to_carts,
        coalesce(pe.add_to_cart_visitors, 0) as add_to_cart_visitors,
        coalesce(po.orders, 0) as orders,
        coalesce(po.revenue, 0)::numeric(14,2) as revenue
      from product_events pe
      full outer join product_orders po on po.product_id = pe.product_id
    )
    select jsonb_build_object(
      'from', f_from,
      'to', f_to,
      'attributionModel', 'last_non_direct_session',
      'summary', (
        select jsonb_build_object(
          'visitors', s.visitors,
          'sessions', s.sessions,
          'productViews', s.product_views,
          'addToCarts', s.add_to_carts,
          'checkoutStarts', s.checkout_starts,
          'orders', s.orders,
          'revenue', s.revenue,
          'addToCartRate', case when s.visitors > 0
            then round(s.add_to_cart_visitors::numeric * 100 / s.visitors, 2) else 0 end,
          'checkoutRate', case when s.add_to_cart_visitors > 0
            then round(s.checkout_visitors::numeric * 100 / s.add_to_cart_visitors, 2) else 0 end,
          'purchaseRate', case when s.visitors > 0
            then round(s.orders::numeric * 100 / s.visitors, 2) else 0 end,
          'averageOrderValue', case when s.orders > 0
            then round(s.revenue / s.orders, 2) else 0 end
        ) from summary s
      ),
      -- The funnel is deliberately in VISITORS at every stage, so each step is a
      -- share of the one above it rather than a count of repeated actions.
      'funnel', (
        select jsonb_build_object(
          'visitors', s.visitors,
          'productViews', s.product_view_visitors,
          'addToCarts', s.add_to_cart_visitors,
          'checkoutStarts', s.checkout_visitors,
          'orders', s.orders
        ) from summary s
      ),
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source', b.source,
          'visitors', b.visitors,
          'productViews', b.product_views,
          'addToCarts', b.add_to_carts,
          'checkoutStarts', b.checkout_starts,
          'orders', b.orders,
          'revenue', b.revenue,
          'conversionRate', case when b.visitors > 0
            then round(b.orders::numeric * 100 / b.visitors, 2) else 0 end
        ) order by b.revenue desc, b.visitors desc, b.source)
        from (select * from by_source order by revenue desc, visitors desc limit 25) b
      ), '[]'::jsonb),
      'campaigns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'campaign', b.campaign,
          'source', b.source,
          'visitors', b.visitors,
          'addToCarts', b.add_to_carts,
          'checkoutStarts', b.checkout_starts,
          'orders', b.orders,
          'revenue', b.revenue,
          'conversionRate', case when b.visitors > 0
            then round(b.orders::numeric * 100 / b.visitors, 2) else 0 end
        ) order by b.revenue desc, b.visitors desc, b.campaign)
        from (select * from by_campaign order by revenue desc, visitors desc limit 25) b
      ), '[]'::jsonb),
      'content', coalesce((
        select jsonb_agg(jsonb_build_object(
          'content', b.content,
          'source', b.source,
          'campaign', b.campaign,
          'visitors', b.visitors,
          'addToCarts', b.add_to_carts,
          'orders', b.orders,
          'revenue', b.revenue,
          'conversionRate', case when b.visitors > 0
            then round(b.orders::numeric * 100 / b.visitors, 2) else 0 end
        ) order by b.revenue desc, b.visitors desc, b.content)
        from (select * from by_content order by revenue desc, visitors desc limit 25) b
      ), '[]'::jsonb),
      'creators', coalesce((
        select jsonb_agg(jsonb_build_object(
          'creator', b.creator,
          'visitors', b.visitors,
          'productViews', b.product_views,
          'addToCarts', b.add_to_carts,
          'orders', b.orders,
          'revenue', b.revenue,
          'conversionRate', case when b.visitors > 0
            then round(b.orders::numeric * 100 / b.visitors, 2) else 0 end
        ) order by b.revenue desc, b.visitors desc, b.creator)
        from (select * from by_creator order by revenue desc, visitors desc limit 25) b
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productId', b.product_id,
          'name', p.name_en,
          'slug', p.slug,
          'productViews', b.product_views,
          'addToCarts', b.add_to_carts,
          'addToCartRate', case when b.view_visitors > 0
            then round(b.add_to_cart_visitors::numeric * 100 / b.view_visitors, 2) else 0 end,
          'orders', b.orders,
          'revenue', b.revenue,
          'conversionRate', case when b.view_visitors > 0
            then round(b.orders::numeric * 100 / b.view_visitors, 2) else 0 end
        ) order by b.revenue desc, b.product_views desc, p.name_en)
        from (select * from by_product order by revenue desc, product_views desc limit 25) b
        join public.products p on p.id = b.product_id
      ), '[]'::jsonb),
      -- The values the filters offer, so the form can only ask for something
      -- that exists.
      'available', jsonb_build_object(
        'sources', coalesce((
          select jsonb_agg(distinct a.source) from attributed a where a.source is not null
        ), '[]'::jsonb),
        'campaigns', coalesce((
          select jsonb_agg(distinct a.campaign) from attributed a where a.campaign is not null
        ), '[]'::jsonb),
        'content', coalesce((
          select jsonb_agg(distinct a.content) from attributed a where a.content is not null
        ), '[]'::jsonb)
      )
    ) into result;

    return result;
  end;
  $$;

  revoke execute on function public.admin_marketing_analytics(jsonb) from public;
  grant execute on function public.admin_marketing_analytics(jsonb) to authenticated;

  -- ---------------------------------------------------------------------------
  -- 5. The durable rate limit gains an `analytics` bucket
  --
  -- Restated in full because CREATE OR REPLACE replaces the whole body. Every
  -- bucket keeps exactly the allowance and window 0021 gave it; one arm is added.
  -- 120 per 60 seconds per client is generous for a batching tracker that flushes
  -- a few times a page, and it is the durable half of the limit -- the route's
  -- in-process window rejects the obvious floods before a round trip.
  -- ---------------------------------------------------------------------------

  create or replace function public.consume_public_rate_limit(
    p_bucket text,
    p_identifier text
  )
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    allowance integer;
    window_seconds integer;
  begin
    case p_bucket
      when 'coupon'        then allowance := 15; window_seconds := 600;
      when 'tracking'      then allowance := 20; window_seconds := 600;
      when 'catalogue-api' then allowance := 90; window_seconds := 60;
      when 'newsletter'    then allowance := 5;  window_seconds := 600;
      when 'contact'       then allowance := 4;  window_seconds := 900;
      when 'checkout'      then allowance := 8;  window_seconds := 600;
      when 'unsubscribe'   then allowance := 10; window_seconds := 3600;
      when 'auth'          then allowance := 12; window_seconds := 600;
      when 'receipt'       then allowance := 20; window_seconds := 600;
      -- New in 0026. Matches guardPublicAction("analytics", 120, 60) in
      -- app/api/analytics/collect/route.ts.
      when 'analytics'     then allowance := 120; window_seconds := 60;
      else raise exception 'unknown_rate_limit_bucket';
    end case;

    return public.consume_rate_limit(p_bucket, p_identifier, allowance, window_seconds);
  end;
  $$;

  revoke execute on function public.consume_public_rate_limit(text, text) from public;
  grant execute on function public.consume_public_rate_limit(text, text) to anon, authenticated;

  -- ---------------------------------------------------------------------------
  -- 6. search_catalogue(): the product video, and what each photograph shows
  --
  -- Reproduced from 0025 with two additions -- `videoUrl` on the product and
  -- `role` on each media entry. Everything else is byte-identical, and every
  -- existing consumer ignores both new fields.
  -- ---------------------------------------------------------------------------

  create or replace function public.search_catalogue(p_filters jsonb default '{}'::jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    f_slug text := nullif(trim(coalesce(p_filters ->> 'slug', '')), '');
    f_slugs text[] := case
      when jsonb_typeof(p_filters -> 'slugs') = 'array'
      and jsonb_array_length(p_filters -> 'slugs') > 0
      then array(select jsonb_array_elements_text(p_filters -> 'slugs')) else null end;
    f_category text := nullif(trim(coalesce(p_filters ->> 'categorySlug', '')), '');
    f_collection text := nullif(trim(coalesce(p_filters ->> 'collectionSlug', '')), '');
    f_query text := nullif(trim(coalesce(p_filters ->> 'query', '')), '');
    f_bands jsonb := case
      when jsonb_typeof(p_filters -> 'priceBands') = 'array'
      and jsonb_array_length(p_filters -> 'priceBands') > 0
      then p_filters -> 'priceBands' else null end;
    f_sizes text[] := case
      when jsonb_typeof(p_filters -> 'sizes') = 'array'
      and jsonb_array_length(p_filters -> 'sizes') > 0
      then array(select jsonb_array_elements_text(p_filters -> 'sizes')) else null end;
    f_colours text[] := case
      when jsonb_typeof(p_filters -> 'colours') = 'array'
      and jsonb_array_length(p_filters -> 'colours') > 0
      then array(select jsonb_array_elements_text(p_filters -> 'colours')) else null end;
    f_fabrics text[] := case
      when jsonb_typeof(p_filters -> 'fabrics') = 'array'
      and jsonb_array_length(p_filters -> 'fabrics') > 0
      then array(select jsonb_array_elements_text(p_filters -> 'fabrics')) else null end;
    f_collection_names text[] := case
      when jsonb_typeof(p_filters -> 'collectionNames') = 'array'
      and jsonb_array_length(p_filters -> 'collectionNames') > 0
      then array(select jsonb_array_elements_text(p_filters -> 'collectionNames')) else null end;
    f_in_stock boolean := coalesce((p_filters ->> 'inStock')::boolean, false);
    f_on_sale boolean := coalesce((p_filters ->> 'onSale')::boolean, false);
    f_is_new boolean := coalesce((p_filters ->> 'isNew')::boolean, false);
    f_featured boolean := coalesce((p_filters ->> 'featured')::boolean, false);
    f_best_seller boolean := coalesce((p_filters ->> 'bestSeller')::boolean, false);
    f_sort text := coalesce(nullif(trim(coalesce(p_filters ->> 'sort', '')), ''), 'newest');
    -- 480 = 20 pages of 24, which is the most the listing will ever ask for in
    -- one request. It has to be at least that: getProducts() requests
    -- pageSize * page so a refresh at page 3 re-renders all 72 products the
    -- shopper had revealed, and a lower cap here would silently truncate it while
    -- the client still believed there was more.
    f_limit integer := least(480, greatest(1, coalesce((p_filters ->> 'limit')::integer, 24)));
    f_offset integer := greatest(0, coalesce((p_filters ->> 'offset')::integer, 0));
    -- ILIKE metacharacters are neutralised rather than escaped: a shopper typing
    -- "50%" is looking for products, not building a pattern.
    f_query_pattern text := case
      when f_query is null then null
      else '%' || regexp_replace(f_query, '[%_\\]', ' ', 'g') || '%'
    end;
    result jsonb;
  begin
    with scope as (
      -- Every filter, variant conditions included, applied BEFORE any paging.
      select p.id, p.base_price, p.created_at, p.review_count
      from public.products p
      left join public.categories c on c.id = p.category_id
      left join public.collections col on col.id = p.collection_id
      where p.status = 'active'
        and (f_slug is null or p.slug = f_slug)
        and (f_slugs is null or p.slug = any(f_slugs))
        and (f_category is null or c.slug = f_category)
        and (
          f_collection is null
          or (col.slug = f_collection and public.collection_is_visible(col.id))
        )
        and (
          f_collection_names is null
          or (col.name_en = any(f_collection_names) and public.collection_is_visible(col.id))
        )
        and (
          f_query is null
          or p.name_en ilike f_query_pattern
          or p.product_code ilike f_query_pattern
          or lower(f_query) = any(p.tags)
        )
        and (f_fabrics is null or p.fabric_en = any(f_fabrics))
        and (not f_on_sale or p.compare_at_price is not null)
        and (not f_is_new or p.is_new)
        and (not f_featured or p.is_featured)
        and (not f_best_seller or p.is_best_seller)
        and (
          f_bands is null
          or exists (
            select 1
            from jsonb_array_elements(f_bands) as band
            where p.base_price >= coalesce((band ->> 'min')::numeric, 0)
              and p.base_price <= coalesce((band ->> 'max')::numeric, 999999999)
          )
        )
        and (
          (f_sizes is null and f_colours is null and not f_in_stock)
          or exists (
            select 1
            from public.product_variants v
            where v.product_id = p.id
              and v.is_active
              and (f_sizes is null or v.size = any(f_sizes))
              and (f_colours is null or v.colour_en = any(f_colours))
              and (not f_in_stock or v.stock_quantity > 0)
          )
        )
    ),
    -- Only the page's rows are joined out to images, variants and taxonomy, so
    -- the cost of building the payload is proportional to what is displayed
    -- rather than to how many products matched.
    page as (
      select p.*
      from public.products p
      join scope s on s.id = p.id
      order by
        -- Every branch ends in id, so two products that tie on the sort key keep
        -- a stable relative order between requests. Without it, page 2 could
        -- repeat a product from page 1 and skip another.
        case when f_sort = 'price-low' then p.base_price end asc nulls last,
        case when f_sort = 'price-high' then p.base_price end desc nulls last,
        case when f_sort = 'popular' then p.review_count end desc nulls last,
        case when f_sort not in ('price-low', 'price-high', 'popular')
            then p.created_at end desc nulls last,
        p.id
      limit f_limit offset f_offset
    )
    select jsonb_build_object(
      -- The count is of the whole filtered set, variant conditions included, so
      -- "73 products" always means 73 products a shopper could reach by paging.
      'total', (select count(*) from scope),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'slug', p.slug,
            'name', p.name_en,
            'description', p.description_en,
            -- Staff-entered overrides for <title> and the meta description.
            -- Null when blank, so the storefront falls back to name/description.
            'seoTitle', nullif(trim(coalesce(p.seo_title, '')), ''),
            'seoDescription', nullif(trim(coalesce(p.seo_description, '')), ''),
            'category', coalesce(c.slug, 'collection'),
            'categoryName', c.name_en,
            'price', p.base_price,
            'previousPrice', p.compare_at_price,
            'images', coalesce(media.images, '[]'::jsonb),
            -- The same photographs with their stored alt text, primary flag
            -- and order. `images` above is unchanged so nothing that reads a
            -- flat URL array has to change.
            'media', coalesce(media.media, '[]'::jsonb),
            'colours', coalesce(variants.colours, '[]'::jsonb),
            'sizes', coalesce(variants.sizes, '[]'::jsonb),
            'fabric', p.fabric_en,
            'stock', coalesce(variants.total_stock, 0),
            'tags', to_jsonb(p.tags),
            'collection', case
              when col.id is not null and public.collection_is_visible(col.id)
              then col.name_en else '' end,
            'isNew', p.is_new,
            'isSale', p.compare_at_price is not null,
            'isFeatured', p.is_featured,
            'isBestSeller', p.is_best_seller,
            -- Denormalised on the product row and kept current by the
            -- reviews_recalculate_rating trigger. No review bodies are read here.
            'rating', p.average_rating,
            'reviewCount', p.review_count,
            'productCode', p.product_code,
            'careInstructions', p.care_instructions_en,
            -- New in 0026: one optional short product video, null when there is
            -- none, which is every product until somebody adds one.
            'videoUrl', nullif(trim(coalesce(p.video_url, '')), ''),
            'unstitchedDetails', p.unstitched_details,
            'readyMadeDetails', p.ready_made_details
          )
          order by
            case when f_sort = 'price-low' then p.base_price end asc nulls last,
            case when f_sort = 'price-high' then p.base_price end desc nulls last,
            case when f_sort = 'popular' then p.review_count end desc nulls last,
            case when f_sort not in ('price-low', 'price-high', 'popular')
                then p.created_at end desc nulls last,
            p.id
        )
        from page p
        left join public.categories c on c.id = p.category_id
        left join public.collections col on col.id = p.collection_id
        left join lateral (
          select
            jsonb_agg(i.image_url order by i.is_primary desc, i.sort_order, i.id) as images,
            jsonb_agg(
              jsonb_build_object(
                'url', i.image_url,
                -- Blank alt is returned as null, not '': the storefront needs to
                -- tell "nobody has written alt text yet" (derive one from the
                -- product name) from "deliberately decorative".
                'alt', nullif(trim(coalesce(i.alt_en, '')), ''),
                'isPrimary', i.is_primary,
                'sortOrder', i.sort_order,
                -- Null for a general photograph that belongs to the product
                -- rather than to one colourway. The product page groups by this;
                -- listings ignore it.
                'colourId', i.product_colour_id,
                -- New in 0026: what the photograph shows (front, back, fabric
                -- close-up...). Null on every photograph uploaded before roles
                -- existed, and optional after.
                'role', i.media_role
              ) order by i.is_primary desc, i.sort_order, i.id
            ) as media
          from public.product_images i
          where i.product_id = p.id
        ) media on true
        left join lateral (
          select
            (
              -- Qualified with the derived table's alias throughout: `name` and
              -- `size` are both non-reserved keywords, and an unqualified one
              -- inside a correlated subquery is exactly the kind of reference
              -- that binds to the wrong relation when a column is added later.
              select jsonb_agg(
                jsonb_build_object('name', c2.name, 'hex', c2.hex, 'id', c2.colour_id)
                order by c2.name
              )
              from (
                select v.colour_en as name, min(v.colour_hex) as hex,
                      min(v.product_colour_id::text)::uuid as colour_id
                from public.product_variants v
                where v.product_id = p.id and v.is_active
                  and coalesce(trim(v.colour_en), '') <> ''
                group by v.colour_en
              ) c2
            ) as colours,
            (
              select jsonb_agg(to_jsonb(s2.size) order by s2.size)
              from (
                select distinct v.size as size
                from public.product_variants v
                where v.product_id = p.id and v.is_active
              ) s2
            ) as sizes,
            (
              select coalesce(sum(v.stock_quantity), 0)
              from public.product_variants v
              where v.product_id = p.id and v.is_active
            ) as total_stock
        ) variants on true
      ), '[]'::jsonb)
    ) into result;

    return result;
  end;
  $$;

  -- ---------------------------------------------------------------------------
  -- 7. place_order(): the launch offer is applied here or nowhere
  --
  -- Reproduced from 0025 with one addition: after the coupon and before the
  -- total, the live offer is read, re-validated and applied. The signature is
  -- unchanged -- there is still nowhere in it to put a price, a discount or an
  -- offer name -- so no caller changes and the browser gains no new say over
  -- what an order costs.
  -- ---------------------------------------------------------------------------

  create or replace function public.place_order(
    p_customer jsonb,
    p_shipping_address jsonb,
    p_items jsonb,
    p_delivery_method text,
    p_payment_method text,
    p_coupon_code text default null,
    p_customer_note text default null,
    p_idempotency_key text default null,
    p_client_fingerprint text default null
  )
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    line record;
    variant_record record;
    existing_order record;
    new_order_id uuid := gen_random_uuid();
    new_order_number text;
    new_tracking_token text := substr(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      1, 48
    );
    current_user_id uuid := auth.uid();
    v_customer_phone text;
    normalised_address jsonb;
    shipping_zone text;
    calculated_subtotal numeric(12,2) := 0;
    calculated_delivery numeric(12,2) := 0;
    calculated_discount numeric(12,2) := 0;
    coupon_result jsonb;
    coupon_row public.coupons%rowtype;
    cod_enabled boolean;
    order_total numeric(12,2);
    risk text[] := '{}';
    distinct_lines integer;
    -- New in 0026: the launch offer. Collected while pricing, decided after the
    -- coupon, applied before the total.
    ordered_product_ids uuid[] := '{}';
    first_order boolean;
    offer jsonb;
    offer_discount numeric(12,2) := 0;
    offer_label text;
  begin
    if nullif(trim(coalesce(p_idempotency_key, '')), '') is not null then
      select order_number, tracking_token, total into existing_order
      from public.orders where idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object(
          'orderNumber', existing_order.order_number,
          'trackingToken', existing_order.tracking_token,
          'total', existing_order.total,
          'replayed', true
        );
      end if;
    end if;

    v_customer_phone := public.normalize_bd_phone(p_customer ->> 'phone');
    if length(trim(coalesce(p_customer ->> 'name', ''))) < 2
      or v_customer_phone is null then
      raise exception 'invalid_customer_or_address';
    end if;

    -- The address is normalised and validated before any stock is locked, any
    -- coupon is spent, or any row is written.
    normalised_address := public.normalize_shipping_address(p_shipping_address);
    if normalised_address is null then
      raise exception 'invalid_shipping_location';
    end if;
    shipping_zone := normalised_address ->> 'deliveryZone';

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'empty_order';
    end if;
    if jsonb_array_length(p_items) > 50 then
      raise exception 'too_many_items';
    end if;

    select (value #>> '{}')::boolean into cod_enabled
    from public.store_settings where key = 'cod_enabled';
    cod_enabled := coalesce(cod_enabled, true);
    if not cod_enabled then
      raise exception 'cod_disabled';
    end if;

    if not public.consume_rate_limit('order:phone', v_customer_phone, 5, 3600) then
      raise exception 'rate_limited';
    end if;
    if p_client_fingerprint is not null
      and not public.consume_rate_limit('order:client', p_client_fingerprint, 10, 3600) then
      raise exception 'rate_limited';
    end if;

    if exists (
      select 1 from public.orders
      where normalized_phone = v_customer_phone
        and created_at > now() - interval '90 seconds'
    ) then
      raise exception 'duplicate_order';
    end if;

    if (
      select count(*) from public.orders
      where normalized_phone = v_customer_phone
        and status = 'cancelled'
        and created_at > now() - interval '30 days'
    ) >= 3 then
      risk := array_append(risk, 'repeat_cancellations');
    end if;
    if current_user_id is null then
      risk := array_append(risk, 'guest_checkout');
    end if;

    select count(*) into distinct_lines
    from (
      select distinct (element ->> 'variantId')::uuid
      from jsonb_array_elements(p_items) as element
    ) unique_variants;
    if distinct_lines = 0 then
      raise exception 'empty_order';
    end if;

    for line in
      select (element ->> 'variantId')::uuid as variant_id,
            sum((element ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as element
      group by 1
      order by 1
    loop
      if line.quantity < 1 or line.quantity > 20 then
        raise exception 'invalid_quantity';
      end if;

      select
        v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en,
        v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
        p.name_en, p.product_code
      into variant_record
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = line.variant_id
        and v.is_active
        and p.status = 'active'
      for update of v;

      if not found then raise exception 'invalid_variant'; end if;
      if variant_record.stock_quantity < line.quantity then
        raise exception 'out_of_stock:%', variant_record.sku;
      end if;

      calculated_subtotal := calculated_subtotal + variant_record.price * line.quantity;
      if not (variant_record.product_id = any(ordered_product_ids)) then
        ordered_product_ids := array_append(ordered_product_ids, variant_record.product_id);
      end if;
    end loop;

    -- Priced from the zone the customer chose, by the same function the
    -- storefront quotes from.
    calculated_delivery := public.calculate_delivery_fee_for_zone(
      calculated_subtotal, shipping_zone
    );

    if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
      select * into coupon_row
      from public.coupons
      where upper(code) = upper(trim(p_coupon_code))
      for update;

      if not found then raise exception 'invalid_coupon'; end if;

      coupon_result := public.validate_coupon(
        p_coupon_code, calculated_subtotal, current_user_id, v_customer_phone
      );
      if not coalesce((coupon_result ->> 'valid')::boolean, false) then
        raise exception 'invalid_coupon:%', coalesce(coupon_result ->> 'reason', 'invalid');
      end if;

      if coupon_row.usage_limit is not null
        and coupon_row.usage_count >= coupon_row.usage_limit then
        raise exception 'invalid_coupon:usage_limit';
      end if;

      calculated_discount := (coupon_result ->> 'discount')::numeric;
      update public.coupons
        set usage_count = usage_count + 1
        where id = coupon_row.id;
    end if;

    /*
    * THE LAUNCH OFFER (new in 0026)
    *
    * Nothing about it comes from the browser. The offer is re-read here, its
    * dates are re-checked here, and whether these products take part is
    * re-checked here -- so an expired offer cannot be applied, a disabled one
    * cannot be applied, and a customer cannot name one.
    *
    * "First order" means this phone number has never placed an order and, if
    * they are signed in, neither has the account. Cancelled orders still count
    * as having ordered: the offer is for new customers, not for people who have
    * ordered and cancelled.
    *
    * It stacks with a coupon, and the combined discount is clamped so it can
    * never exceed the goods -- delivery is never discounted by a money offer,
    * only waived outright by a free-delivery offer.
    */
    first_order := not exists (
      select 1 from public.orders o
      where o.normalized_phone = v_customer_phone
        or (current_user_id is not null and o.user_id = current_user_id)
    );

    offer := public.launch_offer_benefit(
      calculated_subtotal, ordered_product_ids, first_order
    );

    if offer is not null then
      offer_label := offer ->> 'label';
      if coalesce((offer ->> 'freeDelivery')::boolean, false) then
        calculated_delivery := 0;
      end if;
      offer_discount := greatest(coalesce((offer ->> 'discount')::numeric, 0), 0);
      -- Never below zero goods: the coupon has already taken its share.
      offer_discount := least(
        offer_discount,
        greatest(calculated_subtotal - calculated_discount, 0)
      );
      calculated_discount := calculated_discount + offer_discount;
    end if;

    order_total := calculated_subtotal + calculated_delivery - calculated_discount;
    if order_total < 0 then
      raise exception 'invalid_total';
    end if;

    new_order_number := public.generate_order_number();

    insert into public.orders (
      id, order_number, user_id, customer_name, customer_email, customer_phone,
      normalized_phone, payment_method, delivery_method, subtotal, delivery_fee,
      discount_amount, total, shipping_address, customer_note, tracking_token,
      idempotency_key, client_fingerprint, risk_flags,
      launch_offer_discount, launch_offer_label
    ) values (
      new_order_id, new_order_number, current_user_id,
      trim(p_customer ->> 'name'), nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), ''),
      v_customer_phone, v_customer_phone,
      'cash_on_delivery'::public.payment_method,
      'standard'::public.delivery_method,
      calculated_subtotal, calculated_delivery, calculated_discount, order_total,
      normalised_address, nullif(trim(coalesce(p_customer_note, '')), ''),
      new_tracking_token, nullif(trim(coalesce(p_idempotency_key, '')), ''),
      p_client_fingerprint, risk,
      offer_discount, offer_label
    );

    if coupon_result is not null then
      insert into public.coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
      values (
        (coupon_result ->> 'coupon_id')::uuid, new_order_id, current_user_id, calculated_discount
      )
      on conflict (coupon_id, order_id) do nothing;
    end if;

    perform set_config('tara.stock_write', 'on', true);

    for line in
      select (element ->> 'variantId')::uuid as variant_id,
            sum((element ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as element
      group by 1
      order by 1
    loop
      select
        v.id as variant_id, v.product_id, v.sku, v.size, v.colour_en,
        v.stock_quantity, coalesce(v.price_override, p.base_price) as price,
        p.name_en, p.product_code,
        coalesce(
          (
            -- The photograph of the colour that was actually bought, when the
            -- variant carries one and that colour has images of its own.
            select i.image_url from public.product_images i
            where i.product_id = p.id
              and v.product_colour_id is not null
              and i.product_colour_id = v.product_colour_id
            order by i.is_primary desc, i.sort_order, i.id limit 1
          ),
          (
            select i.image_url from public.product_images i
            where i.product_id = p.id
            order by i.is_primary desc, i.sort_order, i.id limit 1
          ),
          ''
        ) as image_url
      into variant_record
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = line.variant_id;

      insert into public.order_items (
        order_id, product_id, product_variant_id, product_name_en,
        product_code, sku, size, colour_en, unit_price, quantity,
        line_total, product_image_url
      ) values (
        new_order_id, variant_record.product_id, variant_record.variant_id,
        variant_record.name_en, variant_record.product_code,
        variant_record.sku, variant_record.size, variant_record.colour_en,
        variant_record.price, line.quantity,
        variant_record.price * line.quantity, variant_record.image_url
      );

      update public.product_variants
        set stock_quantity = stock_quantity - line.quantity
        where id = variant_record.variant_id;

      insert into public.inventory_adjustments (
        product_variant_id, order_id, previous_quantity, new_quantity, delta, reason, note
      ) values (
        variant_record.variant_id, new_order_id, variant_record.stock_quantity,
        variant_record.stock_quantity - line.quantity, -line.quantity,
        'order_placed', new_order_number
      );
    end loop;

    perform set_config('tara.stock_write', 'off', true);

    insert into public.order_tracking_events (
      order_id, status, note_en, is_customer_visible
    ) values (
      new_order_id, 'pending', 'Order placed', true
    );

    insert into public.notification_outbox (template, recipient, payload)
    select 'order_placed', lower(trim(p_customer ->> 'email')),
          jsonb_build_object('orderNumber', new_order_number, 'total', order_total)
    where nullif(trim(coalesce(p_customer ->> 'email', '')), '') is not null;

    insert into public.notification_outbox (template, recipient, payload)
    values (
      'admin_new_order', 'store',
      jsonb_build_object(
        'orderNumber', new_order_number, 'total', order_total,
        'customer', trim(p_customer ->> 'name'), 'phone', v_customer_phone
      )
    );

    if current_user_id is not null then
      delete from public.cart_items
      where cart_id = (select id from public.carts where user_id = current_user_id);
    end if;

    return jsonb_build_object(
      'orderNumber', new_order_number,
      'trackingToken', new_tracking_token,
      'total', order_total,
      'replayed', false
    );
  end;
  $$;


  -- CREATE OR REPLACE keeps an existing ACL, so on a database that has 0012
  -- these two are no-ops. They are restated so a database repaired out of order
  -- still ends up correct.
  grant execute on function public.search_catalogue(jsonb) to anon, authenticated;
  grant execute on function public.place_order(jsonb, jsonb, jsonb, text, text, text, text, text, text)
    to anon, authenticated;

  commit;