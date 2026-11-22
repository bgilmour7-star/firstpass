-- Where accounts came from (decision 0052), tightened after review: nobody reads account_sources directly.
-- Its rows hold a user id next to where that account came from, so they're only reached through
-- account_sources_report, which returns no ids. first_seen_at matched a page_events row exactly, which could
-- link an account to that day's visits, so it's no longer written; and the report gives each account's day, not its time.
-- Safe to run twice.

-- The read policy now allows no one: the table is reached only through the two functions below.
alter policy "analytics viewers read account sources" on public.account_sources using (false);
-- first_seen_at stays (dropping a column is a one-way change) but is no longer written: it's always null.
comment on column public.account_sources.first_seen_at is 'Unused since 20261128010000: always null.';

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
  seen boolean := false;
begin
  if uid is null then return; end if;
  select salt into s from private.visit_salts where day = today;
  if s is not null then
    who := encode(extensions.digest(s || convert_to(coalesce(ip, '') || '|' || coalesce(agent, ''), 'UTF8'), 'sha256'), 'hex');
    select e.source, e.path, true into src, page, seen
    from public.page_events e
    where e.visitor = who and e.name = 'view' and not e.automated
      and e.occurred_at >= (today::timestamp at time zone 'America/Vancouver')
    order by e.occurred_at
    limit 1;
  end if;
  insert into public.account_sources (user_id, invited, traced, source, landing)
  values (uid, coalesce(invited, false), coalesce(seen, false), src, page)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.record_account_source(text, text, boolean) from public;
revoke execute on function public.record_account_source(text, text, boolean) from anon;
grant execute on function public.record_account_source(text, text, boolean) to authenticated;

create or replace function public.account_sources_report(since timestamptz)
returns table (created_at timestamptz, invited boolean, traced boolean, source text, landing text, made_team boolean, ran_practice boolean)
language sql stable security definer set search_path = ''
as $$
  -- Noon (Vancouver) on the day the account was made: enough to count it in a period, not to match it to a visit.
  select ((u.created_at at time zone 'America/Vancouver')::date + time '12:00') at time zone 'America/Vancouver',
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
