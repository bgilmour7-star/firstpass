-- Admin → Analytics: leads and returning visitors, and the lead funnel (decision 0051).
-- A visit now records whether the visitor was signed in, and sign-ins record themselves too, so a
-- visitor who is (or becomes, that day) a signed-in coach counts as returning, not as a lead.
-- New sign-ups record "account_created" with the same daily visitor hash, which ties the funnel's
-- account step to the visits before it. Still no cookies and no user id in page_events.
-- Additive: record_page_event stays for the code that's live until this deploys. Safe to run twice.

alter table public.page_events add column if not exists signed_in boolean not null default false;

alter table public.page_events drop constraint if exists page_events_name_check;
alter table public.page_events add constraint page_events_name_check
  check (name in ('view', 'reached_form', 'form_start', 'signup', 'sign_in', 'account_created'));

create or replace function public.record_site_event(event text, page text, ip text, agent text, came_from text, kind_of_device text, place text, signed_in boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Vancouver')::date;
  s bytea;
begin
  if event not in ('view', 'reached_form', 'form_start', 'signup', 'sign_in', 'account_created') then raise exception 'bad-event'; end if;
  insert into private.visit_salts (day, salt) values (today, extensions.gen_random_bytes(16)) on conflict (day) do nothing;
  delete from private.visit_salts where day < today;
  select salt into s from private.visit_salts where day = today;
  insert into public.page_events (name, path, visitor, source, device, region, signed_in)
  values (
    event,
    left(coalesce(page, '/'), 200),
    encode(extensions.digest(s || convert_to(coalesce(ip, '') || '|' || coalesce(agent, ''), 'UTF8'), 'sha256'), 'hex'),
    nullif(left(coalesce(came_from, ''), 60), ''),
    case when kind_of_device in ('phone', 'tablet', 'desktop') then kind_of_device end,
    nullif(left(coalesce(place, ''), 80), ''),
    coalesce(signed_in, false)
  );
end;
$$;

revoke all on function public.record_site_event(text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.record_site_event(text, text, text, text, text, text, text, boolean) to anon, authenticated;
