-- Email-first sign-in, passwords and named coaches (decision 0013). Safe to run twice.
--
-- A coach's first name and whether they have set a password live in their auth user metadata
-- (raw_user_meta_data: first_name, has_password). Supabase gives every account a hidden password,
-- even link-only ones, so has_password is the only reliable way to tell the two apart.

-- Signed out: how this email signs in, so the sign-in screen can show the right next step.
--   new       no account yet: create one
--   password  has set a password
--   link      has an account, signs in with an emailed link and code
-- Also returns the first name for "Welcome back, Brett". This tells anyone who types an
-- address whether it has an account; accepted for the pilot, like Slack and Notion do.
create or replace function public.sign_in_status(address text)
returns table (status text, first_name text) language sql stable security definer set search_path = ''
as $$
  select
    case when u.id is null then 'new'
         when coalesce(u.raw_user_meta_data ->> 'has_password', '') = 'true' then 'password'
         else 'link' end,
    nullif(u.raw_user_meta_data ->> 'first_name', '')
  from (select 1) one
  left join auth.users u on lower(u.email) = lower(trim(address)) and u.deleted_at is null
  limit 1;
$$;

-- Anyone with a join link, signed in or not: what they're joining. The link itself is the
-- permission (decision 0011). Team name, the head coach's first name and the next practice's
-- date, start and ice only: no plans, no other coaches' emails.
create or replace function public.join_link_preview(code text)
returns table (team_id uuid, team_name text, inviter text, next_date date, next_start time, next_ice text, next_blocks int)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name,
    (select coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), initcap(split_part(u.email, '@', 1)))
       from public.team_members m join auth.users u on u.id = m.user_id
      where m.team_id = t.id and m.role = 'head_coach' order by m.created_at limit 1),
    p.date, p.start_time, p.ice, coalesce(jsonb_array_length(p.blocks), 0)
  from public.teams t
  left join lateral (
    select p.* from public.practices p
     where p.team_id = t.id and p.date >= (now() at time zone 'America/Vancouver')::date
       and jsonb_array_length(p.blocks) > 0
     order by p.date, p.start_time limit 1
  ) p on true
  where code is not null and t.join_code = code;
$$;

-- Members: the team's coaches, now with first names. The return type changed, so drop first.
drop function if exists public.team_coaches(uuid);
create function public.team_coaches(team uuid)
returns table (user_id uuid, email text, first_name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(team) then raise exception 'not-a-member'; end if;
  return query
  select m.user_id, u.email::text, nullif(u.raw_user_meta_data ->> 'first_name', ''), m.role, m.created_at
  from public.team_members m join auth.users u on u.id = m.user_id
  where m.team_id = team
  order by (m.role = 'head_coach') desc, m.created_at;
end;
$$;

revoke all on function public.sign_in_status(text) from public;
revoke all on function public.join_link_preview(text) from public;
revoke all on function public.team_coaches(uuid) from public;
grant execute on function public.sign_in_status(text) to anon, authenticated;
grant execute on function public.join_link_preview(text) to anon, authenticated;
grant execute on function public.team_coaches(uuid) to authenticated;
