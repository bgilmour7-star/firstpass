-- Which update email links bring coaches back, and what they do next (decision 0036). Every firstpass.coach link in
-- an email from Admin → Send carries ?from=<ref>-<n> (the email's short ref, then the link's number). When a signed-in
-- coach lands on Firstpass with it, the app records one click. Admin → Send then shows, per email: coaches who came
-- back from each link, and what coaches who clicked and didn't click did in the 7 days after. Run the whole file in
-- the Supabase SQL editor. Safe to run twice.
--
-- No cookies and no third party: the tag is in the link, the click is stored here. Coaches only, never children.
-- Brett only sees the numbers (can_see_analytics()).

-- 1. A short, unguessable-enough ref per email for the link tag (the id would make links long).
alter table public.broadcasts add column if not exists ref text;
update public.broadcasts set ref = substr(md5(id::text || random()::text), 1, 8) where ref is null;
alter table public.broadcasts alter column ref set default substr(md5(gen_random_uuid()::text), 1, 8);
create unique index if not exists broadcasts_ref on public.broadcasts (ref);

-- 2. Clicks. user_id is the signed-in coach; signed-out visitors carry the tag through sign-in and are recorded after.
create table if not exists public.broadcast_clicks (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  link smallint not null check (link between 1 and 99),
  user_id uuid not null references auth.users (id) on delete cascade,
  clicked_at timestamptz not null default now()
);
create index if not exists broadcast_clicks_broadcast on public.broadcast_clicks (broadcast_id, user_id);

alter table public.broadcast_clicks enable row level security;
drop policy if exists "analytics viewers read broadcast clicks" on public.broadcast_clicks;
create policy "analytics viewers read broadcast clicks" on public.broadcast_clicks for select using (public.can_see_analytics());
-- No insert policy: clicks only arrive through record_email_click below.

-- 3. Record a click for the signed-in coach. Unknown refs are ignored, and the same coach, email and link within
-- 10 minutes counts once, so reloads don't pile up rows. Returns true when a click was stored.
create or replace function public.record_email_click(ref text, link int)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare b uuid; me uuid := auth.uid();
begin
  if me is null or ref is null or ref !~ '^[0-9a-f]{8}$' or link is null or link < 1 or link > 99 then return false; end if;
  select x.id into b from public.broadcasts x where x.ref = record_email_click.ref and x.status <> 'draft';
  if b is null then return false; end if;
  if exists (select 1 from public.broadcast_clicks c where c.broadcast_id = b and c.link = record_email_click.link and c.user_id = me and c.clicked_at > now() - interval '10 minutes') then
    return false;
  end if;
  insert into public.broadcast_clicks (broadcast_id, link, user_id) values (b, record_email_click.link, me);
  return true;
end;
$$;

-- 4. The numbers for one email, Brett only. Only coaches it was sent to count. For each coach the window starts at
-- their first click (or when it was sent, for coaches who didn't click) and runs 7 days.
create or replace function public.broadcast_stats(b uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare out jsonb;
begin
  if not public.can_see_analytics() then raise exception 'not allowed'; end if;
  with sent as (
    select r.user_id, s.sent_at from public.broadcast_sends s join public.research_people r on r.id = s.person_id
    where s.broadcast_id = b and s.status = 'sent' and r.user_id is not null and s.sent_at is not null
  ),
  first_click as (
    select c.user_id, min(c.clicked_at) as at from public.broadcast_clicks c join sent on sent.user_id = c.user_id
    where c.broadcast_id = b group by c.user_id
  ),
  base as (
    select sent.user_id, (fc.user_id is not null) as clicked, coalesce(fc.at, sent.sent_at) as since
    from sent left join first_click fc on fc.user_id = sent.user_id
  ),
  act as (
    select base.clicked,
      exists (select 1 from public.practice_views v where v.user_id = base.user_id and v.viewed_at >= base.since and v.viewed_at < base.since + interval '7 days') as viewed,
      exists (select 1 from public.practice_edits e where e.user_id = base.user_id and e.at >= base.since and e.at < base.since + interval '7 days') as edited,
      exists (select 1 from public.practice_checkins c where c.user_id = base.user_id and c.saved_at >= base.since and c.saved_at < base.since + interval '7 days') as checked_in,
      exists (select 1 from public.progress_scores p where p.user_id = base.user_id and p.started_at >= base.since and p.started_at < base.since + interval '7 days') as scored
    from base
  ),
  grp as (
    select clicked, count(*) as coaches, count(*) filter (where viewed) as viewed, count(*) filter (where edited) as edited,
      count(*) filter (where checked_in) as checked_in, count(*) filter (where scored) as scored,
      count(*) filter (where viewed or edited or checked_in or scored) as any
    from act group by clicked
  )
  select jsonb_build_object(
    'sent', (select count(*) from sent),
    'clicked', (select count(*) from first_click),
    'links', coalesce((select jsonb_agg(jsonb_build_object('link', l.link, 'coaches', l.coaches) order by l.link)
      from (select c.link, count(distinct c.user_id) as coaches from public.broadcast_clicks c join sent on sent.user_id = c.user_id where c.broadcast_id = b group by c.link) l), '[]'::jsonb),
    'groups', coalesce((select jsonb_object_agg(case when g.clicked then 'clicked' else 'notClicked' end,
      jsonb_build_object('coaches', g.coaches, 'viewed', g.viewed, 'edited', g.edited, 'checkedIn', g.checked_in, 'scored', g.scored, 'any', g.any)) from grp g), '{}'::jsonb)
  ) into out;
  return out;
end;
$$;

revoke all on function public.record_email_click(text, int) from public, anon;
grant execute on function public.record_email_click(text, int) to authenticated;
revoke all on function public.broadcast_stats(uuid) from public, anon;
grant execute on function public.broadcast_stats(uuid) to authenticated;
