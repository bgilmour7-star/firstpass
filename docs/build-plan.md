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
- [x] **5.5 Analytics: In the app and Speed (decision 0029, 2026-10-22):** Admin → Analytics gains how coaches use Firstpass (active teams and coaches, plans made, practices checked in, teams coming back, installed-app coaches, coaches per day, drills on the ice with Big hits and Flops, shares, kept suggestions, stars, drill requests) and page speed from real visits (LCP, INP, CLS by page and device). **Brett: run `supabase/migrations/20261101000000_app_usage_and_speed.sql`.**
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

## Milestone 7 — Team progress (spec `docs/specs/team-progress.md`, 2026-11-15)

Design: canvas "Firstpass Season Goals & Evaluations". Five PRs in order; each leaves the app usable and ends with `npm run check`, screenshots (desktop and 390px, light and dark) and the pr-review skill (A, B and E get a full review: database, emails, `/admin`). Write decision **0030 · Team progress** with PR A.

### 7.1 Scoring and the report (PR A)
Goal: a coach scores the team after a practice and reads the report.
Context: spec → One-way doors P1–P3, Data model, Flows (Opening a round, Scoring, The report). Artboards "1 · After the check-in", "2 · Who moved up?", "3 · Done", "4 · Progress report is in", "5 · Today", "Progress · latest report" (desktop and phone).
- [x] **7.1.1 Content and maths.** `src/lib/progress/levels.ts` (U7 set from the project doc, version `U7-2026-11-15`), `report.ts`. Tests: level set shape; team score, spread, each coach's average, biggest gap and change from last round on the canvas numbers (November: Skating 2.7, Shooting 2.1, gap 1.0).
- [x] **7.1.2 Migration** `20261116000000_team_progress.sql`: `progress_rounds`, `progress_scores`, the two `team_members` columns, RLS, `save_progress_score`, `open_progress_rounds`, and the timer call. **Brett: run it (full SQL in the PR).** Test against a local Supabase if available, else SQL in the PR description: coach A can't read coach B's scores until A has finished; nobody can write a closed round; counts over the team size are refused.
- [x] **7.1.3 Store** `src/lib/progress/store.ts` (Supabase, and local mode in `.local/progress.json` where a round opens on read).
- [x] **7.1.4 Scoring screens** `/progress/score`: one attribute per screen, "One up" / down between levels (5 at the top), "No change · next", saves as you go, `seconds` and `no_change` recorded, resumes where you left off; first-ever scoring starts from an even spread to re-sort.
- [x] **7.1.5 Report** `/progress` (Latest report, Report picker, "N of M coaches"), locked view with "Finish your scores to see it" for coaches who haven't. **Progress** nav item (rail icon and phone drawer), shown to teams with a level set.
- [x] **7.1.6 Entry points:** check-in summary "Step 2 of 2" when a round is open and you haven't scored; Today card (who's done, your progress, Pick up where you left off; on practice days below the plan); Team page "Scores team progress" toggle per coach (head coach). "Email me about progress" (own) moves to PR B with the emails.
Acceptance: Brett scores U7 Avalanche on his phone in under 3 minutes, Kara can't see his answers until she finishes, and the report shows both once she has.

### 7.2 Emails (PR B)
Goal: the monthly rhythm runs without anyone remembering it.
Context: spec → Emails. Artboards "Email · monthly progress scoring", "Email · nudge…", "Email · November progress report".
- [x] `src/lib/email/progress-emails.ts` (three templates, table layout, branded frame) with tests: no kids' names possible, the report names only coaches who scored, turn-off link present.
- [x] **Register the three emails in `src/lib/email/journeys.ts`:** new `progress` section ("Every month: team progress") and entries `progress.scoring`, `progress.reminder`, `progress.report` exactly as in the spec, so Admin → Emails shows the journey with samples and "Send me a test". The registry test must pass.
- [x] Migration (same file or `20261117000000_progress_emails.sql`): `progress_emails`, `claim_progress_emails(secret)`, `send_progress_reminder(round)` for the head coach's button. **Brett: run it.**
- [x] Cron route sends scoring (9:00 the morning after a round opens), reminder (day 2, 18:00, once), report (day 3, 9:00, scorers only); idempotency key `progress-${kind}-${round}-${user}`; failed sends retried next run.
- [x] "Send a reminder" for the head coach on Progress (locked view and report) while someone hasn't scored. "Email me about progress" on the Team page.
Acceptance: on the pilot teams' December round, every coach gets one scoring email, non-scorers one reminder, scorers one report; Admin → Emails shows the new section with counts.

### 7.3 Goals and plan steering (PR C)
Goal: goals change what the next plans suggest.
Context: spec → P4, Flows (Goals, Steering plans), target ice-time share. Artboards "Set season goals" and "Next plan · goals in the builder".
- [x] `src/lib/progress/pace.ts` and `ice-time.ts` with tests: goal score from a spread; expected score by date; On pace / Behind this month's target / Ahead / Goal reached / Short of goal; "about N kids"; target shares with the 10% floor summing to 100%.
- [x] Migration: `progress_goals`, `set_progress_goal`, `end_progress_goal` (head coach, max 3). **Brett: run it.**
- [x] `/progress/goals`: Now and Goal columns with level descriptions, One up / down on the goal spread, plain-words line, Start from now, by date, max 3; offered after the first finished round.
- [x] Report goal cards: Oct → now → goal line (goal in teal), status, next month in kids, ice time vs target, See Thursday's plan on a goal that's behind; Change goals in the section heading.
- [x] `suggest.ts`: the goal rule (one per plan, after check-in rules, same box and buttons; a `swap` with `source: 'goal'` and key `goal:<skill>:<drill>` so Keep as is records it); plan margin "Season goals" section. Tests on the canvas case with real drills (Shooting behind: Tour Bus → Scatter Puck).
Acceptance: with a Shooting goal behind its target, Thursday's draft offers one swap to a known shooting drill and nothing changes until a coach taps.

### 7.4 Over the season (PR D)
- [x] `/progress/season` and the This report / Over the season tabs: goal line charts (full 1–5 scale), every round's scores with season change and ice-time share, monthly focus pips, biggest coach gap by month, every report linked (kept as scored, with its levels version). "Builds as you score: N of 3 months" until three rounds exist.
Acceptance: with the canvas sample (Oct–Mar) in local mode, the page matches the artboard.

### 7.5 Analytics: Progress scoring (PR E)
Goal: Brett sees whether it sticks.
Context: spec → Admin → Analytics. Artboard "Admin · Analytics · progress scoring".
- [x] Migration: `progress_usage(month)` (security definer, `can_see_analytics()`, counts only); `progress_report_views` and `progress_goal_suggestions` (report opens and goal suggestions taken). **Brett: run it.**
- [x] Section between In the app and Speed, its own jump link and Month picker: the four decide-it tiles, the four how-easily tiles, the email → report funnel (emailed, started, finished, opened the report; email opens stay in Resend), the by-team table.
Acceptance: after December's round Brett can answer "did coaches score again?" from this page alone.

### Order and dates
A and B together before the first December practice (the round opens after it), so December is the first full month of data. C right after (goals need a finished round). D any time before the third round. E alongside B, so December is measured.

## Milestone 8 — Home, Team settings and Account (decision 0031, 2026-11-16)

Design: canvas "Firstpass Team · Home, Settings and Account" (https://claude.ai/artifact/9pCPxM2UoyQuLbSsmdtSCr). Boards: "Home · next up, next practice, progress" and "Home · phone"; "Team › Settings"; "Account · your emails"; "States · next up, no plan, no round, no goals, two teams, coach view"; "Next practice · 5, 6 and 7+ drills"; "Progress on Team home · as a picture". One small database change (8.4). Four PRs; each leaves the app usable and ends with `npm run check`, screenshots (desktop and 390px, light and dark) and the pr-review skill. A, B and D get a full review (server actions, email settings, a migration); C a light one unless it grows past 400 lines.

### 8.1 Split settings out (PR A)
Goal: Home has nothing to edit; settings and your emails each have their own place.
Context: decision 0031; 0026 (drawers). Files: `src/app/(coach)/team/{page,summary,coaches,emails,calendar,actions}.tsx`, `src/app/(coach)/account/page.tsx`, `src/components/app-shell.tsx`.
- [x] **`/team/settings`**: move the section drawers from `summary.tsx` into a settings page (same `SectionDrawer`, same actions). Order: Team name, Practices and ice, Calendar, Skill groups, Coaches (with the join link, as before), Gear, Planning, Leave or delete. `?edit=<section>` works there; `/team?edit=<section>` redirects to it.
- [x] Calendar row shows the source and freshness ("Your association's calendar · Synced 2 hours ago · 22 practices to come"); the address lives inside Change.
- [x] Coaches: one ⋯ per coach (head coach only) with **Hand over head coach** (`handOverTeam`) and **Remove from team** (`removeCoach`), using the plan builder's `Menu`.
- [x] **Leave or delete** section: each button with its consequence line; Delete keeps the typed-name confirmation.
- [x] Not head coach: the same page with no Edit links, no join link, no Delete; subtitle names the head coach.
- [x] **Account → Emails**: one group per team from `myTeams` (after-practice check-in, progress). `setCheckinEmails` and the progress email setter take a `teamId` and check membership on the server; a coach can only change their own settings. Remove the email switches from the team page. Install on your phone shows on phones only.
- [x] Nav: **Home** with a house icon (rail, phone drawer, brand link label "Firstpass home"); "Team settings" in the account menu. Update copy that says "on the Team page".
Acceptance: a coach on two teams turns off progress emails for one team from Account without switching teams, and the other team's setting is unchanged; a non-head coach sees settings read-only and gets "Only the head coach…" if they post to `saveTeam` directly; coach A cannot change coach B's email settings (test the action).

### 8.2 Home: Next up and the next practice (PR B)
Goal: Home opens on the one thing to do and shows the next practice as its drills.
Context: decision 0031. Files: `src/app/(coach)/team/page.tsx`, a new `src/lib/home/next-up.ts`, `src/app/(coach)/team/home.tsx` (replaces the read-only parts of `summary.tsx`). Reuse the check-in rule from `plans/[id]/page.tsx` (`prev && recentEnough && !checkedIn`), `progressState` for an open round, ice times for unplanned ice.
- [x] `next-up.ts`: a pure function returning `checkin | score | plan | null` in that priority, with tests for each and for "nothing waiting".
- [x] Next up block (desktop row, phone stacked): title, one line, main button, Later (hides it on that device until tomorrow, `localStorage`). Open the plan is the main button only when Next up is empty.
- [x] Next practice: drills only, in order, `RinkDiagram` thumbs, start time and minutes, **Shooting goal** (focus serves a goal that is behind, from `goalsView`) and **New today** (not known to the kids). Equal widths up to 6; 7+ shows 5 and "+N more drills"; phones scroll. No plan yet: "Make a plan" as the main button, nothing to preview.
- [x] Right column (desktop): Season so far, then Coaches with Copy invite link (join link on) or Turn on invite link (head coach, off). Header: team name, one line, Settings as a text button. Remove Invite a coach and the Parents note.
Acceptance: after Sunday's practice, Home shows "How did Sunday go?" until you check in, then the December round if it's open, then Thursday's missing plan; the strip matches the plan, including the 7-drill case.

### 8.3 Home: Progress as a chart (PR C)
Goal: progress at a glance, joined to the next plan.
Context: decision 0031, 0030. Files: a new `src/components/progress-chart.tsx` (SVG, tokens only), `src/app/(coach)/team/home.tsx`.
- [x] Chart: each skill on the 1–5 scale, last round's dot to this round's (hollow to filled, joined when it moved), the value and the change (no "same"); goal skills shaded with an outlined flag at the goal, a tick where the team should be now (`pace.ts`) and Ahead/Behind in words. `role="img"` with a full sentence. Legend above. Phone layout: name and value above each track.
- [x] Sentence on top from the goals and the next plan ("Shooting needs more ice time. Sunday's plan gives it 18 of 50 minutes."); next round line and Change goals below.
- [x] States: hidden for age groups with no level set; before the first round, the "Score your first round" card; finished rounds but no goals, the chart without flags and a Set goals nudge; a coach who hasn't finished an open round sees the last report they unlocked (0030 P2).
Acceptance: with the local sample, Skating shows ahead of its tick and Shooting behind; screen readers get the sentence; light and dark both pass contrast.

### 8.4 A goal for every skill (PR D, decision 0031 · any time, smallest first)
Goal: a head coach can set a season goal on each of the six skills, not just three.
Context: 0030 P4 (max 3), `supabase/migrations/20261118000000_progress_goals.sql` (`set_progress_goal`), `src/lib/progress/store-local.ts`, `src/app/(coach)/progress/goals/{editor,page}.tsx`, `src/app/(coach)/progress/page.tsx`, `src/lib/plans/suggest.ts`, `src/lib/progress/ice-time.ts`.
- [x] Migration `20261120000000_goals_per_skill.sql`: `create or replace function public.set_progress_goal` without the 3-goal check (one active goal per skill stays). Safe to run twice. **Brett: run it (full SQL in the PR).**
- [x] Local store and the goals editor: no cap beyond one per skill; copy that says "up to three" and "of 3" counts six. The goals page lists all six skills, each with Set a goal.
- [x] Steering stays one goal suggestion per plan: pick the goal furthest behind its target this month (tie: largest gap). Ice-time targets already weight by gap; add a test with six goals that the shares still sum to 1, keep the 10% floor, and favour the largest gaps.
- [x] Home chart (8.3): every goal skill gets its flag and tick; only goals that are behind are shaded, so six goals don't shade every row. The top sentence names at most two skills, the furthest behind first.
Acceptance: a head coach sets goals on all six skills; the plan offers one swap, for the skill furthest behind; non-head coaches still can't set goals (function test).
Why: U7 is about all-round development; focus comes at later ages (Brett, 2026-11-16). A goal per skill is the expected setup, not an edge case, so the goals page offers all six and nothing warns against it.

### Order
D first (small, one migration), then A, B, C. A is the riskiest of the rest (moves server actions and email settings); B and C are UI on existing data.

## Later
Stripe billing (second team), parent feedback, association admin, progression chains across weeks, TeamSnap/SportNinja APIs.
