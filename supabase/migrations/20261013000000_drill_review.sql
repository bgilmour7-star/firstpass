-- Drill library + admin review. Run in the Supabase SQL editor, or with `supabase db push`.
-- Admin-only for now: coaches will later get read access to live drills (separate migration).

-- Who may review drills. Add a row per admin after they first sign in (see docs/setup.md).
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- One row per drill. Fields we filter on are columns; the rest of the record
-- (steps, cues, focus, levels, diagrams) is a JSON document validated by the app (src/lib/drills/schema.ts).
create table public.drills (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'live')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- A reviewer's request to change a drill's diagram. Claude picks these up and redraws.
create table public.diagram_requests (
  id uuid primary key default gen_random_uuid(),
  drill_id text not null references public.drills (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution is null or char_length(resolution) <= 2000)
);
create index diagram_requests_open on public.diagram_requests (drill_id) where resolved_at is null;

create table public.review_notes (
  id uuid primary key default gen_random_uuid(),
  drill_id text not null references public.drills (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.drills enable row level security;
alter table public.diagram_requests enable row level security;
alter table public.review_notes enable row level security;

create policy "admins read admins" on public.admins for select using (public.is_admin());
create policy "admins manage drills" on public.drills for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage diagram requests" on public.diagram_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage review notes" on public.review_notes for all using (public.is_admin()) with check (public.is_admin());
