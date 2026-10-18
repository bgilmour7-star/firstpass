-- Who has worked on each practice, and when each coach last looked at it.
-- Shown on the Plans list: "Kara added 2 drills · 1h ago", coaches' initials, and a dot
-- when someone else changed a plan since you last opened it. Coaches only, never kids.
-- Safe to run twice.

create table if not exists public.practice_edits (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  -- How the coach is shown ("Kara"), captured when they edit.
  editor text not null check (char_length(editor) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 120),
  -- The plan as it was when this editing session started, so the summary covers the whole session.
  base jsonb,
  at timestamptz not null default now()
);
create index if not exists practice_edits_practice_at on public.practice_edits (practice_id, at desc);
create index if not exists practice_edits_team on public.practice_edits (team_id);

create table if not exists public.practice_views (
  practice_id uuid not null references public.practices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (practice_id, user_id)
);

alter table public.practice_edits enable row level security;
alter table public.practice_views enable row level security;

drop policy if exists "members read their team's edits" on public.practice_edits;
create policy "members read their team's edits" on public.practice_edits for select using (public.is_team_member(team_id));
drop policy if exists "members log their own edits" on public.practice_edits;
create policy "members log their own edits" on public.practice_edits for insert with check (public.is_team_member(team_id) and user_id = auth.uid());
drop policy if exists "members update their own edits" on public.practice_edits;
create policy "members update their own edits" on public.practice_edits for update using (user_id = auth.uid()) with check (public.is_team_member(team_id) and user_id = auth.uid());

drop policy if exists "coaches manage their own views" on public.practice_views;
create policy "coaches manage their own views" on public.practice_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());
