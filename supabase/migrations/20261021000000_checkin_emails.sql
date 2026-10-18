-- The check-in email, 30 minutes after practice (decision 0010). Safe to run twice.
-- Run the whole file in the Supabase SQL editor. It also starts a 10-minute timer (pg_cron)
-- that asks https://firstpass.coach to send any emails that are due.

-- 1. A private place for the timer's secret. Not reachable through the API.
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- 2. Each coach can turn the email off for themselves (Team page).
alter table public.team_members add column if not exists checkin_emails boolean not null default true;

create or replace function public.set_checkin_emails(team uuid, wanted boolean)
returns void language sql security definer set search_path = ''
as $$ update public.team_members set checkin_emails = wanted where team_id = team and user_id = auth.uid(); $$;
grant execute on function public.set_checkin_emails(uuid, boolean) to authenticated;

-- 3. One row per email sent, so no coach gets two for the same practice.
create table if not exists public.checkin_emails (
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);
alter table public.checkin_emails enable row level security;
drop policy if exists "coaches see their own check-in emails" on public.checkin_emails;
create policy "coaches see their own check-in emails" on public.checkin_emails for select using (user_id = auth.uid());

-- 4. The emails that are due, claimed in one step so two timer runs can't both send.
-- Due: a planned practice whose ice time ended 30+ minutes ago (but less than 6 hours ago, so
-- turning this on never emails about old practices), to each coach on the team who wants the
-- email, hasn't checked in and hasn't been emailed about it. Times are Vancouver time, like the app.
create or replace function public.claim_checkin_emails(secret text)
returns table (practice_id uuid, user_id uuid, email text, team_name text, practice_date date, start_time time, next_date date, checked_in text[])
language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query
  with due as (
    select p.id as practice_id, m.user_id, u.email::text as email, t.name as team_name, p.team_id, p.date as practice_date, p.start_time
    from public.practices p
    join public.teams t on t.id = p.team_id
    join public.team_members m on m.team_id = p.team_id
    join auth.users u on u.id = m.user_id
    where m.checkin_emails
      and u.email is not null
      and jsonb_array_length(p.blocks) > 0
      and ((p.date + p.start_time + make_interval(mins => p.minutes + 30)) at time zone 'America/Vancouver') <= now()
      and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') > now() - interval '6 hours'
      and not exists (select 1 from public.practice_checkins c where c.practice_id = p.id and c.user_id = m.user_id)
      and not exists (select 1 from public.checkin_emails e where e.practice_id = p.id and e.user_id = m.user_id)
    limit 50
  ), claimed as (
    insert into public.checkin_emails (practice_id, user_id)
    select d.practice_id, d.user_id from due d
    on conflict do nothing
    returning checkin_emails.practice_id, checkin_emails.user_id
  )
  select d.practice_id, d.user_id, d.email, d.team_name, d.practice_date, d.start_time,
    (select min(n.date) from (
       select p2.date from public.practices p2 where p2.team_id = d.team_id and p2.date > d.practice_date
       union all
       select i.date from public.ice_times i where i.team_id = d.team_id and i.kind = 'practice' and not i.cancelled and not i.ignored and i.date > d.practice_date
     ) n) as next_date,
    coalesce((select array_agg(c.editor order by c.saved_at) from public.practice_checkins c where c.practice_id = d.practice_id), '{}') as checked_in
  from due d
  join claimed c on c.practice_id = d.practice_id and c.user_id = d.user_id;
end;
$$;

-- If sending fails, the app hands the email back so the next run tries again.
create or replace function public.release_checkin_email(secret text, practice uuid, coach uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  delete from public.checkin_emails e where e.practice_id = practice and e.user_id = coach;
end;
$$;

revoke all on function public.claim_checkin_emails(text) from public;
revoke all on function public.release_checkin_email(text, uuid, uuid) from public;
grant execute on function public.claim_checkin_emails(text) to anon, authenticated;
grant execute on function public.release_checkin_email(text, uuid, uuid) to anon, authenticated;

-- 5. The timer: every 10 minutes, ask the app to send what's due.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'firstpass-checkin-emails';
select cron.schedule(
  'firstpass-checkin-emails',
  '*/10 * * * *',
  format(
    $job$select net.http_post(url := %L, headers := jsonb_build_object('authorization', %L, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 20000)$job$,
    'https://firstpass.coach/api/cron/checkin-emails',
    'Bearer ' || (select value from private.settings where key = 'cron_secret')
  )
);
