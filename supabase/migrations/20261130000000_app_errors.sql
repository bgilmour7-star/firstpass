-- Errors the app catches and carries on from (decision 0054): a failed email, an analytics write, a join that
-- went wrong. Vercel's Hobby plan keeps logs for under an hour, so these are saved here (in Canada) for the
-- morning check and Admin → Analytics. Each row is an area like "email" and a short message with emails, ids
-- and tokens already removed by the app. Kept 30 days. Safe to run twice.

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  area text not null,
  message text not null
);
create index if not exists app_errors_occurred_at on public.app_errors (occurred_at);

alter table public.app_errors enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_errors' and policyname = 'analytics viewers read app errors') then
    create policy "analytics viewers read app errors" on public.app_errors for select using (public.can_see_analytics());
  end if;
end $$;
-- No write policies: rows are added only by record_app_error.

-- Called by the server for any request, signed in or not. At most 300 rows an hour, so a loop can't flood it.
create or replace function public.record_app_error(area text, message text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.app_errors e where e.occurred_at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.app_errors (area, message) values (left(coalesce(nullif(area, ''), 'app'), 40), left(coalesce(message, ''), 400));
  delete from public.app_errors e where e.occurred_at < now() - interval '30 days';
end;
$$;

revoke all on function public.record_app_error(text, text) from public;
grant execute on function public.record_app_error(text, text) to anon, authenticated;
