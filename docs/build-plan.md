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
- [ ] **1.5 Go live (Brett, ~20 min):** follow `docs/setup.md`. Done when Brett and the head coach can sign in and see six drills.
- [ ] **1.6 Diagram loop in practice:** give Claude Supabase access (setup step 5), work the first real request end to end. Done when a request goes Open → Done with a redrawn diagram.
- [ ] **1.7 Pilot library:** encode ~30 drills for the first six weeks (Hockey Canada U7 plans 1–12 first), each from its source. Done when 30 drills are In review and `npm run drills -- validate` passes.

## Milestone 2 — Team setup (onboarding)
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
- [ ] Calendar import from an iCal link (TeamSnap, Google, association feed): detect practices, coach confirms, games left out, shared-ice opponent read from the event name.
- [ ] Re-check the link daily (Vercel cron) so moved ice times update.

### 2.3 Groups, gear and focus
- [ ] Skater count and group counts (Eagles, Bears, Sharks) — counts only, never names.
- [ ] Coaches on the ice (sets how many stations), gear checklist, starting focus by month.
- [ ] Ends on "First practice ready" (needs Milestone 3).

## Milestone 3 — Library and plan builder
Design: canvas "Key screens" and "Plan next practice".

### 3.1 Coach drill library
- [ ] RLS: coaches read drills with status `live` only. **Test: a coach cannot read a draft drill.**
- [ ] Library page: focus filters in pips, fits our gear, known to the kids, fun name with plain name.

### 3.2 Practice plan model and builder
- [ ] `practice_plans` + `plan_blocks` (drill, minutes, kind: all / drill / stations / water / scrimmage), stations with rotation.
- [ ] Builder: drag, "⋯" menu (swap, minutes, duplicate, move, remove), insert between blocks, library drawer for swap/add, live retiming with overtime banner, focus summary minute-weighted.
- [ ] Next practice starts as a copy of the last one; New tag on drills new to the kids; new-drill limit visible.

## Milestone 4 — Rink-side and sharing
- [ ] Phone Today view: timeline, current block expanded with countdown, stations "who is where".
- [ ] Parent link: capability token (random, revocable, expires), no sign-in, team-level only.
- [ ] Printout: two letter pages, black and white (RinkDiagram `detail: 'print'`).

## Milestone 5 — Check-in and the next plan
- [ ] Push/email 30 min after practice; one tap per drill (Flopped / OK / Big hit), reasons, "Ready for harder?" by group.
- [ ] If skipped, ask when the coach opens the next practice.
- [ ] Suggestions on the next plan from check-in data, **rules first** (too much waiting → swap for a station drill; group ready → move up a level).
- [ ] Only then: AI suggestions through one module (Vercel AI SDK, default Claude Haiku, model in config), validated against the live library, with a 20-case eval set and a per-team monthly cap.

## Milestone 6 — Pilot hardening
- [ ] Error tracking with phone alerts, uptime check on sign-in and Today.
- [ ] Supabase backup restore tested once. Privacy policy (coach email only; data in Canada).
- [ ] Launch readiness check before any outside team.
- [ ] Vercel Pro and Supabase Pro before outside teams.

## Later
Stripe billing (second team), parent feedback, association admin, progression chains across weeks, TeamSnap/SportNinja APIs.
