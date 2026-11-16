-- Team progress, part C: season goals (decision 0030, P4). Safe to run twice. Needs part A.
--
-- A goal is a target spread for one skill (kids at levels 1..5) and a date. The head coach sets up
-- to 3 at a time, after the team's first finished report. Changing a goal ends the old row and adds
-- a new one, so the history stays. Scores, pace and status are worked out in the app, never stored.

create table if not exists public.progress_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  attribute text not null check (attribute in ('Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun')),
  target smallint[] not null check (array_length(target, 1) = 5),
  by_date date not null,
  baseline_round_id uuid not null references public.progress_rounds (id) on delete cascade,
  -- The team's score for this skill in the baseline report, kept with the goal so every coach sees
  -- the same starting point (a coach who didn't score that month can't read its answers).
  baseline_score numeric(3, 1) not null,
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists progress_goals_one_active on public.progress_goals (team_id, attribute) where ended_at is null;
create index if not exists progress_goals_team on public.progress_goals (team_id);

alter table public.progress_goals enable row level security;
drop policy if exists "members read goals" on public.progress_goals;
create policy "members read goals" on public.progress_goals for select using (public.is_team_member(team_id));
-- No insert, update or delete policies: writes go through the two functions below.

-- Set (or change) the goal for one skill. Head coach only, at most 3 active goals, a date ahead,
-- and a target that fits the team: five whole numbers adding up to no more than its skaters.
create or replace function public.set_progress_goal(team uuid, attr text, target smallint[], by_date date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare base public.progress_rounds; tot int; new_id uuid; start numeric;
begin
  if not public.is_head_coach(team) then raise exception 'not-head-coach'; end if;
  if attr not in ('Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun') then raise exception 'bad-attribute'; end if;
  if target is null or array_length(target, 1) <> 5 or exists (select 1 from unnest(target) t(n) where t.n is null or t.n < 0) then raise exception 'bad-target'; end if;
  if by_date is null or by_date <= (now() at time zone 'America/Vancouver')::date then raise exception 'bad-date'; end if;
  -- The baseline: the newest round the head coach has finished themselves, so the goal starts from the
  -- report they're looking at and never from a month whose answers they can't see yet (P2).
  select r.* into base from public.progress_rounds r
  where r.team_id = team and exists (select 1 from public.progress_scores s where s.round_id = r.id and s.user_id = auth.uid() and s.finished_at is not null)
  order by r.month desc limit 1;
  if base.id is null then raise exception 'no-report'; end if;
  -- Same maths as the report: every finished coach's skaters averaged together, one decimal.
  select round(sum(e.ord * e.n)::numeric / nullif(sum(e.n), 0), 1) into start
  from public.progress_scores s,
    lateral (select (x.v)::int as n, x.ord from jsonb_array_elements_text(s.answers -> attr) with ordinality as x(v, ord)) e
  where s.round_id = base.id and s.finished_at is not null and jsonb_typeof(s.answers -> attr) = 'array';
  if start is null then raise exception 'no-report'; end if;
  select sum(t.n) into tot from unnest(target) t(n);
  if tot = 0 or tot > base.skaters then raise exception 'bad-target'; end if;
  if (select count(*) from public.progress_goals g where g.team_id = team and g.ended_at is null and g.attribute <> attr) >= 3 then
    raise exception 'too-many-goals';
  end if;
  update public.progress_goals g set ended_at = now() where g.team_id = team and g.attribute = attr and g.ended_at is null;
  insert into public.progress_goals (team_id, attribute, target, by_date, baseline_round_id, baseline_score, set_by)
  values (team, attr, target, by_date, base.id, start, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.set_progress_goal(uuid, text, smallint[], date) from public, anon;
grant execute on function public.set_progress_goal(uuid, text, smallint[], date) to authenticated;

-- Remove a goal (kept as history). Head coach only.
create or replace function public.end_progress_goal(goal uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare t uuid;
begin
  select g.team_id into t from public.progress_goals g where g.id = goal and g.ended_at is null;
  if t is null then return; end if;
  if not public.is_head_coach(t) then raise exception 'not-head-coach'; end if;
  update public.progress_goals set ended_at = now() where id = goal;
end;
$$;
revoke all on function public.end_progress_goal(uuid) from public, anon;
grant execute on function public.end_progress_goal(uuid) to authenticated;
