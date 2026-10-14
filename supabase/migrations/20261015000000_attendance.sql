-- Who's here today: per-practice group counts and merges (decision 0004). Counts and group names only,
-- never players. Null means the team's usual groups. Run in the Supabase SQL editor.

alter table public.practices add column if not exists attendance jsonb;

-- Parent links also need today's groups, so the times match what happens on the ice
-- (a rotation runs one station per group).
create or replace function public.shared_practice(link text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'team', t.name,
    'groups', t.groups,
    'practice', jsonb_build_object('date', p.date, 'start_time', p.start_time, 'minutes', p.minutes, 'ice', p.ice, 'blocks', p.blocks, 'attendance', p.attendance),
    'drills', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'content', d.content))
      from public.drills d
      where d.status = 'live'
        and (p.blocks::text like '%"' || d.id || '"%')
    ), '[]'::jsonb)
  )
  from public.practice_shares s
  join public.practices p on p.id = s.practice_id
  join public.teams t on t.id = s.team_id
  where s.token = link and s.revoked_at is null and s.expires_at > now();
$$;

revoke all on function public.shared_practice(text) from public;
grant execute on function public.shared_practice(text) to anon, authenticated;
