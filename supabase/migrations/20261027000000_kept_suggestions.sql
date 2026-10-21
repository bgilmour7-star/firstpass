-- Suggestions from the check-in (decision 0022): when a coach taps "Keep as is", the suggestion is
-- hidden for every coach on the team, with who kept it. Coaches and drills only, never kids.
-- Safe to run twice.

create table if not exists public.practice_suggestions_kept (
  practice_id uuid not null references public.practices (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  -- Which suggestion: "flop:<drill id>", "steam:<drill id>" or "ready".
  key text not null check (char_length(key) between 1 and 80),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- How the coach is shown ("Kara"), captured when they keep it.
  editor text not null check (char_length(editor) between 1 and 60),
  kept_at timestamptz not null default now(),
  primary key (practice_id, key)
);
create index if not exists practice_suggestions_kept_team on public.practice_suggestions_kept (team_id);

alter table public.practice_suggestions_kept enable row level security;

drop policy if exists "members read their team's kept suggestions" on public.practice_suggestions_kept;
create policy "members read their team's kept suggestions" on public.practice_suggestions_kept for select using (public.is_team_member(team_id));
drop policy if exists "coaches keep suggestions as themselves" on public.practice_suggestions_kept;
create policy "coaches keep suggestions as themselves" on public.practice_suggestions_kept for insert with check (public.is_team_member(team_id) and user_id = auth.uid());
