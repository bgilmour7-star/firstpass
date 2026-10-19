-- Team favourite drills (decision 0012). Safe to run twice.
-- Any coach on the team can star a drill for the whole team; anyone on the team can unstar it.
-- We keep who starred it and when, shown as "Starred by Kara · Oct 18".

create table if not exists public.team_favorites (
  team_id uuid not null references public.teams (id) on delete cascade,
  drill_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  editor text not null default '' check (char_length(editor) <= 60),
  created_at timestamptz not null default now(),
  primary key (team_id, drill_id)
);

alter table public.team_favorites enable row level security;

drop policy if exists "members read their team's favourites" on public.team_favorites;
create policy "members read their team's favourites" on public.team_favorites for select using (public.is_team_member(team_id));
drop policy if exists "members star drills for their team" on public.team_favorites;
create policy "members star drills for their team" on public.team_favorites for insert with check (public.is_team_member(team_id) and user_id = auth.uid());
drop policy if exists "members unstar their team's drills" on public.team_favorites;
create policy "members unstar their team's drills" on public.team_favorites for delete using (public.is_team_member(team_id));
