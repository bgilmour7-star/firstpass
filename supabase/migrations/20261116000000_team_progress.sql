-- Team progress, part A: progress scoring and the report (decision 0030, docs/specs/team-progress.md).
-- Safe to run twice. Run the whole file in the Supabase SQL editor.
--
-- Once a month every coach scores the team: for each attribute, how many skaters are at each level
-- (counts only, never a kid). A round opens when the team's first planned practice of the month
-- ends, and closes when the next round opens. The report is computed from the scores in the app.

-- 1. One round per team per month.
create table if not exists public.progress_rounds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  month date not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  levels_version text not null,
  skaters smallint not null check (skaters >= 0),
  unique (team_id, month)
);
create index if not exists progress_rounds_team on public.progress_rounds (team_id, month desc);

-- 2. One row per coach per round. answers: {"Skating":[1,4,6,1,0], ...}, kids at levels 1..5.
create table if not exists public.progress_scores (
  round_id uuid not null references public.progress_rounds (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}',
  done text[] not null default '{}',
  no_change text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  seconds integer check (seconds is null or seconds >= 0),
  primary key (round_id, user_id)
);
create index if not exists progress_scores_team on public.progress_scores (team_id);

-- 3. Who scores (head coach sets) and who gets progress emails (each coach, used from part B).
alter table public.team_members add column if not exists progress_scoring boolean not null default true;
alter table public.team_members add column if not exists progress_emails boolean not null default true;

-- 4. Row-level security.
alter table public.progress_rounds enable row level security;
alter table public.progress_scores enable row level security;

drop policy if exists "members read rounds" on public.progress_rounds;
create policy "members read rounds" on public.progress_rounds for select using (public.is_team_member(team_id));

-- A coach reads their own scores always, and teammates' scores in a round only once they have
-- finished their own in that round (decision 0030, P2), so their answers stay their own.
create or replace function public.finished_progress(r uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.progress_scores where round_id = r and user_id = auth.uid() and finished_at is not null); $$;
revoke all on function public.finished_progress(uuid) from public, anon;
grant execute on function public.finished_progress(uuid) to authenticated;

drop policy if exists "read own scores, and the team's once finished" on public.progress_scores;
create policy "read own scores, and the team's once finished" on public.progress_scores for select
  using (user_id = auth.uid() or (public.is_team_member(team_id) and public.finished_progress(round_id)));
-- No insert, update or delete policies: writes go through save_progress_score only.

-- 5. Save a coach's scores (as they go, and when they finish).
create or replace function public.save_progress_score(r uuid, answers jsonb, done text[], no_change text[], secs integer, finish boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare rnd public.progress_rounds; k text; v jsonb; tot int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into rnd from public.progress_rounds where id = r;
  if rnd.id is null then raise exception 'no-round'; end if;
  if not exists (select 1 from public.team_members where team_id = rnd.team_id and user_id = auth.uid() and progress_scoring) then
    raise exception 'not-scoring';
  end if;
  if rnd.closed_at is not null then raise exception 'round-closed'; end if;
  if jsonb_typeof(answers) <> 'object' then raise exception 'bad-answers'; end if;
  for k, v in select * from jsonb_each(answers) loop
    if k not in ('Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun') then raise exception 'bad-attribute'; end if;
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 5 then raise exception 'bad-counts'; end if;
    -- Five whole numbers, none negative: no nulls, strings or fractions.
    if exists (select 1 from jsonb_array_elements(v) as e(x) where jsonb_typeof(e.x) <> 'number' or (e.x::text)::numeric < 0 or (e.x::text)::numeric <> trunc((e.x::text)::numeric)) then
      raise exception 'bad-counts';
    end if;
    select coalesce(sum((e.x::text)::int), 0) into tot from jsonb_array_elements(v) as e(x);
    if tot > rnd.skaters or tot = 0 then raise exception 'bad-counts'; end if;
  end loop;
  -- done and no_change only ever name the six skills (no free text, so no kids' names).
  if exists (select 1 from unnest(coalesce(done, '{}') || coalesce(no_change, '{}')) as u(a) where u.a not in ('Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun')) then
    raise exception 'bad-attribute';
  end if;
  insert into public.progress_scores as s (round_id, team_id, user_id, answers, done, no_change, seconds, finished_at)
  values (r, rnd.team_id, auth.uid(), answers, done, no_change, secs, case when finish then now() end)
  on conflict (round_id, user_id) do update set
    answers = excluded.answers,
    done = excluded.done,
    no_change = excluded.no_change,
    seconds = excluded.seconds,
    finished_at = coalesce(s.finished_at, excluded.finished_at);
end;
$$;
revoke all on function public.save_progress_score(uuid, jsonb, text[], text[], integer, boolean) from public, anon;
grant execute on function public.save_progress_score(uuid, jsonb, text[], text[], integer, boolean) to authenticated;

-- 6. Head coach: who on the team scores progress.
create or replace function public.set_progress_scoring(team uuid, coach uuid, wanted boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_head_coach(team) then raise exception 'not-head-coach'; end if;
  update public.team_members set progress_scoring = wanted where team_id = team and user_id = coach;
end;
$$;
revoke all on function public.set_progress_scoring(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_progress_scoring(uuid, uuid, boolean) to authenticated;

-- 6b. Who has scored so far, without anyone's answers: for "1 of 3 done" before you've finished.
create or replace function public.progress_round_status(r uuid)
returns table (user_id uuid, done integer, finished boolean) language sql stable security definer set search_path = ''
as $$
  select s.user_id, coalesce(array_length(s.done, 1), 0), s.finished_at is not null
  from public.progress_scores s
  where s.round_id = r and public.is_team_member(s.team_id);
$$;
revoke all on function public.progress_round_status(uuid) from public, anon;
grant execute on function public.progress_round_status(uuid) to authenticated;

-- 7. Open rounds: a team with a level set (U7 for now) gets this month's round once its first planned
-- practice of the month (at least one block) has ended, once it has skaters. Opening a round closes the team's previous one.
create or replace function public.open_progress_rounds()
returns integer language plpgsql security definer set search_path = ''
as $$
declare t record; opened int := 0; m date := date_trunc('month', (now() at time zone 'America/Vancouver'))::date;
begin
  for t in
    select tm.id, tm.groups
    from public.teams tm
    where tm.age_group = 'U7'
      and not exists (select 1 from public.progress_rounds pr where pr.team_id = tm.id and pr.month = m)
      and exists (
        select 1 from public.practices p
        where p.team_id = tm.id
          and p.date >= m
          and jsonb_array_length(p.blocks) > 0
          and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') <= now()
      )
      -- A team with no skaters yet waits: the round keeps the team size it opens with.
      and coalesce((select sum(case when coalesce((g ->> 'off')::boolean, false) then 0 else (g ->> 'skaters')::int end) from jsonb_array_elements(tm.groups) g), 0) > 0
  loop
    update public.progress_rounds set closed_at = now() where team_id = t.id and closed_at is null;
    insert into public.progress_rounds (team_id, month, levels_version, skaters)
    values (
      t.id, m, 'U7-2026-11-15',
      coalesce((select sum(case when coalesce((g ->> 'off')::boolean, false) then 0 else (g ->> 'skaters')::int end) from jsonb_array_elements(t.groups) g), 0)
    )
    on conflict (team_id, month) do nothing;
    opened := opened + 1;
  end loop;
  return opened;
end;
$$;
revoke all on function public.open_progress_rounds() from public, anon, authenticated;

-- 8. Check every 10 minutes.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'firstpass-progress-rounds';
select cron.schedule('firstpass-progress-rounds', '*/10 * * * *', 'select public.open_progress_rounds()');
