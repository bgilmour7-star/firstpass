-- Admin → Analytics: leave automated visits out of the numbers, without deleting anything.
-- From 2026-10-26 the page only records a visit after a sign of a person (a scroll, tap, key or
-- mouse move), so new robot visits aren't stored at all. This marks the ones already stored: views
-- from cloud data-centre cities by visitors who never did anything else (never scrolled to the
-- form, never started it). Ashburn's were a phone + desktop pair every ~4 hours. Safe to run twice.

alter table public.page_events add column if not exists automated boolean not null default false;

update public.page_events set automated = true
where name = 'view'
  and not automated
  and region in ('Ashburn, VA, US', 'Council Bluffs, IA, US', 'Boardman, OR, US', 'Dallas, TX, US', 'New York City, NY, US')
  and occurred_at < '2026-10-27T12:00:00Z'
  and visitor not in (select visitor from public.page_events where name <> 'view');
