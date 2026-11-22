-- Activation and retention (decision 0053), after review: count coaches' activity only. Admins (Brett and the
-- head coach) use the teams they're on, so their opens, plan changes and check-ins no longer make a team
-- active or set its first check-in. And a coach's app opens count for a team only from when they joined it.
-- Same function, so safe to run twice.

create or replace function public.team_weeks()
returns table (created_at timestamptz, age_group text, first_checkin_at timestamptz, weeks jsonb)
language sql stable security definer set search_path = ''
as $$
  with acts as (
    select c.team_id, c.saved_at as at, true as checkin from public.practice_checkins c
    where not exists (select 1 from public.admins a where a.user_id = c.user_id)
    union all
    select e.team_id, e.at, false from public.practice_edits e
    where e.team_id is not null and (e.user_id is null or not exists (select 1 from public.admins a where a.user_id = e.user_id))
    union all
    select m.team_id, o.first_at, false from public.app_opens o join public.team_members m on m.user_id = o.user_id and o.first_at >= m.created_at
    where not exists (select 1 from public.admins a where a.user_id = o.user_id)
  ),
  wk as (
    select team_id, date_trunc('week', at at time zone 'America/Vancouver')::date as week, bool_or(checkin) as checked_in
    from acts group by 1, 2
  )
  select t.created_at,
         t.age_group,
         (select min(a.at) from acts a where a.team_id = t.id and a.checkin),
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
