-- Where each account came from (decision 0052): the channel and page of the visit that led to it, saved once
-- when the account is made, so Admin → Analytics can follow each channel through to teams that run practices.
-- Cookie-free like the visit counts (decision 0019): the link is the same day's visitor hash, worked out here
-- from the sign-in request, so it only holds when the account was made the same day, in the same browser.
-- Only a referring site or link tag and a page path are kept: nothing about the person. Safe to run twice.

create table if not exists public.account_sources (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  invited boolean not null default false,
  traced boolean not null default false,
  source text,
  landing text,
  first_seen_at timestamptz
);

alter table public.account_sources enable row level security;
drop policy if exists "analytics viewers read account sources" on public.account_sources;
create policy "analytics viewers read account sources" on public.account_sources for select using (public.can_see_analytics());
-- No insert, update or delete policies: rows are written only by record_account_source below.

-- Called once, by the new account's own session, right after its first sign-in.
create or replace function public.record_account_source(ip text, agent text, invited boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Vancouver')::date;
  s bytea;
  who text;
  src text;
  page text;
  seen timestamptz;
begin
  if uid is null then return; end if;
  select salt into s from private.visit_salts where day = today;
  if s is not null then
    who := encode(extensions.digest(s || convert_to(coalesce(ip, '') || '|' || coalesce(agent, ''), 'UTF8'), 'sha256'), 'hex');
    select e.source, e.path, e.occurred_at into src, page, seen
    from public.page_events e
    where e.visitor = who and e.name = 'view' and not e.automated
      and e.occurred_at >= (today::timestamp at time zone 'America/Vancouver')
    order by e.occurred_at
    limit 1;
  end if;
  insert into public.account_sources (user_id, invited, traced, source, landing, first_seen_at)
  values (uid, coalesce(invited, false), seen is not null, src, page, seen)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.record_account_source(text, text, boolean) from public;
revoke execute on function public.record_account_source(text, text, boolean) from anon;
grant execute on function public.record_account_source(text, text, boolean) to authenticated;

-- Admin → Analytics: each account made since `since`, where it came from, and how far it got. No ids, emails
-- or names: one row per account with dates and yes/no answers. Analytics viewers only; admins are left out.
create or replace function public.account_sources_report(since timestamptz)
returns table (created_at timestamptz, invited boolean, traced boolean, source text, landing text, made_team boolean, ran_practice boolean)
language sql stable security definer set search_path = ''
as $$
  select u.created_at,
         coalesce(a.invited, false),
         coalesce(a.traced, false),
         a.source,
         a.landing,
         exists (select 1 from public.team_members m where m.user_id = u.id and m.role = 'head_coach'),
         exists (select 1 from public.team_members m join public.practice_checkins c on c.team_id = m.team_id
                 where m.user_id = u.id and m.role = 'head_coach')
  from auth.users u
  left join public.account_sources a on a.user_id = u.id
  where public.can_see_analytics()
    and u.created_at >= since
    and u.email_confirmed_at is not null and u.deleted_at is null
    and not exists (select 1 from public.admins ad where ad.user_id = u.id);
$$;

revoke all on function public.account_sources_report(timestamptz) from public;
revoke execute on function public.account_sources_report(timestamptz) from anon;
grant execute on function public.account_sources_report(timestamptz) to authenticated;
