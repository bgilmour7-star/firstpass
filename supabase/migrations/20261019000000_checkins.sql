-- After-practice check-ins (decision 0007): one row per coach per practice.
-- Ratings are a small JSON list of the drills that stood out; every other drill counts as OK.
-- Coaches and groups only, never kids. Safe to run twice.

create table if not exists public.practice_checkins (
  practice_id uuid not null references public.practices (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- How the coach is shown ("Kara"), captured when they check in.
  editor text not null check (char_length(editor) between 1 and 60),
  overall text check (overall in ('rough', 'ok', 'great')),
  steam text check (steam in ('no', 'bored', 'tired')),
  steam_from text,
  ready text[] not null default '{}',
  note text not null default '' check (char_length(note) <= 500),
  -- [{ "key": "<block id>[:zone]", "drillId": "...", "rating": "hit" | "flop", "reasons": [...] }]
  marks jsonb not null default '[]',
  saved_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);
create index if not exists practice_checkins_team on public.practice_checkins (team_id);

alter table public.practice_checkins enable row level security;

drop policy if exists "members read their team's check-ins" on public.practice_checkins;
create policy "members read their team's check-ins" on public.practice_checkins for select using (public.is_team_member(team_id));
drop policy if exists "coaches write their own check-in" on public.practice_checkins;
create policy "coaches write their own check-in" on public.practice_checkins for insert with check (public.is_team_member(team_id) and user_id = auth.uid());
drop policy if exists "coaches update their own check-in" on public.practice_checkins;
create policy "coaches update their own check-in" on public.practice_checkins for update using (user_id = auth.uid()) with check (public.is_team_member(team_id) and user_id = auth.uid());
