-- U11 and U13 teams (decision 0056). Teams' age_group has no check; email segments by age did.
-- Safe to run twice.
alter table public.broadcasts drop constraint if exists broadcasts_age_group_check;
alter table public.broadcasts add constraint broadcasts_age_group_check
  check (age_group is null or age_group in ('U5', 'U7', 'U9', 'U11', 'U13'));
