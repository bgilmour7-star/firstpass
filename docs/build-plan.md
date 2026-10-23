# Firstpass — Build Plan

**Links:** Technical Design doc (claude.ai artifact 6078ecbd) · Key Screens canvas (3ASaX3Hgywkq6ZjvDarYFp) · Design System + design-decisions log (A2uDduWoU7t97NmJAwFd61) · `docs/decisions/`

**Conventions:** see `CLAUDE.md`. Every task ends with `npm run check` passing, a screenshot of any changed screen (desktop and 390px, light and dark), and a commit to `main` (Vercel deploys it).

**Goal of the pilot:** Brett's team runs its season on Firstpass: plans built in minutes, used rink-side, improved by check-ins. Each milestone leaves the app usable.

---

## Milestone 1 — Drill review (admins) ✅ built 2026-10-13

- [x] 1.1 Walking skeleton: Next.js + Tailwind tokens + RinkDiagram module + local mode.
- [x] 1.2 Drill schema (`src/lib/drills/schema.ts`), status moves, tests.
- [x] 1.3 Supabase schema with RLS (`supabase/migrations/…_drill_review.sql`), magic-link sign-in, `requireAdmin()`.
- [x] 1.4 Review queue and one-drill screen: edit text, focus pips, levels or stations, diagram requests, review notes, status.
- [x] **1.5 Go live:** live at https://firstpass-jet.vercel.app (2026-10-13). Brett signed in, reviewed and approved a drill. Head coach still to be added.
- [x] **1.6 Diagram loop in practice:** done 2026-10-17 through the Supabase connector: three requests (Hot Potato Partners levels, Keep Away circles) went Open → Done with redrawn diagrams. Big multi-step writes through the connector can be cancelled at its confirmation prompt; small single-statement writes work.
- [x] **1.7 Pilot library:** done 2026-10-18: 30 drills, every Hockey Canada U7 lesson 1–12 covered by at least one. The 11 new ones (Tour Bus, Don’t Wake the Giant, British Bulldog, Cops and Robbers, Ninja Course, A Bug’s Life, Toilet Bowl Tag, Scatter Puck, Inside Out, First Shots, Reverse Gear) went into Supabase In review through the connector with Effort and Format set; `npm run drills -- validate` passes.
- [x] **1.8 Archive drills (decision 0009, 2026-10-18):** reviewers can archive a drill they don't think is good enough, with an optional reason; it leaves the library and the queue and can be restored to review. **Brett: `supabase/migrations/20261020000000_archived_drills.sql` (applied through the connector).**

## Order (agreed 2026-10-13)
Pilot first: Brett's own team plans real practices before anything for other coaches. So: **3 → 4 → 5 → 2 → 6**. Onboarding (2) waits until a second team is ready. Drills for the pilot library (1.7) are written in parallel; review pace is the real constraint.

## Milestone 3 — Team, library and plan builder
Design: canvas "Key screens" and "Plan next practice".

### 3.0 Your team, without onboarding
- [x] Tables `teams`, `team_members`, `practices` with RLS by membership (`supabase/migrations/20261014000000_teams_and_practices.sql`). **Still to do: an automated test that coach A cannot read or write team B** (needs a test Supabase project).
- [x] One plain Team page (name, skaters and group counts, coaches on the ice, usual practice length and ice). Creating the first team makes you its head coach.

### 3.10 Team favourites (decision 0012, 2026-10-18)
- [x] Any coach stars a drill for the team: star on library cards and the drill page, favourites first in the library and drawer, a Team favourites chip and drawer filter. **Brett: run `supabase/migrations/20261023000000_team_favorites.sql`.**

### 3.9 Co-coaches join (decision 0011, 2026-10-18)
- [x] Team join link (head coach turns it on, replaces or turns it off), `/join/<code>` page that survives the sign-in email, Coaches list with Remove, a "joining a team?" hint on Name your team, and non-admin coaches land on their plans. **Brett: run `supabase/migrations/20261022000000_team_join_link.sql`.**

### 3.1 Coach drill library
- [x] RLS: coaches read drills with status `live` only. (Same test gap as 3.0.)
- [x] Library page with focus filters and a read-only drill page. Later: fits our gear, known to the kids.

### 3.2 Practice plan model and builder
- [x] Plans as a JSON block list (decision 0003): drill, stations (with rotation), activity blocks.
- [x] Builder: "⋯" menu (swap, move, duplicate, remove), minutes stepper, insert between blocks, library drawer, live retiming, overtime banner with one-tap trims, minute-weighted focus, autosave. Later: drag to reorder, collapsed Stations.
- [x] **3.4 Builder rework (decision 0004, 2026-10-14):** Drill (levels per group), Stations (one diagram, one station per group), Rotation (everyone does every station) and Activity blocks; change a block's kind in place; add at any gap; Who's here today with merges, adapting every block; time card; sticky plan bar on desktop, bottom bar on phones; drag to reorder on desktop. **Brett: run `supabase/migrations/20261015000000_attendance.sql`.**
- [x] **3.6 Levels as an add-on (decision 0006, 2026-10-17):** a drill is basic (Level 1) with up to two added levels; drill review has "+ Add level"; a Drill block switches levels on and off; the whole group does them in order, sharing the minutes (amended the same day). Older drills and plans upgrade when read; no SQL to run.
- [x] **3.5 Rotation drills:** a rotation block picks one rotation drill (zones and activities ready to go). Three drafts from Hockey Canada U7 plans (Backwards Day, Puck Party, First Steps) are In review. **Brett: re-run `supabase/seed/drills.sql` to add them.**
- [x] **3.7 Rotation zones are the one source (2026-10-17):** a rotation drill's steps, cues and diagram captions are derived from its zones on every read and save; drill review drops the Steps and Cues editors for rotations, steps through zones A/B/C, shows "Min per zone" and a "What coaches see" preview. Diagram requests now show where they are (waiting for Claude, done) beside the request box, and the newest redraw sits beside the diagram it replaced with "Put the old diagram back". **Brett: run `supabase/migrations/20261017000000_request_before_diagram.sql`** (requests still work without it, minus the before/after).
- [x] **3.8 Who's worked on a plan (2026-10-17):** every save, copy and share adds to a practice's edit log (one entry per coach per 30-minute session, with a plain summary like "added Keep Away"). Plans cards show the latest change ("Kara added 2 drills · 1h ago"), the coaches' initials, empty blocks, and a dot when someone else changed it since you last opened it. **Brett: run `supabase/migrations/20261018000000_practice_activity.sql`** (plans save fine without it; the line just doesn't show).
- [x] Next practice starts as a copy of the last one; New tag on drills new to the kids; new-drill limit visible.

### 3.11 Drill requests from coaches (decision 0018, 2026-10-20)
- [x] Request a drill and Suggest a change; Claude drafts once a day (drill-requests skill, scheduled task); From coaches in Drill review with a waiting count in the nav; change view with Accept/Decline; emails to Brett (draft ready) and to the coach (outcome). **Brett: run `supabase/migrations/20261025000000_drill_requests.sql`.**

### 3.12 Landing page and waitlist (decision 0019, 2026-10-20)
- [x] Public landing page at `/`, waitlist form for coaches and associations with confirmation and alert emails, invite-only sign-up (join link or Onboarded on the waitlist), cookie-free visit counts, Admin → Analytics (Brett only), `/privacy`. **Brett: run `supabase/migrations/20261026000000_waitlist_and_analytics.sql`, and make sure hello@firstpass.coach reaches an inbox you read.**

- [x] Brand moments (decision 0020): teal close, the hero plays its drill, cones on the steps, teal text selection, the Offside 404.

### 3.13 Installable app (decision 0021, 2026-10-20)
- [x] Installs to the home screen and opens Today; Today opens with no signal; "New version ready · Reload"; install card on Today (phones) and Account → Install on your phone. **Brett: install it on your phone and open Today in airplane mode.**

- [x] **3.14 Simpler start (decision 0023, 2026-10-20):** the first plan comes ready to run from the library, no new-drill limit on the first practice, the rotation picker's minutes fixed, Draft · Ready · Done removed. Next: read-first plan and one drill picker, mocked and tested with novice coaches first.

- [x] **3.15 Read-first planner (decision 0024, 2026-10-20):** plans open to read; tap a drill for its diagram with Play, cue, history, How to run it, minutes, Swap and icon actions; Everyone rotates / Split by skill / Whole group in plain words; one Add for every kind of drill plus quick activities; one message per drill.

## Milestone 4 — Rink-side and sharing
- [x] Phone Today view: timeline, current block open with countdown (whistle countdown during stations), who is where now, "Start the clock now" for late starts.
- [x] Parent link: random 32-character token, revocable, expires after 30 days, no sign-in; parents see fun names, plain names and focus only (`supabase/migrations/20261014010000_parent_links.sql`).
- [x] Printout: letter pages, black and white, print diagrams, rotation table with whistle times.

## Milestone 5 — Check-in and the next plan
- [x] **5.1 Check-in, Strava style (decision 0007, 2026-10-18):** overall answer, lost steam and from when, standouts only (OK by default, per zone in rotations), groups ready, note; co-coaches' choices shown as initials; summary after Save; asked on Today, in Plans (last 14 days) and when opening the next plan. **Brett: run `supabase/migrations/20261019000000_checkins.sql`.**
- [x] **5.3 Email 30 min after practice (decision 0010, 2026-10-18):** a database timer every 10 minutes asks the app to send what's due; one email per coach per practice from hello@firstpass.coach through Resend, linking to the check-in; skipped for coaches who already checked in or turned it off on the Team page. **Brett: add `RESEND_API_KEY` in Vercel, then run `supabase/migrations/20261021000000_checkin_emails.sql`.**
- [x] If skipped, ask when the coach opens the next practice (with Skip).
- [x] **5.2 Feedback on the drill and the variety check (decision 0008, 2026-10-18):** Effort and Format tags on every drill (set in drill review); what coaches said last time shown on plan blocks and drawer cards (flops and lost steam warn, Big hits get a heart and a "Kids loved it" filter, older than six weeks fades); the variety check warns inside the third block in a row that's Hard, skill-with-no-game, or the same Main skill, with Swap / Add a break / Keep as is.
- [x] **5.4 Suggestions on the next plan (decision 0022, 2026-10-20):** rules from the last check-in, at most three, each on its block with Add Level / Swap it in / Other drills / Keep as is (kept for the whole team), Undo after a tap, a check-in section in the margin, a line at the top on phones. **Brett: run `supabase/migrations/20261027000000_kept_suggestions.sql`** (suggestions show without it; Keep as is explains what to run).
- [x] **5.5 Analytics: In the app and Speed (decision 0025, 2026-10-22):** Admin → Analytics gains how coaches use Firstpass (active teams and coaches, plans made, practices checked in, teams coming back, installed-app coaches, coaches per day, drills on the ice with Big hits and Flops, shares, kept suggestions, stars, drill requests) and page speed from real visits (LCP, INP, CLS by page and device). Analytics access also fixed for bgilmour7@gmail.com. **Brett: run `supabase/migrations/20261028000000_app_usage_and_speed.sql`.**
- [ ] Only then: AI suggestions through one module (Vercel AI SDK, default Claude Haiku, model in config), validated against the live library, with a 20-case eval set and a per-team monthly cap.

## Milestone 2 — Onboarding (when a second team is ready)
Design: canvas "Onboarding & home" page.

### 2.1 Teams, coaches and tenancy
Goal: a coach signs up, creates a team, and invites co-coaches.
Context: Technical Design → Data model (team, coach, season_profile). Every team-owned table carries `team_id`; RLS by membership.
Acceptance:
- [ ] Tables `teams`, `team_members(role)`, with RLS. **Test: coach A cannot read or write team B** (SQL test or integration test against a local Supabase).
- [ ] Sign-up → create team (name, age group) → invite by email.
- [ ] Admins stay separate from team roles.
Out of scope: billing (stub `plan`, `price_cents`, `currency='CAD'` only).

### 2.2 Season and practice slots
- [ ] Season dates (date picker with presets), practice slots (day, time, length, ice: half / full / it changes).
- [x] Calendar import from an iCal link (decision 0005, 2026-10-14): Team page link; Plans shows ice times with Plan it / Not ours; games left out unless planned anyway; the other team read from the event name; moved ice times move their plans. **Brett: run `supabase/migrations/20261016000000_calendar.sql`.**
- [ ] Re-check the link daily (Vercel cron). For now it's re-read when a coach opens Plans, at most hourly.

### 2.3 Groups, gear and focus
- [ ] Skater count and group counts (Eagles, Bears, Sharks) — counts only, never names.
- [ ] Coaches on the ice (sets how many stations), gear checklist, starting focus by month.
- [ ] Ends on "First practice ready" (needs Milestone 3).

## Milestone 6 — Pilot hardening
- [ ] Error tracking with phone alerts, uptime check on sign-in and Today.
- [ ] Supabase backup restore tested once. Privacy policy (coach email only; data in Canada).
- [ ] Launch readiness check before any outside team.
- [ ] Vercel Pro and Supabase Pro before outside teams.

## Later
Stripe billing (second team), parent feedback, association admin, progression chains across weeks, TeamSnap/SportNinja APIs.
