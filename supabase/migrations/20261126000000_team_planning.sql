-- When something changes (who's here today, a check-in): Firstpass updates the plan for the team, or asks
-- first (decision 0046). One setting per team, for every coach on it. Safe to run twice.

alter table public.teams add column if not exists planning text not null default 'auto';

alter table public.teams drop constraint if exists teams_planning_check;
alter table public.teams add constraint teams_planning_check check (planning in ('auto', 'ask'));
