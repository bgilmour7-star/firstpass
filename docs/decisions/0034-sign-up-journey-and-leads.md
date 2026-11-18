# 0034 · The sign-up email journey, and Leads instead of Waitlist

Date: 2026-11-18 · Decided by: Brett ("Since we are removing the waitlist, we also need to update the analytics
section… waitlist tab can be removed (double check that), and email tab which needs the waitlist journey updated to be
a create account journey. I still want to send the survey for new sign ups.") · Follows 0033; changes 0027's journeys

## Decision
- **Everyone who creates an account gets Brett's welcome with the survey, an hour after confirming their email**
  (follow-up, 2026-11-18: right away landed before most had made a team, and next to the invite emails), and a nudge on day 3 if they
  haven't answered. That includes coaches who join through an invite link (Brett: everyone who creates an account).
  Admins and people who already answered are skipped. Only accounts made after
  `supabase/migrations/20261121000000_signup_journey.sql` first runs are emailed (`private.settings.signup_journey_from`),
  and only once the email is confirmed.
- **The sign-up survey is the "before Firstpass" version** (how you plan practices today, what's hard), the one the
  waitlist got. It keeps the stored audience `'waitlist'` so no check constraints change; screens and admin pages call it
  the sign-up survey. Its thank-you links back to Firstpass instead of to sign-up.
- **The first-practice email waits for the sign-up emails.** A coach in the sign-up journey is only queued for it once
  their nudge has gone (or the welcome was skipped), and at least 4 days after the nudge, so nobody gets two survey asks
  in the same few days. It's skipped anyway once they've answered.
- **The waitlist series is removed**, templates and registry entries. Anything left in the outbox skips as
  `not-registered`.
- **The Waitlist tab is now Leads** (`/admin/leads`; `/admin/waitlist` redirects). It can't go: the landing page's "Run an
  association?" form still saves to the waitlist table, and this is the only place to see and track those leads.
  Associations come first; the old waitlist coaches sit below as history.
- **Analytics counts new accounts.** The headline tile and the bars under visits are new accounts per day (confirmed,
  admins left out, from `analytics_growth`); the funnel adds "Created an account" between the tap and the team. Leads by
  source stay in the sources table. "Who's signing up" is now "Who's visiting" (devices, regions, association leads);
  coaches' age groups came from the old waitlist form and are gone.

## Why
- With the waitlist gone, the only survey ask left was 2 days after a first practice, so anyone who signed up and never
  ran a practice was never asked anything. Those are the people Firstpass most needs to hear from.

## Follow-up (2026-11-18, after the review of PR #47)
- Welcome an hour after confirming (`20261122000000_signup_welcome_delay.sql`); the nudge subject is "3 minutes on how
  you plan practices?" to match its body; the funnel note no longer compares accounts with teams (invited coaches make
  accounts but no team); local-mode email stats use the sign-up journey; unused summary values removed.

## Not done
- The $10 Tim Hortons card is still offered in the sign-up emails and owed on every answer. Open sign-up means that
  cost grows with sign-ups; Brett to decide whether to keep it.
- Coaches' age groups on Analytics could come back from teams' age groups.
