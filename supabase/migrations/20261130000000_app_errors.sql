-- Errors the app catches and carries on from (decision 0054): a failed email, an analytics write, a join that
-- went wrong. Vercel's Hobby plan keeps logs for under an hour, so these are saved here (in Canada) for
-- Admin → Analytics. Each row is an area like "email" and a short message; the app takes out emails, ids,
-- codes and tokens, and never saves a database error's details. Kept 30 days. Safe to run twice.

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  area text not null,
  message text not null
);
create index if not exists app_errors_occurred_at on public.app_errors (occurred_at);

alter table public.app_errors enable row level security;
-- Only analytics viewers read it, and nobody writes to it directly.
revoke all on public.app_errors from anon, authenticated;
grant select on public.app_errors to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_errors' and policyname = 'analytics viewers read app errors') then
    create policy "analytics viewers read app errors" on public.app_errors for select using (public.can_see_analytics());
  end if;
end $$;

-- The server's key for writing errors, stored as a hash. The key itself is the APP_ERRORS_KEY env var in
-- Vercel, never in the repo; its hash is added once with:
--   insert into private.app_error_keys (hash) values (extensions.digest('<the key>', 'sha256'));
create table if not exists private.app_error_keys (hash bytea primary key);
revoke all on private.app_error_keys from public, anon, authenticated;

-- The only way in. The anon key is public, so a call without the server's key does nothing. At most 50 rows an
-- hour for each area and 300 in all, so one noisy area can't crowd out the rest.
create or replace function public.record_app_error(secret text, area text, message text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  a text := left(coalesce(nullif(area, ''), 'app'), 40);
begin
  if secret is null or not exists (select 1 from private.app_error_keys k where k.hash = extensions.digest(secret, 'sha256')) then return; end if;
  if (select count(*) from public.app_errors e where e.occurred_at > now() - interval '1 hour') >= 300 then return; end if;
  if (select count(*) from public.app_errors e where e.area = a and e.occurred_at > now() - interval '1 hour') >= 50 then return; end if;
  insert into public.app_errors (area, message) values (a, left(coalesce(message, ''), 400));
  delete from public.app_errors e where e.occurred_at < now() - interval '30 days';
end;
$$;

revoke all on function public.record_app_error(text, text, text) from public;
grant execute on function public.record_app_error(text, text, text) to anon, authenticated;
