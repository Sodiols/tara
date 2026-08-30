/*
TARA MIGRATION 0018 -- Profile creation for OAuth (Google) sign-ups

Run after 0017. Safe to re-run. One transaction. Destroys nothing.

WHY
---
`handle_new_user()` was written for email sign-up, where the application
controls `raw_user_meta_data` and always puts `full_name` and `phone` in it. A
Google sign-in is not that: the metadata is whatever Google returned, and the
key names differ.

Specifically:

  * Google supplies the display name as BOTH `full_name` and `name` depending on
    the identity payload; the previous code read only `full_name`, so a sign-up
    that arrived with `name` produced a profile with an empty name and a
    customer whose account page greeted nobody.
  * Google supplies the picture as `avatar_url` and/or `picture`. Neither was
    read, so `profiles.avatar_url` stayed null for every OAuth user even though
    the column exists and the account UI can use it.
  * Google never supplies a phone number. That was already handled and still is.

WHAT IS DELIBERATELY UNCHANGED
------------------------------
`role` is not written here, so it keeps its column default of 'customer'. This
is the guarantee that signing in with Google -- which anyone with a Google
account can do -- cannot produce anything other than an ordinary customer.
Staff roles are granted only through `set_profile_role()`, which requires an
existing full admin. Do not add `role` to this insert.

`on conflict (id) do nothing` is also kept. A customer who signed up by email
and later signs in with Google on the same address reaches the same profile
row; their existing name is not overwritten by whatever Google holds, and no
second profile is created.

Every value is coalesced, because assuming any particular key is present in a
third party's metadata is how this broke in the first place.

VERIFY
------
  select id, full_name, email, phone, avatar_url, role
  from public.profiles order by created_at desc limit 5;
  -- an OAuth sign-up should have a name, an email, an empty phone and role 'customer'
*/

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    -- Email sign-up sends 'full_name'; Google may send either key.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    coalesce(new.email, ''),
    -- OAuth providers do not supply this. The column is not null, so '' rather
    -- than null; checkout collects the real number.
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    -- Nullable, so a provider that sends no picture simply leaves it unset.
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture',
        ''
      ),
      ''
    )
  )
  on conflict (id) do nothing;

  insert into public.carts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

commit;
