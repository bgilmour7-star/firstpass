-- Discovery: one person record across waitlist and account, the survey, Brett's notes and themes,
-- and the email journeys' outbox (decision 0027, docs/specs/teams-and-discovery.md → PR 3).
-- Safe to run twice. Run the whole file in the Supabase SQL editor, after the waitlist migration
-- (20261026000000). It also starts a 10-minute timer that asks https://firstpass.coach to send
-- any discovery emails that are due.
--
-- Who sees it: Brett only (can_see_analytics(), like the waitlist), because it holds personal emails,
-- phone numbers and free-text answers. Public pages (the survey, unsubscribe) only go through the
-- token functions below, never a table select. No children's data: the survey says so under
-- every free-text field.

create extension if not exists pgcrypto with schema extensions;

-- 1. People. One row per email, whether they joined the waitlist, created an account, or both.
-- code is pseudonymous (c-0101): it is all the repo's research files ever use to name someone.
-- email is stored lower-case (plain text, not citext, so comparisons inside the security-definer
-- functions below, which run with an empty search_path, can't silently turn case-sensitive).
create sequence if not exists public.research_people_code_seq start 101;

create table if not exists public.research_people (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('c-' || lpad(nextval('public.research_people_code_seq')::text, 4, '0')),
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  user_id uuid unique references auth.users (id) on delete set null,
  waitlist_id uuid references public.waitlist (id) on delete set null,
  first_name text check (first_name is null or char_length(first_name) <= 60),
  audience text not null default 'waitlist' check (audience in ('waitlist', 'coach')),
  -- In every discovery email's unsubscribe link (/unsubscribe/<token>). Practice emails are separate.
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Survey invites: the token in each survey link (/s/<token>). One per person per audience.
create table if not exists public.survey_invites (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  person_id uuid not null references public.research_people (id) on delete cascade,
  audience text not null check (audience in ('waitlist', 'coach')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (person_id, audience)
);

-- 3. Survey answers. Coaches already on Firstpass get two different questions (Q3, Q6), kept in extra.
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.research_people (id) on delete cascade,
  audience text not null check (audience in ('waitlist', 'coach', 'older')),
  role text,
  age_groups text[] not null default '{}',
  planned_how text,
  planned_when text,
  hardest_part text check (hardest_part is null or char_length(hardest_part) <= 2000),
  wants_help text check (wants_help is null or char_length(wants_help) <= 2000),
  extra jsonb not null default '{}',
  wants_call boolean not null default false,
  call_times text[] not null default '{}',
  phone text check (phone is null or char_length(phone) <= 30),
  call_status text not null default 'none' check (call_status in ('none', 'to_book', 'booked', 'done')),
  gift_card text not null default 'not_offered' check (gift_card in ('owed', 'sent', 'not_offered')),
  themes text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists survey_responses_person on public.survey_responses (person_id);

-- 4. Brett's notes: calls, chats at the rink, email replies pasted in.
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.research_people (id) on delete cascade,
  kind text not null check (kind in ('call', 'rink', 'email', 'other')),
  body text not null check (char_length(body) between 1 and 5000),
  themes text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists coach_notes_person on public.coach_notes (person_id);

-- 5. Themes. The daily scheduled task tags answers and notes from this list, and only adds a
-- name once Brett has said yes to it.
create table if not exists public.insight_themes (
  name text primary key check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

-- 6. The outbox. One row per journey step per person; the cron route claims, sends and marks it.
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  journey text not null,
  step text not null,
  person_id uuid not null references public.research_people (id) on delete cascade,
  due_at timestamptz not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  skipped_reason text,
  created_at timestamptz not null default now(),
  unique (journey, step, person_id)
);
create index if not exists email_sends_due on public.email_sends (due_at) where sent_at is null and skipped_reason is null;

-- RLS: Brett only, on every table.
alter table public.research_people enable row level security;
alter table public.survey_invites enable row level security;
alter table public.survey_responses enable row level security;
alter table public.coach_notes enable row level security;
alter table public.insight_themes enable row level security;
alter table public.email_sends enable row level security;

drop policy if exists "analytics viewers manage research people" on public.research_people;
create policy "analytics viewers manage research people" on public.research_people for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers manage survey invites" on public.survey_invites;
create policy "analytics viewers manage survey invites" on public.survey_invites for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers manage survey responses" on public.survey_responses;
create policy "analytics viewers manage survey responses" on public.survey_responses for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers manage coach notes" on public.coach_notes;
create policy "analytics viewers manage coach notes" on public.coach_notes for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers manage insight themes" on public.insight_themes;
create policy "analytics viewers manage insight themes" on public.insight_themes for all using (public.can_see_analytics()) with check (public.can_see_analytics());
drop policy if exists "analytics viewers read email sends" on public.email_sends;
create policy "analytics viewers read email sends" on public.email_sends for select using (public.can_see_analytics());

-- 7. Linking. A waitlist sign-up or a new account upserts the person by email. Neither can ever
-- fail because of this: errors become warnings.

-- A new waitlist person starts the waitlist journey: welcome now (the next timer run, within 10
-- minutes), nudge at +3 days, last ask at +7.
create or replace function public.start_waitlist_journey(person uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.survey_invites (person_id, audience) values (person, 'waitlist') on conflict (person_id, audience) do nothing;
  insert into public.email_sends (journey, step, person_id, due_at)
  values ('waitlist', 'welcome', person, now()), ('waitlist', 'nudge', person, now() + interval '3 days'), ('waitlist', 'last-ask', person, now() + interval '7 days')
  on conflict (journey, step, person_id) do nothing;
$$;

create or replace function public.link_waitlist_person()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  aud text;
begin
  begin
    insert into public.research_people as r (email, waitlist_id, audience)
    values (lower(new.email), new.id, 'waitlist')
    on conflict (email) do update set waitlist_id = coalesce(r.waitlist_id, excluded.waitlist_id)
    returning r.id, r.audience into pid, aud;
    -- Someone who already has an account isn't sent the waitlist emails.
    if aud = 'waitlist' then perform public.start_waitlist_journey(pid); end if;
  exception when others then
    raise warning 'research_people link (waitlist) failed: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists link_waitlist_person on public.waitlist;
create trigger link_waitlist_person after insert on public.waitlist for each row execute function public.link_waitlist_person();

create or replace function public.link_account_person()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  begin
    insert into public.research_people as r (email, user_id, first_name, audience)
    values (lower(new.email), new.id, nullif(left(trim(new.raw_user_meta_data ->> 'first_name'), 60), ''), 'coach')
    on conflict (email) do update set user_id = excluded.user_id, first_name = coalesce(r.first_name, excluded.first_name), audience = 'coach';
  exception when others then
    raise warning 'research_people link (account) failed: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists link_account_person on auth.users;
create trigger link_account_person after insert on auth.users for each row when (new.email is not null) execute function public.link_account_person();

-- Everyone already here gets a person row (no emails are queued for them).
insert into public.research_people as r (email, waitlist_id, audience)
select lower(w.email), w.id, 'waitlist' from public.waitlist w
on conflict (email) do update set waitlist_id = coalesce(r.waitlist_id, excluded.waitlist_id);
insert into public.research_people as r (email, user_id, first_name, audience)
select lower(u.email), u.id, nullif(left(trim(u.raw_user_meta_data ->> 'first_name'), 60), ''), 'coach'
from auth.users u where u.email is not null and u.deleted_at is null
on conflict (email) do update set user_id = excluded.user_id, first_name = coalesce(r.first_name, excluded.first_name), audience = 'coach';

-- Everyone gets a survey link Brett can copy from their page (Admin → Coaches), even without emails.
insert into public.survey_invites (person_id, audience)
select r.id, r.audience from public.research_people r
on conflict (person_id, audience) do nothing;

-- 8. The public survey, by token only.
create or replace function public.survey_invite(t text)
returns table (audience text, first_name text, email text, used boolean, team_name text)
language sql stable security definer set search_path = ''
as $$
  select i.audience,
    coalesce(r.first_name, (select nullif(u.raw_user_meta_data ->> 'first_name', '') from auth.users u where u.id = r.user_id)),
    r.email, i.used_at is not null,
    (select tm.name from public.team_members m join public.teams tm on tm.id = m.team_id where m.user_id = r.user_id order by m.created_at limit 1)
  from public.survey_invites i join public.research_people r on r.id = i.person_id
  where t is not null and i.token = t;
$$;

-- Returns 'ok', 'used' or 'unknown'. Marks the invite used, owes a gift card, books a call when they
-- said yes, and stops the rest of this person's survey emails.
create or replace function public.submit_survey(t text, answers jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  inv public.survey_invites;
  yes boolean := coalesce((answers ->> 'wants_call')::boolean, false);
  arr jsonb;
begin
  select * into inv from public.survey_invites where token = t for update;
  if not found then return 'unknown'; end if;
  if inv.used_at is not null then return 'used'; end if;
  insert into public.survey_responses (person_id, audience, role, age_groups, planned_how, planned_when, hardest_part, wants_help, extra, wants_call, call_times, phone, call_status, gift_card)
  values (
    inv.person_id, inv.audience,
    left(answers ->> 'role', 40),
    coalesce((select array_agg(left(x, 12)) from (select jsonb_array_elements_text(case when jsonb_typeof(answers -> 'age_groups') = 'array' then answers -> 'age_groups' else '[]' end) x limit 4) a), '{}'),
    left(answers ->> 'planned_how', 40),
    left(answers ->> 'planned_when', 40),
    nullif(left(trim(answers ->> 'hardest_part'), 2000), ''),
    nullif(left(trim(answers ->> 'wants_help'), 2000), ''),
    case when jsonb_typeof(answers -> 'extra') = 'object' and length((answers -> 'extra')::text) < 4500 then answers -> 'extra' else '{}' end,
    yes,
    case when yes then coalesce((select array_agg(left(x, 30)) from (select jsonb_array_elements_text(case when jsonb_typeof(answers -> 'call_times') = 'array' then answers -> 'call_times' else '[]' end) x limit 5) c), '{}') else '{}' end,
    case when yes then nullif(left(trim(answers ->> 'phone'), 30), '') end,
    case when yes then 'to_book' else 'none' end,
    'owed'
  );
  update public.survey_invites set used_at = now() where token = t;
  update public.email_sends set skipped_reason = 'survey-done'
  where person_id = inv.person_id and sent_at is null and skipped_reason is null and claimed_at is null;
  return 'ok';
end;
$$;

-- 9. Unsubscribe, by token only. Stops discovery emails; practice emails are not affected.
create or replace function public.unsubscribe_status(t text)
returns table (audience text, unsubscribed boolean)
language sql stable security definer set search_path = ''
as $$ select r.audience, r.unsubscribed_at is not null from public.research_people r where t is not null and r.unsubscribe_token = t; $$;

create or replace function public.unsubscribe(t text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare pid uuid;
begin
  update public.research_people set unsubscribed_at = coalesce(unsubscribed_at, now()) where t is not null and unsubscribe_token = t returning id into pid;
  if pid is null then return false; end if;
  update public.email_sends set skipped_reason = 'unsubscribed' where person_id = pid and sent_at is null and skipped_reason is null and claimed_at is null;
  return true;
end;
$$;

-- 10. The timer's side. Guarded by the cron secret (decision 0010).

-- Adds due coach steps: first-practice 2 days after the coach's first practice ends (one that started
-- after they joined the team), and the nudge 3 days after first-practice went out. Admins and people
-- who have answered or unsubscribed are left out here, and checked again at send time.
create or replace function public.enqueue_discovery_emails(secret text)
returns int language plpgsql security definer set search_path = ''
as $$
declare added int := 0; n int;
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;

  insert into public.email_sends (journey, step, person_id, due_at)
  select 'coach', 'first-practice', r.id, f.ended + interval '2 days'
  from public.research_people r
  join lateral (
    select min((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') as ended
    from public.team_members m join public.practices p on p.team_id = m.team_id
    where m.user_id = r.user_id
      and jsonb_array_length(p.blocks) > 0
      and ((p.date + p.start_time) at time zone 'America/Vancouver') >= m.created_at
      and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') <= now()
  ) f on f.ended is not null
  where r.user_id is not null and r.unsubscribed_at is null
    and not exists (select 1 from public.admins a where a.user_id = r.user_id)
    and not exists (select 1 from public.survey_responses s where s.person_id = r.id)
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  insert into public.survey_invites (person_id, audience)
  select e.person_id, 'coach' from public.email_sends e where e.journey = 'coach'
  on conflict (person_id, audience) do nothing;

  insert into public.email_sends (journey, step, person_id, due_at)
  select 'coach', 'nudge', e.person_id, e.sent_at + interval '3 days'
  from public.email_sends e
  where e.journey = 'coach' and e.step = 'first-practice' and e.sent_at is not null
  on conflict (journey, step, person_id) do nothing;
  get diagnostics n = row_count; added := added + n;

  return added;
end;
$$;

-- Claims up to 50 due emails in one step, so two runs can't both send. A claim older than 30 minutes
-- that never finished (a run that crashed mid-send) is claimed again; the Resend idempotency key
-- keeps that from sending twice. Returns
-- the facts each journey's condition needs; the app checks them at send time (src/lib/email/journeys.ts).
create or replace function public.claim_due_emails(secret text)
returns table (send_id uuid, journey text, step text, person_id uuid, email text, first_name text, audience text,
  unsubscribe_token text, survey_token text, survey_done boolean, unsubscribed boolean, is_admin boolean, team_name text)
language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query
  with due as (
    select e.id from public.email_sends e
    where e.sent_at is null and e.skipped_reason is null and e.due_at <= now()
      and (e.claimed_at is null or e.claimed_at < now() - interval '30 minutes')
    order by e.due_at
    limit 50
    for update skip locked
  ), claimed as (
    update public.email_sends e set claimed_at = now() from due where e.id = due.id
    returning e.id, e.journey, e.step, e.person_id
  )
  select c.id, c.journey, c.step, r.id, r.email,
    coalesce(r.first_name, (select nullif(u.raw_user_meta_data ->> 'first_name', '') from auth.users u where u.id = r.user_id)),
    r.audience, r.unsubscribe_token,
    (select i.token from public.survey_invites i where i.person_id = r.id and i.audience = case when c.journey = 'coach' then 'coach' else 'waitlist' end),
    exists (select 1 from public.survey_responses s where s.person_id = r.id),
    r.unsubscribed_at is not null,
    r.user_id is not null and exists (select 1 from public.admins a where a.user_id = r.user_id),
    (select tm.name from public.team_members m join public.teams tm on tm.id = m.team_id where m.user_id = r.user_id order by m.created_at limit 1)
  from claimed c join public.research_people r on r.id = c.person_id;
end;
$$;

-- outcome: 'sent', 'skipped' (with a reason) or 'released' (a failed send, tried again next run).
create or replace function public.finish_email(secret text, send uuid, outcome text, reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  if outcome = 'sent' then
    update public.email_sends set sent_at = now() where id = send;
  elsif outcome = 'skipped' then
    update public.email_sends set skipped_reason = left(coalesce(reason, 'skipped'), 60) where id = send;
  elsif outcome = 'released' then
    update public.email_sends set claimed_at = null where id = send and sent_at is null;
  else
    raise exception 'bad-outcome';
  end if;
end;
$$;

-- 11. What each coach actually does, for Admin → Coaches and the research sync. Practices, check-ins
-- and edits are readable only by team members under RLS, so this reads them for Brett (or the
-- service role in scripts/research.ts) and returns counts only.
create or replace function public.discovery_usage()
returns table (person_id uuid, teams jsonb, practices_run int, checkins int, swaps int, last_active timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.can_see_analytics() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed';
  end if;
  return query
  select r.id,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'ageGroup', t.age_group, 'ice', t.ice, 'role', m.role, 'joinedAt', m.created_at,
        'skaters', (select coalesce(sum((g ->> 'skaters')::int), 0) from jsonb_array_elements(t.groups) g),
        'coaches', (select count(*) from public.team_members m2 where m2.team_id = t.id)
      ) order by m.created_at)
      from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = r.user_id
    ), '[]'::jsonb),
    (select count(*)::int from public.team_members m join public.practices p on p.team_id = m.team_id
      where m.user_id = r.user_id and jsonb_array_length(p.blocks) > 0
        and ((p.date + p.start_time) at time zone 'America/Vancouver') >= m.created_at
        and ((p.date + p.start_time + make_interval(mins => p.minutes)) at time zone 'America/Vancouver') <= now()),
    (select count(*)::int from public.practice_checkins c where c.user_id = r.user_id),
    (select count(*)::int from public.practice_edits e where e.user_id = r.user_id and e.summary ilike '%swapped%'),
    greatest(
      (select max(e.at) from public.practice_edits e where e.user_id = r.user_id),
      (select max(c.saved_at) from public.practice_checkins c where c.user_id = r.user_id),
      (select max(v.viewed_at) from public.practice_views v where v.user_id = r.user_id)
    )
  from public.research_people r
  where r.user_id is not null;
end;
$$;

revoke all on function public.start_waitlist_journey(uuid) from public, anon, authenticated;
revoke all on function public.link_waitlist_person() from public, anon, authenticated;
revoke all on function public.link_account_person() from public, anon, authenticated;
revoke all on function public.survey_invite(text) from public;
revoke all on function public.submit_survey(text, jsonb) from public;
revoke all on function public.unsubscribe_status(text) from public;
revoke all on function public.unsubscribe(text) from public;
revoke all on function public.enqueue_discovery_emails(text) from public;
revoke all on function public.claim_due_emails(text) from public;
revoke all on function public.finish_email(text, uuid, text, text) from public;
revoke all on function public.discovery_usage() from public;
grant execute on function public.survey_invite(text) to anon, authenticated;
grant execute on function public.submit_survey(text, jsonb) to anon, authenticated;
grant execute on function public.unsubscribe_status(text) to anon, authenticated;
grant execute on function public.unsubscribe(text) to anon, authenticated;
grant execute on function public.enqueue_discovery_emails(text) to anon, authenticated;
grant execute on function public.claim_due_emails(text) to anon, authenticated;
grant execute on function public.finish_email(text, uuid, text, text) to anon, authenticated;
grant execute on function public.discovery_usage() to authenticated, service_role;

-- 12. The timer: every 10 minutes, ask the app to send what's due. The secret was made by the
-- check-in emails migration (20261021000000).
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value) values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (key) do nothing;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'firstpass-discovery-emails';
select cron.schedule(
  'firstpass-discovery-emails',
  '*/10 * * * *',
  format(
    $job$select net.http_post(url := %L, headers := jsonb_build_object('authorization', %L, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 20000)$job$,
    'https://firstpass.coach/api/cron/emails',
    'Bearer ' || (select value from private.settings where key = 'cron_secret')
  )
);
