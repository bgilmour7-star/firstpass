-- Team progress, part E: is it sticking? (decision 0030, spec → Admin → Analytics → Progress scoring)
-- Safe to run twice. Needs parts A to C.
--
-- Two small records the app didn't keep yet, and one read for analytics viewers:
--   progress_report_views     the first time each coach opened each month's report
--   progress_goal_suggestions each time a coach took a goal suggestion ("Keep as is" is already in
--                             practice_suggestions_kept, under keys starting "goal:")
--   progress_usage(month)     the rows behind the Progress scoring section: ids and counts, team names,
--                             never a coach's name and nothing about a kid

-- 1. Report views: one row per coach per round.
create table if not exists public.progress_report_views (
  round_id uuid not null references public.progress_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  first_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
alter table public.progress_report_views enable row level security;
drop policy if exists "analytics viewers read report views" on public.progress_report_views;
create policy "analytics viewers read report views" on public.progress_report_views for select using (public.can_see_analytics());

create or replace function public.record_report_view(r uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  -- Only a coach who can see this report (on the team, and finished this round).
  if not exists (
    select 1 from public.progress_rounds pr
    join public.team_members m on m.team_id = pr.team_id and m.user_id = auth.uid()
    join public.progress_scores s on s.round_id = pr.id and s.user_id = auth.uid() and s.finished_at is not null
    where pr.id = r
  ) then return; end if;
  insert into public.progress_report_views (round_id, user_id) values (r, auth.uid()) on conflict do nothing;
end;
$$;
revoke all on function public.record_report_view(uuid) from public, anon;
grant execute on function public.record_report_view(uuid) to authenticated;

-- 2. Goal suggestions a coach took (swapped in).
create table if not exists public.progress_goal_suggestions (
  practice_id uuid not null references public.practices (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  key text not null check (key ~ '^goal:[A-Za-z &]{1,20}:[a-z0-9-]{1,50}$'),
  user_id uuid references auth.users (id) on delete set null,
  taken_at timestamptz not null default now(),
  primary key (practice_id, key)
);
alter table public.progress_goal_suggestions enable row level security;
drop policy if exists "analytics viewers read goal suggestions" on public.progress_goal_suggestions;
create policy "analytics viewers read goal suggestions" on public.progress_goal_suggestions for select using (public.can_see_analytics());

create or replace function public.record_goal_suggestion(practice uuid, k text)
returns void language plpgsql security definer set search_path = ''
as $$
declare t uuid;
begin
  select p.team_id into t from public.practices p where p.id = practice;
  if t is null or not public.is_team_member(t) then return; end if;
  if k !~ '^goal:[A-Za-z &]{1,20}:[a-z0-9-]{1,50}$' then return; end if;
  insert into public.progress_goal_suggestions (practice_id, team_id, key, user_id) values (practice, t, k, auth.uid()) on conflict do nothing;
end;
$$;
revoke all on function public.record_goal_suggestion(uuid, text) from public, anon;
grant execute on function public.record_goal_suggestion(uuid, text) to authenticated;

-- 3. The rows behind Analytics → Progress scoring, for one month (YYYY-MM-01) and the one before.
create or replace function public.progress_usage(m date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare prev date := (m - interval '1 month')::date;
begin
  if not public.can_see_analytics() then raise exception 'not-allowed'; end if;
  return jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
        'lastPlanAt', (select max(greatest(p.updated_at, p.created_at)) from public.practices p where p.team_id = t.id)))
      from public.teams t where t.age_group = 'U7'), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('teamId', mm.team_id, 'userId', mm.user_id, 'role', mm.role, 'scores', mm.progress_scoring))
      from public.team_members mm join public.teams t on t.id = mm.team_id where t.age_group = 'U7'), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'teamId', r.team_id, 'month', r.month, 'skaters', r.skaters))
      from public.progress_rounds r where r.month in (m, prev)), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('roundId', s.round_id, 'teamId', s.team_id, 'userId', s.user_id,
        'finished', s.finished_at is not null, 'seconds', s.seconds, 'done', coalesce(array_length(s.done, 1), 0),
        'noChange', coalesce(array_length(s.no_change, 1), 0), 'answers', case when s.finished_at is not null then s.answers end))
      from public.progress_scores s join public.progress_rounds r on r.id = s.round_id where r.month in (m, prev)), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('teamId', g.team_id, 'attribute', g.attribute, 'target', g.target, 'byDate', g.by_date,
        'baselineRoundId', g.baseline_round_id, 'baselineScore', g.baseline_score, 'setAt', g.set_at))
      from public.progress_goals g where g.ended_at is null), '[]'::jsonb),
    'emailed', coalesce((
      select jsonb_agg(jsonb_build_object('roundId', e.round_id, 'userId', e.user_id))
      from public.progress_emails e join public.progress_rounds r on r.id = e.round_id where r.month = m and e.kind = 'scoring'), '[]'::jsonb),
    'views', coalesce((
      select jsonb_agg(jsonb_build_object('roundId', v.round_id, 'userId', v.user_id))
      from public.progress_report_views v join public.progress_rounds r on r.id = v.round_id where r.month = m), '[]'::jsonb),
    'taken', coalesce((
      select jsonb_agg(jsonb_build_object('teamId', x.team_id, 'key', x.key))
      from public.progress_goal_suggestions x where x.taken_at >= m and x.taken_at < (m + interval '1 month')), '[]'::jsonb),
    'kept', coalesce((
      select jsonb_agg(jsonb_build_object('teamId', k.team_id, 'key', k.key))
      from public.practice_suggestions_kept k where k.key like 'goal:%' and k.kept_at >= m and k.kept_at < (m + interval '1 month')), '[]'::jsonb),
    'months', coalesce((select jsonb_agg(distinct r.month order by r.month desc) from public.progress_rounds r), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.progress_usage(date) from public, anon;
grant execute on function public.progress_usage(date) to authenticated;
