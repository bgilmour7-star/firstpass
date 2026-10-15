-- Ice times from the team's calendar link (TeamSnap, Google Calendar, any iCal feed).
-- We keep only when, how long, which rink, the title and its kind. Never descriptions or attendees.
-- Run in the Supabase SQL editor.

alter table public.teams add column if not exists calendar_url text check (calendar_url is null or calendar_url ~ '^https?://');
alter table public.teams add column if not exists calendar_synced_at timestamptz;

create table public.ice_times (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  uid text not null,                       -- the calendar event's UID
  date date not null,
  start_time time not null,
  minutes int not null check (minutes between 5 and 240),
  title text not null default '',
  rink text not null default '',
  kind text not null check (kind in ('practice', 'game', 'other')),
  shared_with text,                         -- another team named in the title: on the other half
  cancelled boolean not null default false,
  ignored boolean not null default false,   -- "Not ours": the coach hid it
  practice_id uuid references public.practices (id) on delete set null,
  moved_from text,                          -- "Tue Oct 14, 5:45" when the calendar moved it
  updated_at timestamptz not null default now(),
  unique (team_id, uid)
);
create index ice_times_team_date on public.ice_times (team_id, date);

alter table public.ice_times enable row level security;
create policy "members manage their ice times" on public.ice_times for all
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
