-- Drill requests from coaches (decision 0018). Safe to run twice.
-- A coach asks for a new drill or suggests a change to one. Once a day Claude drafts it: a new drill
-- goes into review (drills.status = 'in_review'); a change is stored as a proposal next to the live drill.
-- An admin reviews, and the coach is told the outcome. Team details only: never a child's name.

-- The timer's secret (also created by the check-in email migration; harmless if it already exists).
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create table if not exists public.drill_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new', 'change')),
  team_id uuid not null references public.teams (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null default auth.uid(),
  requester_name text check (requester_name is null or char_length(requester_name) <= 60),
  requester_email text check (requester_email is null or char_length(requester_email) <= 254),
  -- change: the drill to improve. new: the drill Claude drafted, once it exists.
  drill_id text references public.drills (id) on delete set null,
  -- new: part, shape, focus, minutes, gear as the coach picked them.
  answers jsonb not null default '{}'::jsonb,
  description text not null check (char_length(description) between 1 and 2000),
  link text check (link is null or (char_length(link) <= 500 and link ~ '^https?://')),
  state text not null default 'sent' check (state in ('sent', 'drafted', 'accepted', 'declined')),
  -- change: Claude's proposed drill (the full drill JSON); the live drill is untouched until accepted.
  proposed jsonb,
  claude_note text check (claude_note is null or char_length(claude_note) <= 2000),
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  drafted_at timestamptz,
  decided_at timestamptz,
  admin_emailed_at timestamptz,
  coach_emailed_at timestamptz,
  constraint change_needs_drill check (kind = 'new' or drill_id is not null)
);
create index if not exists drill_requests_open on public.drill_requests (team_id) where state in ('sent', 'drafted');
create index if not exists drill_requests_drill on public.drill_requests (drill_id);

-- At most 5 open requests per team. Counted outside RLS so the insert policy can use it.
create or replace function public.open_drill_requests(t uuid)
returns int language sql stable security definer set search_path = ''
as $$ select count(*)::int from public.drill_requests r where r.team_id = t and r.state in ('sent', 'drafted'); $$;
grant execute on function public.open_drill_requests(uuid) to authenticated;

alter table public.drill_requests enable row level security;

drop policy if exists "coaches read their team's requests" on public.drill_requests;
create policy "coaches read their team's requests" on public.drill_requests
  for select using (public.is_team_member(team_id) or public.is_admin());

drop policy if exists "coaches send requests" on public.drill_requests;
create policy "coaches send requests" on public.drill_requests
  for insert with check (
    public.is_team_member(team_id)
    and requested_by = auth.uid()
    and state = 'sent'
    and proposed is null and claude_note is null and reason is null
    and drafted_at is null and decided_at is null and admin_emailed_at is null and coach_emailed_at is null
    and (kind = 'change' or drill_id is null)
    and public.open_drill_requests(team_id) < 5
  );

drop policy if exists "admins manage requests" on public.drill_requests;
create policy "admins manage requests" on public.drill_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Drafted requests whose "ready to review" email hasn't gone out, claimed in one step (the
-- check-in email timer calls this too). It goes to the address in private.settings
-- 'review_email' if set, else the first admin.
create or replace function public.claim_request_emails(secret text)
returns table (request_id uuid, kind text, to_email text, requester_name text, team_name text, drill_id text, drill_name text, description text)
language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query
  with due as (
    update public.drill_requests r set admin_emailed_at = now()
    where r.id in (
      select r2.id from public.drill_requests r2
      where r2.state = 'drafted' and r2.admin_emailed_at is null
      order by r2.drafted_at limit 20
      for update skip locked
    )
    returning r.id, r.kind, r.requester_name, r.team_id, r.drill_id, r.description, r.proposed
  )
  select d.id, d.kind,
    coalesce((select s.value from private.settings s where s.key = 'review_email'), (select a.email from public.admins a order by a.created_at limit 1)),
    d.requester_name, t.name, d.drill_id,
    coalesce(dr.content ->> 'funName', d.proposed ->> 'funName'),
    d.description
  from due d
  join public.teams t on t.id = d.team_id
  left join public.drills dr on dr.id = d.drill_id;
end;
$$;

create or replace function public.release_request_email(secret text, request uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if secret is null or secret is distinct from (select s.value from private.settings s where s.key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  update public.drill_requests set admin_emailed_at = null where id = request;
end;
$$;

revoke all on function public.claim_request_emails(text) from public;
revoke all on function public.release_request_email(text, uuid) from public;
grant execute on function public.claim_request_emails(text) to anon, authenticated;
grant execute on function public.release_request_email(text, uuid) to anon, authenticated;
