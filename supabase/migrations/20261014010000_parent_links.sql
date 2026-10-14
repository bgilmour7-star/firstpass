-- Parent links: a practice shared by an unguessable link, no sign-in, team-level only.
-- Run in the Supabase SQL editor after the teams and practices migration.

create table public.practice_shares (
  token text primary key check (char_length(token) >= 32),
  practice_id uuid not null references public.practices (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz
);
create index practice_shares_practice on public.practice_shares (practice_id);

alter table public.practice_shares enable row level security;
create policy "members manage their links" on public.practice_shares for all
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- What a parent sees through a link: the team name, the practice, and the live drills it uses.
-- Nothing else, and nothing once the link is revoked or expired.
create or replace function public.shared_practice(link text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'team', t.name,
    'practice', jsonb_build_object('date', p.date, 'start_time', p.start_time, 'minutes', p.minutes, 'ice', p.ice, 'blocks', p.blocks),
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
