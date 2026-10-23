-- The public landing page: the waitlist, cookie-free visit counts, and invite-only sign-up
-- (decision 0019). Safe to run twice. Run the whole file in the Supabase SQL editor.

-- 1. Who sees Analytics: Brett only, not every admin (the waitlist holds personal emails).
alter table public.admins add column if not exists analytics boolean not null default false;
update public.admins set analytics = true where lower(email) in ('brett@paddio.ca', 'bgilmour7@gmail.com');

create or replace function public.can_see_analytics()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid() and analytics); $$;

-- 2. The waitlist. One row per email; joining again updates the row instead of failing.
-- status is Brett's: new → emailed → call_booked → onboarded (may now create an account) or not_a_fit.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  kind text not null check (kind in ('coach', 'association')),
  age_group text check (age_group in ('U5', 'U7', 'U9')),
  org_name text check (org_name is null or char_length(org_name) <= 120),
  team_count int check (team_count is null or team_count between 1 and 500),
  source text check (source is null or char_length(source) <= 60),
  status text not null default 'new' check (status in ('new', 'emailed', 'call_booked', 'onboarded', 'not_a_fit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists "analytics viewers read the waitlist" on public.waitlist;
create policy "analytics viewers read the waitlist" on public.waitlist for select using (public.can_see_analytics());
drop policy if exists "analytics viewers update the waitlist" on public.waitlist;
create policy "analytics viewers update the waitlist" on public.waitlist for update using (public.can_see_analytics()) with check (public.can_see_analytics());

-- Anyone on the landing page can join. Returns true when the email was new.
create or replace function public.join_waitlist(address text, joining_as text, age text, org text, teams int, came_from text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  clean text := lower(trim(address));
  inserted boolean;
begin
  if clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(clean) > 254 then raise exception 'bad-email'; end if;
  if joining_as not in ('coach', 'association') then raise exception 'bad-kind'; end if;
  insert into public.waitlist as w (email, kind, age_group, org_name, team_count, source)
  values (
    clean, joining_as,
    case when joining_as = 'coach' and age in ('U5', 'U7', 'U9') then age end,
    nullif(left(trim(coalesce(org, '')), 120), ''),
    case when joining_as = 'association' and teams between 1 and 500 then teams end,
    nullif(left(coalesce(came_from, ''), 60), '')
  )
  on conflict (email) do update set
    kind = excluded.kind,
    age_group = coalesce(excluded.age_group, w.age_group),
    org_name = coalesce(excluded.org_name, w.org_name),
    team_count = coalesce(excluded.team_count, w.team_count),
    updated_at = now()
  returning (xmax = 0) into inserted;
  return inserted;
end;
$$;

-- Sign-up is invite-only while the waitlist runs: a new account needs a team join link, or a
-- waitlist row Brett has marked Onboarded.
create or replace function public.can_create_account(address text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.waitlist where email = lower(trim(address)) and status = 'onboarded'); $$;

-- 3. Visit counts without cookies. A visitor is a hash of IP + browser + a salt that changes every
-- day. Salts live in the private schema, and yesterday's is deleted, so a hash can't be traced back
-- to a person or followed across days. The IP and browser string are never stored.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.visit_salts (day date primary key, salt bytea not null);

create table if not exists public.page_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  name text not null check (name in ('view', 'reached_form', 'form_start', 'signup')),
  path text not null check (char_length(path) <= 200),
  visitor text not null,
  source text check (source is null or char_length(source) <= 60),
  device text check (device in ('phone', 'tablet', 'desktop')),
  region text check (region is null or char_length(region) <= 80)
);
create index if not exists page_events_occurred_at on public.page_events (occurred_at);
alter table public.page_events enable row level security;
drop policy if exists "analytics viewers read page events" on public.page_events;
create policy "analytics viewers read page events" on public.page_events for select using (public.can_see_analytics());

create or replace function public.record_page_event(event text, page text, ip text, agent text, came_from text, kind_of_device text, place text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Vancouver')::date;
  s bytea;
begin
  if event not in ('view', 'reached_form', 'form_start', 'signup') then raise exception 'bad-event'; end if;
  insert into private.visit_salts (day, salt) values (today, extensions.gen_random_bytes(16)) on conflict (day) do nothing;
  delete from private.visit_salts where day < today;
  select salt into s from private.visit_salts where day = today;
  insert into public.page_events (name, path, visitor, source, device, region)
  values (
    event,
    left(coalesce(page, '/'), 200),
    encode(extensions.digest(s || convert_to(coalesce(ip, '') || '|' || coalesce(agent, ''), 'UTF8'), 'sha256'), 'hex'),
    nullif(left(coalesce(came_from, ''), 60), ''),
    case when kind_of_device in ('phone', 'tablet', 'desktop') then kind_of_device end,
    nullif(left(coalesce(place, ''), 80), '')
  );
end;
$$;

revoke all on function public.can_see_analytics() from public;
revoke all on function public.join_waitlist(text, text, text, text, int, text) from public;
revoke all on function public.can_create_account(text) from public;
revoke all on function public.record_page_event(text, text, text, text, text, text, text) from public;
grant execute on function public.can_see_analytics() to anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, int, text) to anon, authenticated;
grant execute on function public.can_create_account(text) to anon, authenticated;
grant execute on function public.record_page_event(text, text, text, text, text, text, text) to anon, authenticated;
