-- Admin → Analytics: In the app and Speed (decision 0025). Safe to run more than once.

-- 0. Analytics is Brett's. He signs in as bgilmour7@gmail.com, which the first migration missed.
update public.admins set analytics = true where lower(email) in ('brett@paddio.ca', 'bgilmour7@gmail.com');

-- 1. One row per coach per day they open the app, and whether it was from the home screen
-- (installed). Coaches are adults with accounts; no child data. Written only by record_app_open.
create table if not exists public.app_opens (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  installed boolean not null,
  device text check (device in ('phone', 'tablet', 'desktop')),
  first_at timestamptz not null default now(),
  primary key (user_id, day, installed)
);
create index if not exists app_opens_first_at on public.app_opens (first_at);
alter table public.app_opens enable row level security;
drop policy if exists "analytics viewers read app opens" on public.app_opens;
create policy "analytics viewers read app opens" on public.app_opens for select using (public.can_see_analytics());

create or replace function public.record_app_open(installed boolean, kind_of_device text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.app_opens (user_id, day, installed, device)
  select auth.uid(), (now() at time zone 'America/Vancouver')::date, coalesce(installed, false),
         case when kind_of_device in ('phone', 'tablet', 'desktop') then kind_of_device end
  where auth.uid() is not null
  on conflict (user_id, day, installed) do nothing;
$$;

-- 2. Page speed from real visits: the metric, its value, the kind of page, the kind of device.
-- No visitor id, user or address. Kept 90 days.
create table if not exists public.web_vitals (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  metric text not null check (metric in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value real not null check (value >= 0 and value <= 120000),
  page text not null check (page in ('Landing', 'Today', 'Plans', 'Planner', 'Check-in', 'Drills', 'Team', 'Parent link', 'Admin', 'Other')),
  device text check (device in ('phone', 'tablet', 'desktop'))
);
create index if not exists web_vitals_occurred_at on public.web_vitals (occurred_at);
alter table public.web_vitals enable row level security;
drop policy if exists "analytics viewers read web vitals" on public.web_vitals;
create policy "analytics viewers read web vitals" on public.web_vitals for select using (public.can_see_analytics());

create or replace function public.record_web_vitals(page text, kind_of_device text, items jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if page not in ('Landing', 'Today', 'Plans', 'Planner', 'Check-in', 'Drills', 'Team', 'Parent link', 'Admin', 'Other') then raise exception 'bad-page'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 10 then raise exception 'bad-items'; end if;
  insert into public.web_vitals (metric, value, page, device)
  select i->>'name', (i->>'value')::real, page,
         case when kind_of_device in ('phone', 'tablet', 'desktop') then kind_of_device end
  from jsonb_array_elements(items) i
  where i->>'name' in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')
    and case when jsonb_typeof(i->'value') = 'number' then (i->>'value')::real between 0 and 120000 else false end;
  delete from public.web_vitals where occurred_at < now() - interval '90 days';
end;
$$;

-- 3. The rows behind "In the app", for analytics viewers only. Teams, practices and drills by id,
-- coaches by account id: counted on the page, never named.
create or replace function public.app_usage(since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  since_day date := (since at time zone 'America/Vancouver')::date;
begin
  if not public.can_see_analytics() then raise exception 'not-allowed'; end if;
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'createdAt', t.created_at)) from public.teams t), '[]'::jsonb),
    'practices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'teamId', p.team_id, 'date', p.date, 'createdAt', p.created_at, 'blocks', p.blocks,
        'checkedIn', exists (select 1 from public.practice_checkins c where c.practice_id = p.id)))
      from public.practices p where p.created_at >= since or p.date >= since_day), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('userId', a.user_id, 'teamId', a.team_id, 'at', a.at, 'kind', a.kind))
      from (
        select o.user_id, (select m.team_id from public.team_members m where m.user_id = o.user_id order by m.created_at limit 1) as team_id,
               o.first_at as at, case when o.installed then 'open_installed' else 'open' end as kind
          from public.app_opens o where o.first_at >= since
        union all
        select e.user_id, e.team_id, e.at, 'edit' from public.practice_edits e where e.at >= since and e.user_id is not null
        union all
        select c.user_id, c.team_id, c.saved_at, 'checkin' from public.practice_checkins c where c.saved_at >= since
      ) a), '[]'::jsonb),
    'marks', coalesce((
      select jsonb_agg(jsonb_build_object('drillId', m->>'drillId', 'rating', m->>'rating', 'at', c.saved_at))
      from public.practice_checkins c, jsonb_array_elements(c.marks) m
      where c.saved_at >= since and m->>'rating' in ('hit', 'flop') and m->>'drillId' is not null), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'at', x.at))
      from (
        select 'share' as kind, s.created_at as at from public.practice_shares s where s.created_at >= since
        union all select 'kept', k.kept_at from public.practice_suggestions_kept k where k.kept_at >= since
        union all select 'favorite', f.created_at from public.team_favorites f where f.created_at >= since
        union all select 'request', r.created_at from public.drill_requests r where r.created_at >= since
      ) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.record_app_open(boolean, text) from public;
revoke all on function public.record_web_vitals(text, text, jsonb) from public;
revoke all on function public.app_usage(timestamptz) from public;
grant execute on function public.record_app_open(boolean, text) to authenticated;
grant execute on function public.record_web_vitals(text, text, jsonb) to anon, authenticated;
grant execute on function public.app_usage(timestamptz) to authenticated;
