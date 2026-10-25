# Teams and discovery: Technical Design

Status: Agreed for build · Owner: Brett · 2026-10-25
Mockups: claude.ai Design canvas "Firstpass Teams & Discovery" (https://claude.ai/artifact/6LvweDRFfVVadk2HWutnft). Every screen below has an artboard there; build to it.

## Summary

Five things ship in three pull requests, built in parallel from this spec:

1. **Drill age groups** (PR 1). Drills say which ages they suit (U5, U7, U9, multi-select, set in drill review). A coach's library shows only drills for their team's age. Stored in the drill's JSON content. No SQL.
2. **Teams** (PR 2). A coach can be on more than one team. Team becomes the first nav item and the home page, read-only, with one section edited at a time in a drawer. "Create a team" in the team switcher runs a one-question-per-screen wizard. U11+ coaches get a short discovery screen instead of a dead end.
3. **Discovery** (PR 3). A survey (7 questions, no sign-in) and an email sequence for two audiences: waitlist sign-ups and coaches already using Firstpass. Answers, Brett's call notes and themes live in one place per person. Admin gets Survey, Coaches and Emails pages. Notes sync to the repo, without contact details, so AI can use them.

No new vendors. Everything runs on the current stack (Next.js on Vercel, Supabase in ca-central-1, Resend, pg_cron). Extra running cost is gift cards ($10 per completed survey) and Resend volume within the current plan.

## The bet and constraints

- **What this must prove:** whether coaches who try Firstpass keep using it and would pay, and what they struggle with. The strongest signals are behaviour: a coach creating a second team, a U9 team signing up, coaches booking calls.
- **Scale:** pilot. Tens of coaches and teams this season, a few hundred emails a month. Design for 10x that, no more.
- **Constraints:** existing stack and conventions (`CLAUDE.md`), RLS on every table, no child-identifiable data, migrations safe to run twice and pasted for Brett to run, CASL for commercial email (consent and unsubscribe), Canadian data residency (Supabase ca-central-1).
- **Assumptions:** waitlist sign-up counts as consent for the 3 discovery emails (express consent, they asked to hear from us), each with an unsubscribe. Gift cards are bought and sent by hand by Brett. Only Brett reads discovery data.

## Scope

In:
- Everything on the canvas, with the two cuts below.

Cut or changed (tech-lead pushback):
- **A fourth skill group is deferred.** Groups today are three fixed slots (`GROUPS = Sharks, Bears, Eagles`) that drill levels, stations, rotations, attendance and check-ins all key off. A fourth slot touches every one of those, and half ice has only three station zones. This build does **1 to 3 groups with team-chosen names**: the slots stay as internal keys (easiest to hardest), and each team gives them display names. "Add a group" stops at 3 with "3 is the most for now". Revisit if a team asks for 4.
- **Email replies are not captured automatically.** A reply lands in hello@firstpass.coach. Brett pastes anything useful as a note (type Email) on the coach's page. Revisit if replies get frequent.

Non-goals: billing, a public team directory or join requests (joining is invite only), sending gift cards automatically, AI-written suggestions.

## One-way doors

### D1. A coach can be on several teams (PR 2)
Today `join_team` raises `on-another-team` and `myTeam(userId)` returns one team. Change:
- `team_members` stays as is (it already allows several rows per user). Drop the `on-another-team` check from `join_team` (create or replace the function).
- **Active team:** a cookie `fp_team` holds the team id. `requireTeam()` reads it, checks membership through the store, and falls back to the coach's most recently joined team. Switching team sets the cookie. Never trust the cookie without the membership check.
- Store: `myTeams(userId): Promise<Team[]>` (newest membership first) and `myTeam(userId, teamId?)`. Keep every existing caller working.
- RLS needs no change: it is already by membership.

### D2. Group names per team (PR 2)
- Team gets `groupNames: Record<'Sharks'|'Bears'|'Eagles', string>` (stored in the existing `teams.groups` jsonb as a `name` on each entry; default the slot name). Every screen that shows a group name reads it through one helper, `groupLabel(team, slot)`.
- A team can turn groups off: `groups` keeps three entries; an entry with `skaters: 0` and `off: true` is hidden everywhere and treated like an absent group in `todayUnits`.
- Plans, drills and check-ins keep storing slot keys. Nothing already saved changes.

### D3. One person record across waitlist and account (PR 3)
Discovery data hangs off a person, because the same coach can be a waitlist entry first and an account later.
- `research_people`: `id uuid`, `code text unique` (pseudonymous, like `c-0142`, made from a sequence), `email citext unique`, `user_id uuid null` (auth user), `waitlist_id uuid null`, `first_name text null`, `audience text check in ('waitlist','coach')`, `unsubscribed_at timestamptz null`, `created_at`.
- Linked by email when an account is created or a waitlist entry is made (upsert on email). The survey, notes, themes and email sends all reference `person_id`.
- **The repo only ever sees `code`, first name, team and age group. Never email, phone or user id.**

### D4. Email journeys are code (PR 3)
`src/lib/email/journeys.ts` is the single registry. Each email declares its journey, step, trigger, delay, condition, audience, from, template function and a sample for previews. The admin Emails page is drawn from it, and a test fails if any template in `src/lib/email/` that sends to people is not registered. Adding or changing a journey means editing the registry, so the page documents itself.

## Data model

All new tables have RLS on. Admin-only tables use `public.is_admin()` for select/insert/update/delete. Discovery data is Brett only on screen (same rule as Analytics), enforced in `requireBrett()` style the way Analytics already does it.

### PR 1: drills (no SQL)
Drill content (`src/lib/drills/schema.ts`):
- `ageGroups: z.array(z.enum(['U5','U7','U9'])).min(1).default(['U7'])`. Existing drills read as `['U7']`.
- `startLevel: z.record(z.enum(['U5','U7','U9']), z.number().int().min(1).max(3)).optional()`: the level a team of that age starts at (Ski Racer: `{ U9: 2 }`). Default 1.

### PR 2: teams
Migration `supabase/migrations/20261028000000_multi_team_and_older_interest.sql`:
- Replace `public.join_team(code)` without the `on-another-team` check.
- `create_team` (if creation goes through a function today) allows a coach who already has a team.
- `older_team_interest`: `id uuid`, `user_id uuid not null default auth.uid()`, `age_group text check in ('U11','U13','U15+')`, `hardest_part text`, `wants_call boolean`, `created_at`. RLS: insert own row; select own row or admin.

### PR 3: discovery
Migration `supabase/migrations/20261029000000_discovery.sql`:
- `research_people` (D3).
- `survey_invites`: `token text primary key` (32 random chars), `person_id`, `audience`, `created_at`, `used_at`. Public pages read through a `security definer` function by token, never by table select.
- `survey_responses`: `id`, `person_id`, `audience ('waitlist','coach','older')`, `role text`, `age_groups text[]`, `planned_how text`, `planned_when text`, `hardest_part text`, `wants_help text`, `extra jsonb` (Q3/Q6 swaps for coaches), `wants_call boolean`, `call_times text[]`, `phone text null`, `call_status ('none','to_book','booked','done')`, `gift_card ('owed','sent','not_offered')`, `themes text[] default '{}'`, `created_at`. Inserted by a `security definer` function given a valid unused token.
- `coach_notes`: `id`, `person_id`, `kind ('call','rink','email','other')`, `body text`, `themes text[]`, `created_at`, `created_by uuid`.
- `insight_themes`: `name text primary key`, `created_at`. The daily task reuses existing names and only adds one when Brett approves it in the summary.
- `email_sends` (the outbox): `id`, `journey text`, `step text`, `person_id`, `due_at`, `claimed_at`, `sent_at`, `skipped_reason text null`, `unique (journey, step, person_id)`. Claimed and sent by the cron route, like check-in emails.
- `older_team_interest` rows (from PR 2) appear on the Survey page as audience `older`; PR 3 reads them with a left join and must work if PR 2 hasn't merged yet (table missing → none).

Personal data: emails, first names, phone (optional, call only), free-text answers and notes. All in ca-central-1. No children's data: every free-text field shows "No kids' names, please."

## How the pieces work

### Survey (PR 3)
- `/s/[token]`: public, no sign-in, phone first, one question per screen, 7 questions, as on the canvas. Coaches already using Firstpass get the two swapped questions (Q3 "How much of Firstpass's plan did you change for your last practice?", Q6 "What's missing, or got in your way?").
- Submitting marks the invite used, creates the response with `gift_card = 'owed'` and `call_status = 'to_book'` when they said yes, and stops that person's remaining survey emails.
- Thanks screen as on the canvas.

### Email journeys (PR 3)
Registry entries (journey · step · when · condition):
- `waitlist` · `welcome` · on sign-up · always. **Replaces** the current waitlist confirmation email (it now also says Brett will be in touch).
- `waitlist` · `nudge` · +3 days · survey not done and not unsubscribed.
- `waitlist` · `last-ask` · +7 days · same.
- `coach` · `first-practice` · 2 days after the coach's first practice on any team ends · not an admin, survey not done.
- `coach` · `nudge` · +3 days after `first-practice` · survey not done. No day 7 for coaches.
- Existing emails are registered too (invite, coach joined, sign-in code, password, check-in, drill request emails, waitlist alert) so the Emails page shows everything.

Sending: `/api/cron/emails`, called every 10 minutes by pg_cron with the existing `cron_secret` pattern. It calls `enqueue_discovery_emails` (adds due `coach` steps) then `claim_due_emails`, renders each through the registry, sends through Resend with idempotency key `${journey}-${step}-${person_id}`, and marks sent or releases on failure. Conditions are checked at send time, so a survey finished after queueing skips the rest. Every discovery email has an unsubscribe link (`/unsubscribe/[token]`) that sets `unsubscribed_at`; practice emails are not affected.

### Themes (PR 3 + the daily scheduled task)
The page only counts `themes` arrays. Tagging is done each morning by the existing "Firstpass daily sign-ups" scheduled task through the Supabase connector: for new responses and notes, pick from `insight_themes`, and list "new theme?" candidates in the summary for Brett to approve. Brett can edit themes on a response or note in the admin page.

### Research sync (PR 3)
`npm run research -- sync` (`scripts/research.ts`, service role key, scripts only) writes `research/coaches/<code>.md` per person (situation, usage, survey answers, notes, themes; first name, team, age group; no contact details) and `research/themes.md` (counts and short quotes). The daily task runs it and commits to `main`. A test checks the writer never outputs an email address or phone number.

### Admin pages (PR 3)
Under `/admin`, Brett only, tabs Analytics · Waitlist · Survey · Coaches · Emails (Waitlist can stay inside Analytics if that's how it is today; add the tab only if it's already a page).
- **Survey:** counts, filter chips (All, Wants a call, Card to send, U7, U9, Waitlist, Using it, U11+), the answers with hardest part first, Mark booked and Card sent, Common themes in the margin (tap to filter), planning and who-answered counts, CSV download.
- **Coaches:** list, and one page per person: add a note (kind, body), timeline (notes, survey, joined), situation, usage (practices run, check-ins, drills swapped, last active) from existing tables, and the repo file path.
- **Emails:** journeys as rows from the registry, the selected email rendered in the margin at reading size, Send me a test (to the signed-in admin).

### Teams (PR 2)
- Nav: Team first; signed-in coaches land on `/team` (except phones on practice day, which open `/today`, per the canvas reply). Team switcher in the rail and phone drawer: the coach's teams, then **Create a team**.
- `/team` read-only: next practice, practices and ice, skill groups (names and counts), coaches, gear, planning, join link, season so far, leave or delete at the bottom. Each section's Edit opens a drawer (bottom sheet on phones) editing only that section, reusing today's form logic.
- `/team/new`: Name → Copy settings (only if they have a team) → Age → Ice times → Skill groups (1–3, names editable, suggestions Eagles/Bears/Sharks) → Coaches (invite by email; teammates from other teams offered as chips) → Gear (skipped when copied) → Focus → Check and build. Progress as "3 of 8 · Age group". Each screen prefilled with a guess and its reason. Creating the team makes the coach head coach, sets the active-team cookie, builds the first practice (decision 0023) and lands on it.
- Age screen: U5, U7, U9, and "U11 or older" opening the discovery screen that writes `older_team_interest` and offers "I coach a younger team too".
- New accounts stay invite-only (decision 0019). A signed-in coach can always create a team.

### Drill age groups (PR 1)
- Drill review: Age groups multi-select (U5, U7, U9) and "U9 teams start at" when U9 is ticked and the drill has levels.
- Coach library, the add-a-drill drawer, swaps and suggestions use only drills whose `ageGroups` include the team's age. No age toggle for coaches.
- **U9 with few drills:** until there are 10 live U9 drills, a U9 team also sees U7 drills that have levels, starting at their top level, with one line: "U9 drills are new. Until there are more, you'll also see U7 drills at their harder levels." Remove the fallback by changing one constant.
- First-plan generation (decision 0023) uses the same filter.

## Lenses

- **Cost:** no new services. Gift cards: $10 × completed surveys (30 surveys = $300). Resend volume roughly 4 emails per new person; fine at pilot scale, check the plan limit before inviting associations.
- **Privacy:** CASL: consent at waitlist sign-up and account creation; sender identified; unsubscribe in every discovery email, honoured at send time. PIPEDA/PIPA: purpose stated on the survey ("to decide what to build"), data in Canada, deletion on request removes the person row and cascades to responses, notes and sends; the repo copy is pseudonymous, and the daily sync deletes files for removed people. Privacy page gets one paragraph on the survey and calls.
- **Lock-in:** none added. Email stays behind the registry and one send function, so Resend is swappable.
- **AI:** theme tagging runs in the existing scheduled task, not in the app. No per-request model cost in the product.
- **Design system:** tokens and components only, `RinkDiagram` for every rink, patterns from "Firstpass UX patterns".
- **Security:** admin pages call `requireAdmin()` plus the Brett-only check. Public survey and unsubscribe only through token functions. Service key only in `scripts/`.

## Build rules for all three PRs

- Follow `CLAUDE.md`. Local mode must keep working: add the new store methods to `store-local.ts` too.
- One decision record each: PR 1 → `0025-drill-age-groups.md`, PR 2 → `0026-teams-home-and-create-a-team.md`, PR 3 → `0027-discovery-survey-and-journeys.md`. Don't edit `docs/build-plan.md` (Brett's lead updates it after merging).
- Migration names as above. Each migration safe to run twice.
- `npm run check` passes. Screenshots of every new or changed screen at desktop and 390px, light and dark, attached to the PR.
- Branches: `feat/drill-age-groups`, `feat/teams`, `feat/discovery`. One PR each against `main`.
- Shared files: PR 2 owns `src/components/app-shell.tsx` and `src/lib/auth.ts`; PR 3 owns `src/app/admin/layout.tsx` and `src/lib/email/`; PR 1 owns `src/lib/drills/schema.ts`. If you must touch another PR's file, keep the change small and say so in the PR.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Active-team cookie bugs show the wrong team | Medium | High | Membership checked on every read; tests for switching and for a removed membership |
| Survey emails feel spammy to pilot coaches | Medium | Medium | Coaches get 2 emails, not 3; unsubscribe; send only after a real practice |
| Theme tagging drifts into too many themes | Medium | Low | Fixed list, new themes need Brett's yes |
| Repo files leak contact details | Low | High | Writer test; pseudonymous codes only |
| U9 coaches see too few drills | High | Medium | U7-with-levels fallback; the U9 drills scheduled task |

## Phasing

1. PR 1 (age groups) and PR 3's tables and survey can go first; PR 2 is the largest.
2. Merge order: PR 1 → PR 2 → PR 3. Brett runs the SQL for PR 2 and PR 3.
3. Then update the scheduled tasks ("Firstpass daily sign-ups" tags themes and runs the research sync; "Firstpass U9 drills" sets `ageGroups: ['U9']`).
