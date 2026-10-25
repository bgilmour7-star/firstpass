-- Several teams per coach, the Team page's gear and focus, and the U11+ discovery answer (decision 0026).
-- Run in the Supabase SQL editor. Safe to run twice. No child-identifiable data: group names are
-- team-chosen labels ("Eagles"), counts only.

-- D1. A coach can be on several teams: join through a link without the one-team check.
-- Returns the team id, or raises link-off when the link was turned off or replaced.
create or replace function public.join_team(code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select t.id into target from public.teams t where code is not null and t.join_code = code;
  if target is null then raise exception 'link-off'; end if;
  if exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.team_id = target) then return target; end if;
  insert into public.team_members (team_id, user_id, role) values (target, auth.uid(), 'coach');
  return target;
end;
$$;

-- Create a team and become its head coach, whether or not the coach is already on a team.
create or replace function public.create_team(team_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.teams (name) values (team_name) returning id into new_id;
  insert into public.team_members (team_id, user_id, role) values (new_id, auth.uid(), 'head_coach');
  return new_id;
end;
$$;

-- A coach leaves a team. The head coach can't (the team would have nobody to run it): they delete it.
create or replace function public.leave_team(team uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.is_head_coach(team) then raise exception 'head-coach-leaves'; end if;
  delete from public.team_members m where m.team_id = team and m.user_id = auth.uid();
end;
$$;
revoke all on function public.leave_team(uuid) from public;
grant execute on function public.leave_team(uuid) to authenticated;
revoke all on function public.join_team(text) from public;
grant execute on function public.join_team(text) to authenticated;

-- The head coach deletes their team. Plans, ice times, check-ins, links and favourites go with it (on delete cascade).
drop policy if exists "head coach deletes the team" on public.teams;
create policy "head coach deletes the team" on public.teams for delete using (public.is_head_coach(id));

-- The newest membership is the default active team; the switcher lists them newest first.
create index if not exists team_members_user_newest on public.team_members (user_id, created_at desc);

-- D2. Group names live in the existing teams.groups jsonb: each entry may carry "name" (default: the
-- slot) and "off": true (a group the team doesn't use). No column change.
-- The Team page's gear bag (counts) and starting focus (up to two skills).
alter table public.teams add column if not exists gear jsonb not null default '{}';
alter table public.teams add column if not exists focus text[] not null default '{}';

-- "U11 or older" on Create a team: what the coach finds hardest, and whether Brett may call.
create table if not exists public.older_team_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  age_group text not null check (age_group in ('U11', 'U13', 'U15+')),
  hardest_part text not null default '' check (char_length(hardest_part) <= 1000),
  wants_call boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.older_team_interest enable row level security;
drop policy if exists "coaches add their own answer" on public.older_team_interest;
create policy "coaches add their own answer" on public.older_team_interest for insert with check (user_id = auth.uid());
drop policy if exists "coaches read their own answers, admins read all" on public.older_team_interest;
create policy "coaches read their own answers, admins read all" on public.older_team_interest for select using (user_id = auth.uid() or public.is_admin());
