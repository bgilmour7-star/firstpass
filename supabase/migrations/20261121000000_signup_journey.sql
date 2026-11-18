-- The sign-up journey (decision 0034): everyone who creates an account, invited coaches included, gets Brett's
-- welcome with the survey right away and a nudge on day 3 if they haven't answered. It replaces the waitlist series
-- that open sign-up retired (decision 0033). Run the whole file in the Supabase SQL editor. Safe to run twice.
--
-- Only accounts made after this file first runs are emailed: the start time is saved once in private.settings and
-- never moved, so running the file again doesn't email anyone new. The survey is the "before Firstpass" version
-- (how you plan today), stored with audience 'waitlist' as before so no check constraints change.
-- The first-practice email (coach journey) now waits until a person's sign-up emails are done, so nobody gets two
-- survey asks in the same few days. Everything else in enqueue_discovery_emails is unchanged from
-- 20261029000000_discovery.sql.

create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value) values ('signup_journey_from', now()::text) on conflict (key) do nothing;

create or replace function public.enqueue_discovery_emails(secret text)
returns int language plpgsql security definer set search_path = ''
as $$
declare added int := 0; n int;
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;

  -- Sign-up: welcome right away, once the email is confirmed, for accounts made since the journey started.
  insert into public.email_sends (journey, step, person_id, due_at)
  select 'signup', 'welcome', r.id, now()
  from public.research_people r join auth.users u on u.id = r.user_id
  where u.email_confirmed_at is not null and u.deleted_at is null
    and u.created_at >= (select s.value::timestamptz from private.settings s where s.key = 'signup_journey_from')
    and r.unsubscribed_at is null
    and not exists (select 1 from public.admins a where a.user_id = r.user_id)
    and not exists (select 1 from public.survey_responses s where s.person_id = r.id)
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  insert into public.survey_invites (person_id, audience)
  select e.person_id, 'waitlist' from public.email_sends e where e.journey = 'signup'
  on conflict (person_id, audience) do nothing;

  -- Sign-up nudge: 3 days after the welcome went out (the app skips it if they've answered by then).
  insert into public.email_sends (journey, step, person_id, due_at)
  select 'signup', 'nudge', e.person_id, e.sent_at + interval '3 days'
  from public.email_sends e
  where e.journey = 'signup' and e.step = 'welcome' and e.sent_at is not null
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  -- First practice: 2 days after it ends. Someone in the sign-up journey waits until it's done (the welcome was
  -- skipped, or the nudge went out or was skipped), and then at least 4 days after the nudge.
  insert into public.email_sends (journey, step, person_id, due_at)
  select 'coach', 'first-practice', r.id, greatest(f.ended + interval '2 days', coalesce(sj.nudge_sent + interval '4 days', f.ended + interval '2 days'))
  from public.research_people r
  join lateral (
    select min((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') as ended
    from public.team_members m join public.practices p on p.team_id = m.team_id
    where m.user_id = r.user_id
      and jsonb_array_length(p.blocks) > 0
      and ((p.date + p.start_time) at time zone 'America/Vancouver') >= m.created_at
      and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') <= now()
  ) f on f.ended is not null
  left join lateral (
    select true as started, w.skipped_reason as welcome_skipped, nd.sent_at as nudge_sent, nd.skipped_reason as nudge_skipped
    from public.email_sends w
    left join public.email_sends nd on nd.person_id = w.person_id and nd.journey = 'signup' and nd.step = 'nudge'
    where w.person_id = r.id and w.journey = 'signup' and w.step = 'welcome'
  ) sj on true
  where r.user_id is not null and r.unsubscribed_at is null
    and not exists (select 1 from public.admins a where a.user_id = r.user_id)
    and not exists (select 1 from public.survey_responses s where s.person_id = r.id)
    and (sj.started is null or sj.welcome_skipped is not null or sj.nudge_sent is not null or sj.nudge_skipped is not null)
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  insert into public.survey_invites (person_id, audience)
  select e.person_id, 'coach' from public.email_sends e where e.journey = 'coach'
  on conflict (person_id, audience) do nothing;

  insert into public.email_sends (journey, step, person_id, due_at)
  select 'coach', 'nudge', e.person_id, e.sent_at + interval '3 days'
  from public.email_sends e
  where e.journey = 'coach' and e.step = 'first-practice' and e.sent_at is not null
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  return added;
end;
$$;

revoke all on function public.enqueue_discovery_emails(text) from public;
grant execute on function public.enqueue_discovery_emails(text) to anon, authenticated;

-- Admin → Analytics: new accounts per day (decision 0034), alongside teams created and coaches joined. Same
-- function as 20261030000000_analytics_growth.sql plus 'account' rows: when each confirmed account was made.
-- Timestamps only, and only to analytics viewers.
create or replace function public.analytics_growth()
returns table (kind text, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select 'team'::text, t.created_at from public.teams t where public.can_see_analytics()
  union all
  select 'coach'::text, min(m.created_at) from public.team_members m where public.can_see_analytics() group by m.user_id
  union all
  select 'account'::text, u.created_at from auth.users u
  where public.can_see_analytics() and u.email_confirmed_at is not null and u.deleted_at is null
    and not exists (select 1 from public.admins a where a.user_id = u.id);
$$;

revoke all on function public.analytics_growth() from public;
-- Supabase grants new functions to anon directly, so revoking from public isn't enough.
revoke execute on function public.analytics_growth() from anon;
grant execute on function public.analytics_growth() to authenticated;
