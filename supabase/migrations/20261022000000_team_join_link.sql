-- Co-coaches join a team through its join link (decision 0011). Safe to run twice.
-- The head coach turns the link on, copies it, replaces it or turns it off; anyone who signs in
-- through it joins as a coach. A coach is on one team at a time during the pilot.

alter table public.teams add column if not exists join_code text unique;

-- Head coach: make a new join link (replacing any old one). Returns the code.
create or replace function public.new_join_code(team uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare code text := encode(extensions.gen_random_bytes(12), 'hex');
begin
  if not public.is_head_coach(team) then raise exception 'not-head-coach'; end if;
  update public.teams set join_code = code where id = team;
  return code;
end;
$$;

-- Head coach: turn the join link off.
create or replace function public.turn_off_join_code(team uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_head_coach(team) then raise exception 'not-head-coach'; end if;
  update public.teams set join_code = null where id = team;
end;
$$;

-- Anyone signed in: which team a join link is for, before they join. Name only.
create or replace function public.join_code_team(code text)
returns table (team_id uuid, team_name text) language sql stable security definer set search_path = ''
as $$ select t.id, t.name from public.teams t where code is not null and t.join_code = code; $$;

-- Join through a link. Returns the team id, or raises:
--   link-off           the link was turned off or replaced
--   on-another-team    this coach is already on a different team
create or replace function public.join_team(code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select t.id into target from public.teams t where code is not null and t.join_code = code;
  if target is null then raise exception 'link-off'; end if;
  if exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.team_id = target) then return target; end if;
  if exists (select 1 from public.team_members m where m.user_id = auth.uid()) then raise exception 'on-another-team'; end if;
  insert into public.team_members (team_id, user_id, role) values (target, auth.uid(), 'coach');
  return target;
end;
$$;

-- Members: the team's coaches with their sign-in emails (coaches only, never kids).
create or replace function public.team_coaches(team uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(team) then raise exception 'not-a-member'; end if;
  return query
  select m.user_id, u.email::text, m.role, m.created_at
  from public.team_members m join auth.users u on u.id = m.user_id
  where m.team_id = team
  order by (m.role = 'head_coach') desc, m.created_at;
end;
$$;

-- Head coach: take a coach off the team. Not yourself, so a team always keeps its head coach.
create or replace function public.remove_coach(team uuid, coach uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_head_coach(team) then raise exception 'not-head-coach'; end if;
  if coach = auth.uid() then raise exception 'not-yourself'; end if;
  delete from public.team_members m where m.team_id = team and m.user_id = coach;
end;
$$;

revoke all on function public.new_join_code(uuid) from public;
revoke all on function public.turn_off_join_code(uuid) from public;
revoke all on function public.join_code_team(text) from public;
revoke all on function public.join_team(text) from public;
revoke all on function public.team_coaches(uuid) from public;
revoke all on function public.remove_coach(uuid, uuid) from public;
grant execute on function public.new_join_code(uuid) to authenticated;
grant execute on function public.turn_off_join_code(uuid) to authenticated;
grant execute on function public.join_code_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.team_coaches(uuid) to authenticated;
grant execute on function public.remove_coach(uuid, uuid) to authenticated;
