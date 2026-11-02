-- Admin → Analytics: teams created and coaches joined, with running totals.
-- Teams and team_members are readable only by their own team (RLS), so the page reads them
-- through this function, which returns timestamps only (no names, emails or team ids) and only
-- to analytics viewers. A coach counts once, from the first team they joined. Safe to run twice.

create or replace function public.analytics_growth()
returns table (kind text, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select 'team'::text, t.created_at from public.teams t where public.can_see_analytics()
  union all
  select 'coach'::text, min(m.created_at) from public.team_members m where public.can_see_analytics() group by m.user_id;
$$;

revoke all on function public.analytics_growth() from public;
-- Supabase grants new functions to anon directly, so revoking from public isn't enough.
revoke execute on function public.analytics_growth() from anon;
grant execute on function public.analytics_growth() to authenticated;
