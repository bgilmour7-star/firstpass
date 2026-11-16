-- A goal for every skill (decision 0031, changes 0030 P4): U7 is about all-round development, so a head coach
-- can set one active goal on each of the six skills. Same function as 20261118000000_progress_goals.sql without
-- the three-goal limit; one active goal per skill stays (setting a skill's goal ends its old one). Safe to run twice.

-- Set (or change) the goal for one skill. Head coach only, a date ahead, and a target that fits the team: five
-- whole numbers adding up to no more than its skaters.
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
  update public.progress_goals g set ended_at = now() where g.team_id = team and g.attribute = attr and g.ended_at is null;
  insert into public.progress_goals (team_id, attribute, target, by_date, baseline_round_id, baseline_score, set_by)
  values (team, attr, target, by_date, base.id, start, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.set_progress_goal(uuid, text, smallint[], date) from public, anon;
grant execute on function public.set_progress_goal(uuid, text, smallint[], date) to authenticated;
