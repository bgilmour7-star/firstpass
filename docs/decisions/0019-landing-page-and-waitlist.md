# 0019 · A public landing page, a waitlist, and invite-only sign-up

Date: 2026-10-20 · Decided by: Brett

## Decision
- **firstpass.coach is a public landing page** for signed-out visitors (`/`); signed-in coaches still go straight to
  their plans. One promise, "Show up ready", proved with the product: real library drills drawn by RinkDiagram (Puck
  Party in the hero, Ski Racer's three levels), crops of real screens, no photos. Copy and layout follow the
  "Firstpass landing page plan" project doc and the "Firstpass Landing Page" design canvas.
- **U5–U9** in the copy. **No affiliations** named on public pages: drills are "adapted from the skills young
  players already learn", and each drill still credits its source inside the app.
- **One action: Join the waitlist** (labelled "Get early access" since 2026-10-26, PR #19; still the waitlist underneath). One form, two paths: *I coach a team* (email, age group, team optional) or
  *I run an association* (email, association, number of U5–U9 teams). Joining again updates the row, never errors.
  The person gets a confirmation email; every sign-up also emails **hello@firstpass.coach** (`WAITLIST_ALERT_TO`
  to change it), and Brett emails each person himself to book a call.
- **Sign-up is invite-only while the waitlist runs.** A new email can create an account only with a working team
  join link, or once Brett has set its waitlist status to **Onboarded**. Everyone else sees "Firstpass is
  invite-only for now" with Join the waitlist. Checked in the app's sign-in actions (`invited()` in
  `src/app/login/actions.ts`); before the migration has run, it fails closed.
- **Visits are counted without cookies** in our own tables (`page_events`), not a third-party script. A visitor is
  a SHA-256 of IP + browser + a salt that changes every Vancouver day; salts live in `private.visit_salts` and old
  ones are deleted, and the IP and browser string are never stored. Uniques are exact within a day and an estimate
  across days. Bots and headless browsers aren't counted. Events: view, reached the form, started the form, signed up.
  Since 2026-10-26 a visit is recorded only after a sign of a person (scroll, tap, key, mouse move), and not
  at all for browsers that report automation: monitoring services were loading the page from data centres
  every few hours. Earlier robot visits are marked `automated` (not deleted) and left out of Analytics.
- **Admin → Analytics is Brett's only** (`admins.analytics`, `can_see_analytics()`), because the waitlist holds
  personal emails: headline numbers against the previous period, visits per day with sign-ups, the funnel, sources,
  who's signing up, and the waitlist with a status per row (New → Emailed → Call booked → Onboarded / Not a fit).
- A plain **privacy page** at `/privacy`.
- **Share card** (`public/og/firstpass-landing.png`, 1200×630): the hero's Puck Party rotation drawn by RinkDiagram in
  the light palette beside "Show up ready." on `rink-200`. A static render; redo it if the hero drill changes.

## Why
Brett wants a short public page with impactful copy and imagery, a way for coaches and associations to show
interest before billing exists, and basic numbers (visits, unique users, sign-ups) in the admin dashboard he already
uses. Counting ourselves keeps the numbers next to the waitlist and avoids a cookie banner.

## Not done (yet)
- Supabase's own sign-up endpoint is still open to someone calling the API directly with the public key. The app
  never does; a "before user created" auth hook would close it if that ever matters.
- No booking link on the page: Brett emails each person.
