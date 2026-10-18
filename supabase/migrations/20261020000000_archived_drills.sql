-- Drills an admin decides aren't good enough can be archived (decision 0009).
-- Archived drills never reach coaches (only 'live' does) and can be restored to review.
alter table public.drills drop constraint if exists drills_status_check;
alter table public.drills add constraint drills_status_check check (status in ('draft', 'in_review', 'approved', 'live', 'archived'));
