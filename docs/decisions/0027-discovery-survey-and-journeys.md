# 0027 · Discovery: one person record, a 7-question survey, email journeys as code

Date: 2026-10-29 · Decided by: Brett (technical design "Teams and discovery", one-way doors D3 and D4; canvas "Firstpass Teams & Discovery", E1–E4, S1–S4, A1–A3)

## Decision
- **One person across waitlist and account (D3).** `research_people` holds one row per email (lower-case), with a
  pseudonymous `code` (`c-0101`, from a sequence), the waitlist row and the auth user when they exist, the first name and
  `audience` (`waitlist` or `coach`). Rows are made by database triggers: after insert on `waitlist` and after insert on
  `auth.users`, upserting on email. A trigger can never fail a sign-up: errors become warnings. Survey answers, notes,
  themes and email sends all hang off `person_id`, and deleting the person cascades to all of them.
- **The repo only ever sees the code, first name, team and age group.** `npm run research -- sync`
  (`scripts/research.ts`, service role key) writes `research/coaches/<code>.md` and `research/themes.md`, deletes files
  for removed people, and scrubs emails and phone numbers out of free text too. A test feeds it contact details hidden in
  names, answers, notes and team names and checks none come out.
- **Email journeys are code (D4).** `src/lib/email/journeys.ts` registers every email Firstpass sends: the five discovery
  steps, the waitlist alert, invite, coach joined, check-in, the two drill-request emails and the four Supabase templates
  (moved from the script into `src/lib/email/supabase-templates.ts` so they can be shown). Each entry has its journey,
  step, trigger, delay, condition, audience, sender, template and a sample. Admin → Emails is drawn from it, and a test
  fails when a template function in `src/lib/email/` isn't registered.
- **The outbox.** `email_sends` has one row per journey step per person (`unique (journey, step, person_id)`). The waitlist
  trigger queues welcome (now), nudge (+3 days) and last ask (+7 days). `/api/cron/emails`, every 10 minutes by pg_cron with
  the existing `cron_secret` (the decision 0010 pattern), runs `enqueue_discovery_emails` (coach first-practice 2 days after
  their first practice on any team ends, coach nudge 3 days after that), then `claim_due_emails`, checks each entry's
  condition at send time, sends through Resend with idempotency key `${journey}-${step}-${person_id}`, and marks it sent,
  skipped (with a reason) or released for the next run. A claim left over 30 minutes is claimed again.
- **The welcome replaces the old confirmation** and goes out on the next timer run (within 10 minutes) rather than in the
  sign-up request. Sending it in the request would need an anonymous function that hands out a person's survey and
  unsubscribe tokens by email address; ten minutes is fine for a thank-you.
- **Discovery emails come from "Brett at Firstpass"** with Brett's copy word for word, an unsubscribe link in every one and
  a `List-Unsubscribe` header. Unsubscribing sets `unsubscribed_at` and skips anything queued; practice emails aren't
  affected. The unsubscribe page asks for a tap, so mail scanners that open links can't unsubscribe anyone.
- **The survey** is `/s/<token>`: public, phone first, one question per screen, 7 questions. Coaches already using
  Firstpass get Q3 "How much of Firstpass's plan did you change for your last practice?" and Q6 "What's missing, or got in
  your way?" (stored in `extra`). Every free-text field says "No kids' names, please." `submit_survey` marks the invite used,
  owes a gift card, sets the call to book when they said yes, and skips the rest of their survey emails.
- **Brett only.** Every new table has RLS on `can_see_analytics()`, and the admin pages call `requireAnalytics()`. Admin
  has tabs Analytics · Survey · Coaches · Emails on those pages (the waitlist stays inside Analytics). Coaches' usage comes
  from `discovery_usage()`, a security-definer function that returns counts only. `older_team_interest` (PR 2) is read if
  it exists and shown as U11+.
- **Themes** are counted on the page; the daily "Firstpass daily sign-ups" task tags them from `insight_themes`. A theme Brett
  types on a response or note is added to that list, since typing it is approving it.

## Why
The pilot has to show whether coaches keep using Firstpass and would pay, and what they struggle with. Answers, calls and
behaviour belong to one person whether they came from the waitlist or an invite, and a pseudonymous copy in the repo lets
Claude read across them without ever holding contact details.

## Changes from the technical design
- `research_people.email` is `text` with a lower-case check rather than `citext`: comparisons inside security-definer
  functions (empty `search_path`) stay predictable, and every write lower-cases it.
- `research_people.unsubscribe_token` was added: the unsubscribe link needs a token that isn't the person's id.
- `survey_invites` has `unique (person_id, audience)` and the token defaults to 32 random hex characters.
- The coach nudge is written in the voice of E2 (there was no artboard for it).
- The waitlist nudge and last ask also skip someone who has since created an account (they get the coach journey).

## Not done
- Gift cards are sent by hand; replies are pasted as Email notes (spec scope).
- Admin → Emails counts come from the outbox, so only the discovery steps show "sent" numbers.
- Brett should check the U9/U11+ mix on the Survey page once PR 2's `older_team_interest` is live.
