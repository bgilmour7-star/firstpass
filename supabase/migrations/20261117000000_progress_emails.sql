-- Team progress, part B: the three monthly progress emails (decision 0030, spec → Emails).
-- Safe to run twice. Run the whole file in the Supabase SQL editor. Needs part A
-- (20261116000000_team_progress.sql) and the check-in emails (20261021000000_checkin_emails.sql),
-- whose 10-minute timer also sends these.
--
-- Times are Vancouver, counted from the day the round opened (day 0):
--   scoring   day 1, 9:00   every coach who scores and hasn't finished
--   reminder  day 3, 18:00  same, once; or straight away when the head coach taps "Send a reminder"
--   report    day 4, 9:00   only coaches who had finished by then
-- Every one needs the coach's progress emails on. Nothing goes for a closed round or one more than
-- 20 days old, so turning this on mid-season doesn't send old news.

-- 1. One row per email sent, so no coach gets the same one twice in a round.
create table if not exists public.progress_emails (
  round_id uuid not null references public.progress_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scoring', 'reminder', 'report')),
  sent_at timestamptz not null default now(),
  primary key (round_id, user_id, kind)
);
alter table public.progress_emails enable row level security;
drop policy if exists "coaches see their own progress emails" on public.progress_emails;
create policy "coaches see their own progress emails" on public.progress_emails for select using (user_id = auth.uid());
-- No insert, update or delete policies: only the claim and release functions write here.

-- 2. When the head coach asked for a reminder to go now, and who asked (they don't get it themselves).
alter table public.progress_rounds add column if not exists remind_at timestamptz;
alter table public.progress_rounds add column if not exists remind_by uuid references auth.users (id) on delete set null;

-- 3. Each coach turns their own progress emails on or off (the column came with part A).
create or replace function public.set_progress_emails(team uuid, wanted boolean)
returns void language sql security definer set search_path = ''
as $$ update public.team_members set progress_emails = wanted where team_id = team and user_id = auth.uid(); $$;
revoke all on function public.set_progress_emails(uuid, boolean) from public, anon;
grant execute on function public.set_progress_emails(uuid, boolean) to authenticated;

-- 4. Head coach: send the reminder now to coaches who haven't finished (still once per coach).
create or replace function public.send_progress_reminder(r uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare t uuid;
begin
  select team_id into t from public.progress_rounds where id = r and closed_at is null;
  if t is null then raise exception 'round-closed'; end if;
  if not public.is_head_coach(t) then raise exception 'not-head-coach'; end if;
  -- The reminder follows the scoring email, never comes before it.
  if not exists (select 1 from public.progress_emails e where e.round_id = r and e.kind = 'scoring') then raise exception 'too-early'; end if;
  update public.progress_rounds set remind_at = now(), remind_by = auth.uid() where id = r and remind_at is null;
end;
$$;
revoke all on function public.send_progress_reminder(uuid) from public, anon;
grant execute on function public.send_progress_reminder(uuid) to authenticated;

-- 5. Claim what's due (called by the cron route with the timer's secret).
create or replace function public.claim_progress_emails(secret text)
returns table (kind text, round_id uuid, team_id uuid, month date, user_id uuid, email text, first_name text, team_name text, skaters smallint)
language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query
  with rounds as (
    select r.*, ((r.opened_at at time zone 'America/Vancouver')::date) as day0
    from public.progress_rounds r
    where r.closed_at is null and r.opened_at > now() - interval '20 days'
  ), people as (
    select r.id as round_id, r.team_id, r.month, r.skaters, r.day0, r.remind_at, r.remind_by, m.user_id, m.progress_scoring,
      u.email::text as email,
      coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), initcap(split_part(u.email, '@', 1))) as first_name,
      t.name as team_name,
      s.finished_at
    from rounds r
    join public.teams t on t.id = r.team_id
    join public.team_members m on m.team_id = r.team_id
    join auth.users u on u.id = m.user_id
    left join public.progress_scores s on s.round_id = r.id and s.user_id = m.user_id
    where m.progress_emails and u.email is not null
  ), due as (
    select 'scoring'::text as kind, p.* from people p
    where p.progress_scoring and p.finished_at is null
      and ((p.day0 + 1) + time '09:00') at time zone 'America/Vancouver' <= now()
    union all
    select 'reminder', p.* from people p
    where p.progress_scoring and p.finished_at is null
      and ((p.remind_at is not null and p.user_id is distinct from p.remind_by) or ((p.day0 + 3) + time '18:00') at time zone 'America/Vancouver' <= now())
    union all
    select 'report', p.* from people p
    where p.finished_at is not null
      and ((p.day0 + 4) + time '09:00') at time zone 'America/Vancouver' <= now()
      and p.finished_at <= ((p.day0 + 4) + time '09:00') at time zone 'America/Vancouver'
  ), fresh as (
    select d.* from due d
    where not exists (select 1 from public.progress_emails e where e.round_id = d.round_id and e.user_id = d.user_id and e.kind = d.kind)
      -- A reminder never goes out the same run as the coach's first scoring email.
      and (d.kind <> 'reminder' or exists (select 1 from public.progress_emails e where e.round_id = d.round_id and e.user_id = d.user_id and e.kind = 'scoring' and e.sent_at < now() - interval '1 hour'))
    limit 50
  ), claimed as (
    insert into public.progress_emails (round_id, user_id, kind)
    select f.round_id, f.user_id, f.kind from fresh f
    on conflict do nothing
    returning progress_emails.round_id, progress_emails.user_id, progress_emails.kind
  )
  select f.kind, f.round_id, f.team_id, f.month, f.user_id, f.email, f.first_name, f.team_name, f.skaters
  from fresh f
  join claimed c on c.round_id = f.round_id and c.user_id = f.user_id and c.kind = f.kind;
end;
$$;

-- 6. Hand a failed send back, so the next run tries again.
create or replace function public.release_progress_email(secret text, r uuid, coach uuid, k text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  delete from public.progress_emails where round_id = r and user_id = coach and kind = k;
end;
$$;

-- 7. What an email needs about a round: each coach on the team, whether they score and get these
-- emails, whether they've finished, and the
-- finished coaches' answers in this round and the one before (for the report and its change).
-- Counts only; first names of coaches, never anything about a kid.
-- Dropped first: its columns grew after review, and Postgres won't change a function's columns in place.
drop function if exists public.progress_email_scores(text, uuid);
create or replace function public.progress_email_scores(secret text, r uuid)
returns table (round_id uuid, month date, skaters smallint, user_id uuid, first_name text, scores boolean, emails boolean, finished boolean, answers jsonb)
language plpgsql security definer set search_path = ''
as $$
declare rnd public.progress_rounds; prev public.progress_rounds;
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  select * into rnd from public.progress_rounds pr where pr.id = r;
  select * into prev from public.progress_rounds pr where pr.team_id = rnd.team_id and pr.month < rnd.month order by pr.month desc limit 1;
  return query
  select x.id, x.month, x.skaters, m.user_id,
    coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), initcap(split_part(u.email, '@', 1))),
    m.progress_scoring,
    m.progress_emails,
    s.finished_at is not null,
    case when s.finished_at is not null then s.answers end
  from public.progress_rounds x
  join public.team_members m on m.team_id = x.team_id
  join auth.users u on u.id = m.user_id
  left join public.progress_scores s on s.round_id = x.id and s.user_id = m.user_id
  where x.id = rnd.id or x.id = prev.id;
end;
$$;

revoke all on function public.claim_progress_emails(text) from public;
revoke all on function public.release_progress_email(text, uuid, uuid, text) from public;
revoke all on function public.progress_email_scores(text, uuid) from public;
-- The cron route calls these with the anon key; the secret check inside each is the gate.
grant execute on function public.claim_progress_emails(text) to anon, authenticated;
grant execute on function public.release_progress_email(text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.progress_email_scores(text, uuid) to anon, authenticated;
