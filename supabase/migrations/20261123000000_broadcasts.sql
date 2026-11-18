-- Emails to coaches from Admin → Send (decision 0035): Brett writes an update in the Firstpass template (text,
-- headings, images, buttons), picks who gets it, and sends it through Resend. Run the whole file in the Supabase SQL
-- editor. Safe to run twice.
--
-- Who sees it: Brett only (can_see_analytics()), like the rest of discovery, because recipient lists hold emails.
-- Recipients are worked out by broadcast_recipients() from live app data: never admins, never unconfirmed or deleted
-- accounts, never anyone who turned update emails off or unsubscribed from survey emails (the old waitlist
-- unsubscribe promised no more emails at all). Update emails have their own opt-out
-- (research_people.updates_off_at), separate from survey emails and practice emails.
-- Images live in a public Supabase Storage bucket in Canada (email-images): only Brett can upload; email clients
-- read them by URL.

-- 1. Opting out of update emails, per person, by the same token as the survey unsubscribe.
alter table public.research_people add column if not exists updates_off_at timestamptz;

-- 2. The emails. blocks is the body, validated by the app (src/lib/broadcasts/schema.ts).
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '' check (char_length(subject) <= 150),
  preheader text not null default '' check (char_length(preheader) <= 200),
  greeting boolean not null default true,
  blocks jsonb not null default '[]',
  segment text not null default 'all' check (segment in ('all', 'head', 'age', 'stalled')),
  age_group text check (age_group is null or age_group in ('U5', 'U7', 'U9')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  recipients int not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- 3. One row per person per email, written when Brett presses Send, so a send that stops halfway can carry on
-- without emailing anyone twice.
create table if not exists public.broadcast_sends (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  person_id uuid not null references public.research_people (id) on delete cascade,
  email text not null,
  first_name text check (first_name is null or char_length(first_name) <= 60),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text check (error is null or char_length(error) <= 300),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, person_id)
);
-- (For a table made by an earlier draft of this file.)
alter table public.broadcast_sends add column if not exists first_name text check (first_name is null or char_length(first_name) <= 60);
create index if not exists broadcast_sends_queued on public.broadcast_sends (broadcast_id) where status = 'queued';

alter table public.broadcasts enable row level security;
alter table public.broadcast_sends enable row level security;
drop policy if exists "analytics viewers manage broadcasts" on public.broadcasts;
create policy "analytics viewers manage broadcasts" on public.broadcasts for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers manage broadcast sends" on public.broadcast_sends;
create policy "analytics viewers manage broadcast sends" on public.broadcast_sends for all using (public.can_see_analytics()) with check (public.can_see_analytics());

-- 4. Who gets it. all: every confirmed account. head: head coaches. age: coaches on a team of that age group.
-- stalled: signed up 3+ days ago and never ran a practice, or nothing done in the app for 14 days.
create or replace function public.broadcast_recipients(seg text, age text default null)
returns table (person_id uuid, email text, first_name text, team_name text, unsubscribe_token text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_see_analytics() then raise exception 'not allowed'; end if;
  if seg is null or seg not in ('all', 'head', 'age', 'stalled') then raise exception 'bad-segment'; end if;
  if seg = 'age' and (age is null or age not in ('U5', 'U7', 'U9')) then raise exception 'bad-age'; end if;
  return query
  select r.id, r.email,
    coalesce(r.first_name, nullif(left(trim(u.raw_user_meta_data ->> 'first_name'), 60), '')),
    (select t.name from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = u.id order by m.created_at limit 1),
    r.unsubscribe_token
  from public.research_people r
  join auth.users u on u.id = r.user_id
  where u.email_confirmed_at is not null and u.deleted_at is null
    and r.updates_off_at is null and r.unsubscribed_at is null
    and not exists (select 1 from public.admins a where a.user_id = u.id)
    and case seg
      when 'all' then true
      when 'head' then exists (select 1 from public.team_members m where m.user_id = u.id and m.role = 'head_coach')
      when 'age' then exists (select 1 from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = u.id and t.age_group = age)
      else (
        (u.created_at < now() - interval '3 days' and not exists (
          select 1 from public.team_members m join public.practices p on p.team_id = m.team_id
          where m.user_id = u.id and jsonb_array_length(p.blocks) > 0
            and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') <= now()))
        or coalesce(greatest(
            (select max(e.at) from public.practice_edits e where e.user_id = u.id),
            (select max(c.saved_at) from public.practice_checkins c where c.user_id = u.id),
            (select max(v.viewed_at) from public.practice_views v where v.user_id = u.id)
          ), u.created_at) < now() - interval '14 days'
      )
    end
  order by r.email;
end;
$$;

-- 5. Starting a send, in one transaction: the list is worked out again here from the broadcast's own segment, and
-- if it isn't the number Brett confirmed, nothing happens ('list-changed:<n>'). Otherwise one queued row per person
-- and draft → sending. Returns the number queued, or 0 if it was already started.
create or replace function public.start_broadcast(b uuid, expected int)
returns int language plpgsql security definer set search_path = ''
as $$
declare bc public.broadcasts; n int;
begin
  if not public.can_see_analytics() then raise exception 'not allowed'; end if;
  select * into bc from public.broadcasts where id = b for update;
  if not found or bc.status <> 'draft' then return 0; end if;
  select count(*) into n from public.broadcast_recipients(bc.segment, bc.age_group);
  if n <> expected then raise exception 'list-changed:%', n; end if;
  if n = 0 then raise exception 'list-empty'; end if;
  insert into public.broadcast_sends (broadcast_id, person_id, email, first_name)
  select b, x.person_id, x.email, left(x.first_name, 60) from public.broadcast_recipients(bc.segment, bc.age_group) x
  on conflict (broadcast_id, person_id) do nothing;
  update public.broadcasts set status = 'sending', recipients = n, sent_at = now() where id = b;
  return n;
end;
$$;

-- 6. Turning update emails off, from the link in every update email (/unsubscribe/<token>/updates). Public: the
-- token is the permission. Returns null for an unknown token.
create or replace function public.updates_status(t text)
returns boolean language sql stable security definer set search_path = ''
as $$ select r.updates_off_at is not null from public.research_people r where t is not null and r.unsubscribe_token = t; $$;

create or replace function public.updates_off(t text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.research_people set updates_off_at = coalesce(updates_off_at, now()) where t is not null and unsubscribe_token = t;
  return found;
end;
$$;

revoke all on function public.broadcast_recipients(text, text) from public, anon;
grant execute on function public.broadcast_recipients(text, text) to authenticated;
revoke all on function public.start_broadcast(uuid, int) from public, anon;
grant execute on function public.start_broadcast(uuid, int) to authenticated;
revoke all on function public.updates_status(text) from public;
revoke all on function public.updates_off(text) from public;
grant execute on function public.updates_status(text) to anon, authenticated;
grant execute on function public.updates_off(text) to anon, authenticated;

-- 7. Images: a public bucket (read by URL from inboxes), 2 MB and common image types only. Only Brett uploads or
-- removes; public buckets serve files without a select policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-images', 'email-images', true, 2097152, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "analytics viewers upload email images" on storage.objects;
create policy "analytics viewers upload email images" on storage.objects for insert to authenticated
  with check (bucket_id = 'email-images' and public.can_see_analytics());
drop policy if exists "analytics viewers remove email images" on storage.objects;
create policy "analytics viewers remove email images" on storage.objects for delete to authenticated
  using (bucket_id = 'email-images' and public.can_see_analytics());
