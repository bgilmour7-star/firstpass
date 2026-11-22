-- Admin → Analytics → Activation and retention (decision 0053): one row per team, all time, with when it was
-- made, its age group, its first check-in, and each Vancouver week (starting Monday) it was active. Active means
-- a coach on the team opened the app, changed a plan or checked in; checked_in marks weeks with a check-in.
-- No ids, names or coaches: a team is a row. Analytics viewers only; teams with only admins are left out.
-- Read-only and safe to run twice.

create or replace function public.team_weeks()
returns table (created_at timestamptz, age_group text, first_checkin_at timestamptz, weeks jsonb)
language sql stable security definer set search_path = ''
as $$
  with acts as (
    select c.team_id, c.saved_at as at, true as checkin from public.practice_checkins c
    union all
    select e.team_id, e.at, false from public.practice_edits e where e.team_id is not null
    union all
    select m.team_id, o.first_at, false from public.app_opens o join public.team_members m on m.user_id = o.user_id
  ),
  wk as (
    select team_id, date_trunc('week', at at time zone 'America/Vancouver')::date as week, bool_or(checkin) as checked_in
    from acts group by 1, 2
  )
  select t.created_at,
         t.age_group,
         (select min(c.saved_at) from public.practice_checkins c where c.team_id = t.id),
         coalesce((select jsonb_agg(jsonb_build_object('week', w.week, 'checkedIn', w.checked_in) order by w.week) from wk w where w.team_id = t.id), '[]'::jsonb)
  from public.teams t
  where public.can_see_analytics()
    and exists (select 1 from public.team_members m where m.team_id = t.id
                and not exists (select 1 from public.admins a where a.user_id = m.user_id))
  order by t.created_at;
$$;

revoke all on function public.team_weeks() from public;
revoke execute on function public.team_weeks() from anon;
grant execute on function public.team_weeks() to authenticated;
