-- Fixes to email link attribution after review (decision 0036). Run the whole file in the Supabase SQL editor after
-- 20261124000000_email_attribution.sql. Safe to run twice.
--
-- record_email_click: only stores a click from a coach the email was sent to, so forwarded or shared links don't pile
-- up rows. broadcast_stats: drops "opened a practice", because practice_views keeps only each coach's latest view, so
-- that number would shrink over time. Opening Firstpass from the email is the click itself.

create or replace function public.record_email_click(ref text, link int)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare b uuid; me uuid := auth.uid();
begin
  if me is null or ref is null or ref !~ '^[0-9a-f]{8}$' or link is null or link < 1 or link > 99 then return false; end if;
  select x.id into b from public.broadcasts x where x.ref = record_email_click.ref and x.status <> 'draft';
  if b is null then return false; end if;
  -- Only coaches it was sent to: forwarded links and other coaches' links store nothing.
  if not exists (select 1 from public.broadcast_sends s join public.research_people r on r.id = s.person_id
                 where s.broadcast_id = b and s.status = 'sent' and r.user_id = me) then
    return false;
  end if;
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
      exists (select 1 from public.practice_edits e where e.user_id = base.user_id and e.at >= base.since and e.at < base.since + interval '7 days') as edited,
      exists (select 1 from public.practice_checkins c where c.user_id = base.user_id and c.saved_at >= base.since and c.saved_at < base.since + interval '7 days') as checked_in,
      exists (select 1 from public.progress_scores p where p.user_id = base.user_id and p.started_at >= base.since and p.started_at < base.since + interval '7 days') as scored
    from base
  ),
  grp as (
    select clicked, count(*) as coaches, count(*) filter (where edited) as edited,
      count(*) filter (where checked_in) as checked_in, count(*) filter (where scored) as scored,
      count(*) filter (where edited or checked_in or scored) as any
    from act group by clicked
  )
  select jsonb_build_object(
    'sent', (select count(*) from sent),
    'clicked', (select count(*) from first_click),
    'links', coalesce((select jsonb_agg(jsonb_build_object('link', l.link, 'coaches', l.coaches) order by l.link)
      from (select c.link, count(distinct c.user_id) as coaches from public.broadcast_clicks c join sent on sent.user_id = c.user_id where c.broadcast_id = b group by c.link) l), '[]'::jsonb),
    'groups', coalesce((select jsonb_object_agg(case when g.clicked then 'clicked' else 'notClicked' end,
      jsonb_build_object('coaches', g.coaches, 'edited', g.edited, 'checkedIn', g.checked_in, 'scored', g.scored, 'any', g.any)) from grp g), '{}'::jsonb)
  ) into out;
  return out;
end;
$$;

revoke all on function public.record_email_click(text, int) from public, anon;
grant execute on function public.record_email_click(text, int) to authenticated;
revoke all on function public.broadcast_stats(uuid) from public, anon;
grant execute on function public.broadcast_stats(uuid) to authenticated;
