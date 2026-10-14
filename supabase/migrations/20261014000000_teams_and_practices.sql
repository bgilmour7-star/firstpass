-- Teams, coaches and practice plans. Run in the Supabase SQL editor after the drill review migration.
-- No child-identifiable data: a team has skater and group COUNTS only.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  age_group text not null default 'U7',
  -- Group sizes, e.g. [{"group":"Eagles","skaters":5},{"group":"Bears","skaters":4},{"group":"Sharks","skaters":3}]
  groups jsonb not null default '[{"group":"Eagles","skaters":4},{"group":"Bears","skaters":4},{"group":"Sharks","skaters":4}]',
  coaches_on_ice int not null default 3 check (coaches_on_ice between 1 and 10),
  practice_minutes int not null default 60 check (practice_minutes between 20 and 120),
  ice text not null default 'half' check (ice in ('half', 'full', 'varies')),
  new_drills_per_week int not null default 2 check (new_drills_per_week between 0 and 10),
  -- Billing is stubbed until a second team (Technical Design → Scope).
  plan text not null default 'pilot',
  price_cents int not null default 0,
  currency text not null default 'CAD',
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'coach' check (role in ('head_coach', 'coach')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- One practice plan. Its blocks (warm-up, drills, stations, water, games) are an ordered
-- JSON document validated by the app (src/lib/plans/schema.ts); see docs/decisions/0003.
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  date date not null,
  start_time time not null default '17:45',
  minutes int not null default 60 check (minutes between 20 and 120),
  ice text not null default 'half' check (ice in ('half', 'full')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'done')),
  blocks jsonb not null default '[]',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index practices_team_date on public.practices (team_id, date);

create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid()); $$;

create or replace function public.is_head_coach(t uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid() and role = 'head_coach'); $$;

-- Create a team and become its head coach in one step (the only way a team is created).
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

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.practices enable row level security;

create policy "members read their team" on public.teams for select using (public.is_team_member(id));
create policy "head coach edits the team" on public.teams for update using (public.is_head_coach(id)) with check (public.is_head_coach(id));

create policy "members see their teammates" on public.team_members for select using (public.is_team_member(team_id));
create policy "head coach manages members" on public.team_members for all using (public.is_head_coach(team_id)) with check (public.is_head_coach(team_id));

create policy "members manage their practices" on public.practices for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- Coaches read live drills; admins keep full access through the earlier policy.
create policy "coaches read live drills" on public.drills for select using (
  status = 'live' and exists (select 1 from public.team_members where user_id = auth.uid())
);
