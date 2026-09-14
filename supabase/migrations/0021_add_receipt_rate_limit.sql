/*
TARA MIGRATION 0021 -- The receipt endpoint gets the durable limit it asked for

Run after 0020. Safe to re-run. One transaction. Destroys nothing.

WHAT WAS WRONG
--------------
`app/api/orders/[orderNumber]/receipt/route.ts` throttles in two layers:

    guardPublicAction("receipt", 20, 600)        in-process, per instance
    consumeDurableLimit("receipt", fingerprint)  Postgres, shared

The second calls `consume_public_rate_limit('receipt', ...)`. That function
(migration 0010) looks the allowance up from a fixed CASE list, and the list
never had a `receipt` arm -- so every call fell through to

    else raise exception 'unknown_rate_limit_bucket';

`consumeDurableLimit()` catches database errors and FAILS OPEN, deliberately,
so that a database blip cannot take the site down. Here that meant the durable
layer silently allowed every receipt request, and logged a warning each time.
On a serverless deployment the in-process layer is per instance and empty after
every cold start, so in practice the receipt PDF -- the most expensive public
response on the site to generate -- had no shared limit at all.

It was not an authorization hole. `get_customer_receipt()` still requires the
caller to own the order or present its 192-bit tracking token, so nobody could
read a receipt they were not entitled to. What was missing was abuse protection:
repeated PDF generation against a valid token, or enumeration attempts against
invalid ones, were bounded only by whichever instance happened to answer.

WHAT CHANGES
------------
One new arm: `receipt` -> 20 requests per 600 seconds, matching the numbers the
route already passes to its in-process layer, so the two layers agree.

Every existing bucket keeps exactly the allowance and window it has in 0010.
They are restated below only because CREATE OR REPLACE replaces the whole body;
nothing is loosened, tightened or reordered.

WHAT IS PRESERVED
-----------------
  * the signature (text, text) -> boolean, so no caller changes and no
    dependent object is invalidated;
  * SECURITY DEFINER with `set search_path = ''`, as in 0010 -- every reference
    inside is schema-qualified;
  * the unknown-bucket exception, so a typo in a future caller fails loudly
    in the logs rather than quietly enforcing nothing;
  * the grant model from 0012: no EXECUTE for PUBLIC, EXECUTE for anon and
    authenticated. CREATE OR REPLACE keeps an existing ACL, so on a database
    that already has 0012 the grant lines are a no-op; they are restated so a
    database repaired out of order still ends up correct.

`consume_rate_limit()` itself -- the four-argument function that takes a
caller-chosen allowance -- is not touched and stays ungranted.

A regression test, tests/rate-limit-buckets.test.ts, now fails the suite if any
`consumeDurableLimit("<bucket>")` in the application names a bucket that the
latest definition of this function does not handle. That test is what would
have caught this.
*/

begin;

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
    -- New in 0021. Matches guardPublicAction("receipt", 20, 600) in
    -- app/api/orders/[orderNumber]/receipt/route.ts.
    when 'receipt'       then allowance := 20; window_seconds := 600;
    else raise exception 'unknown_rate_limit_bucket';
  end case;

  return public.consume_rate_limit(p_bucket, p_identifier, allowance, window_seconds);
end;
$$;

revoke execute on function public.consume_public_rate_limit(text, text) from public;
grant execute on function public.consume_public_rate_limit(text, text) to anon, authenticated;

commit;
