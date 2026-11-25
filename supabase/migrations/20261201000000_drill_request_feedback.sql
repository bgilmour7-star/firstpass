-- Ask Claude again (decision 0055). Safe to run twice.
-- On a suggested change, an admin can send Claude's draft back with a note instead of accepting or
-- declining it. Each note is kept in order; the request goes back to 'sent' so the next morning run
-- redraws from the earlier proposal, and Brett is emailed again when it is drafted.

alter table public.drill_requests add column if not exists feedback jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.drill_requests add constraint drill_requests_feedback_is_list check (jsonb_typeof(feedback) = 'array' and jsonb_array_length(feedback) <= 20);
exception when duplicate_object then null; end $$;

-- Coaches can't send feedback with a new request: only admins write it.
drop policy if exists "coaches send requests" on public.drill_requests;
create policy "coaches send requests" on public.drill_requests
  for insert with check (
    public.is_team_member(team_id)
    and requested_by = auth.uid()
    and state = 'sent'
    and proposed is null and claude_note is null and reason is null
    and feedback = '[]'::jsonb
    and drafted_at is null and decided_at is null and admin_emailed_at is null and coach_emailed_at is null
    and (kind = 'change' or drill_id is null)
    and public.open_drill_requests(team_id) < 5
  );
