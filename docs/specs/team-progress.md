# Team progress: Technical Design

Status: Agreed for build · Owner: Brett · 2026-11-15
Mockups: claude.ai Design canvas "Firstpass Season Goals & Evaluations" (https://claude.ai/artifact/SryWAb6jzrVJWbTx7qZMbu). Every screen below has an artboard there; build to it.
Product decisions: Practice Plan project docs "Firstpass season insights and the team progress report" and "Firstpass U7 progress level descriptions".

## Summary

Once a month every coach scores the team: for each of the six focus attributes, how many skaters are at each U7 level (1–5). Firstpass turns that into a **progress report** (a score per attribute, the spread, each coach's average), lets the head coach set **season goals** as a target spread, works out a **monthly target**, and steers the next plans toward goals that are behind with the same rule-based suggestions as decision 0022. Three new emails carry the monthly rhythm. Brett gets a **Progress scoring** section in Admin → Analytics to see whether it sticks.

No new vendors, no AI, no child data. Everything runs on the current stack (Next.js on Vercel, Supabase in ca-central-1, Resend, pg_cron). Extra running cost: about 3 emails per coach per month, inside the current Resend plan.

Five pull requests, in order: **A** scoring and the report, **B** emails, **C** goals and plan steering, **D** over the season, **E** analytics. Each leaves the app usable.

## The bet and constraints

- **What this must prove:** that coaches score every month (the second month is the real signal) and change plans because of goals, and that teams who score keep planning in Firstpass longer than teams who don't. Brett: "building is cheap", so it's tested in the product, measured in Analytics, not by hand first.
- **Scale:** the pilot is 4 teams and about 11 coaches. Design for 50 teams; nothing here gets close to a limit.
- **Constraints:** `CLAUDE.md` (stores, RLS on every table, no child-identifiable data, migrations safe to run twice and pasted for Brett), UX patterns doc (suggest never apply, plain-word progress, Strava-style capture), CASL (emails are about the coach's own team and carry a turn-off link).

## Scope

In (all on the canvas):
1. Scoring: "Who moved up?" per attribute, one coach at a time, from the check-in or its own email, resumable.
2. The report: Progress → Latest report (desktop and phone), with a Report picker for earlier months.
3. Goals: set as a target spread after the first report; pace, monthly target in kids, status.
4. Plan steering: ice time vs target, one goal suggestion per plan.
5. Over the season: goal charts, every month's scores, monthly focus pips, coach agreement, every report.
6. Emails: scoring, reminder, report. Registered in the email journeys.
7. Today card and the check-in's second step.
8. Admin → Analytics → Progress scoring.

Cut or deferred (tech-lead pushback):
- **"Re-sort all 12" ships as the first-ever scoring only.** After that, scoring is "Who moved up?" from last month's spread. A coach who wants to start over can reset an attribute to the team's last report. Saves a second input mode in v1.
- **"Teams like yours"** waits until enough U7 teams have a full season (a dashed "Later" box on the canvas). Not built.
- **Recalled September baseline** (PM review) is not built. Revisit if coaches say the first report feels empty.
- **U5 and U9** level descriptions don't exist yet. Teams of those ages don't see Progress until their set is written; the code takes the age group so adding one is content, not code.
- **Parents and associations** see nothing. Not in this build.
- **PDF season download** and the end-of-season wrap: later.

## One-way doors

### P1. Scores are stored as counts per coach per attribute per month
`progress_rounds` (one per team per month) and `progress_scores` (one row per coach per round, all six attributes in one JSON object of five counts each). The report is always **computed** from the scores; it is never stored separately.
- Why one row per coach: a coach's scoring saves as they go, finishes once, and is read whole. Six rows would need a transaction per save for no gain.
- Why compute the report: one source of truth. "Kept as sent" is enforced by the round closing (P3), not by copying numbers.
- Counts, not kids: `[2,5,5,0,0]` means 2 at level 1 … 0 at level 5. Validated: five non-negative integers whose sum is at most the team's skater count.

### P2. A coach sees others' answers only after finishing their own
RLS on `progress_scores`: a coach reads their own row always, and teammates' rows only once their own row in that round has `finished_at`. Enforced in the database, not the page. This is what lets the report publish without waiting (Brett: "so there isn't a blocker") while keeping each coach's answers their own.

### P3. A round closes when the next one opens
A round is open from when it's created until the team's next round is created. While open, coaches can start, change and finish. Once closed, `progress_scores` for it can't be written (checked in the save function), so the report is fixed. Each round stores `levels_version`, so a report always shows the descriptions it was scored against.

### P4. Goals are a target spread, not a number
`progress_goals` stores the target counts per level and the date. The goal score is derived (the average of the spread). Monthly targets, status and the "kids up a level" line are pure functions in `src/lib/progress/pace.ts`, recomputed on read, never stored, so changing the maths later needs no migration.

Two-way doors (just decided, no record): page layout, wording, the pace tolerance, the weighting numbers, email timing.

## Data model

New migration `supabase/migrations/20261116000000_team_progress.sql` (safe to run twice; full SQL goes in the PR and is pasted for Brett).

```sql
-- One per team per month. Opened by the timer after the month's first practice (see Flows).
create table if not exists public.progress_rounds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  month date not null,                          -- first day of the month, Vancouver time
  opened_at timestamptz not null default now(),
  closed_at timestamptz,                        -- set when the next round opens
  levels_version text not null,                 -- e.g. 'U7-2026-11-15'
  skaters smallint not null,                    -- team size when opened
  unique (team_id, month)
);

-- One per coach per round. answers: {"Skating":[1,4,6,1,0], ...}; done: attributes finished.
create table if not exists public.progress_scores (
  round_id uuid not null references public.progress_rounds (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}',
  done text[] not null default '{}',
  no_change text[] not null default '{}',      -- attributes finished with "No change" (metrics)
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  seconds integer,                              -- time on the scoring screens, for the median
  primary key (round_id, user_id)
);

-- Season goals: one active goal per team per attribute, at most 3 active per team.
create table if not exists public.progress_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  attribute text not null check (attribute in ('Skating','Puck control','Passing','Shooting','Game sense','Effort & fun')),
  target smallint[] not null check (array_length(target, 1) = 5),
  by_date date not null,
  baseline_round_id uuid not null references public.progress_rounds (id),
  set_by uuid not null references auth.users (id),
  set_at timestamptz not null default now(),
  ended_at timestamptz                          -- removed or replaced; history kept
);
create unique index if not exists progress_goals_one_active on public.progress_goals (team_id, attribute) where ended_at is null;

-- Who scores and who gets the emails.
alter table public.team_members add column if not exists progress_scoring boolean not null default true;  -- head coach sets
alter table public.team_members add column if not exists progress_emails boolean not null default true;   -- each coach sets

-- One row per progress email sent (like checkin_emails), so the timer never double-sends.
create table if not exists public.progress_emails (
  round_id uuid not null references public.progress_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scoring','reminder','report')),
  sent_at timestamptz not null default now(),
  primary key (round_id, user_id, kind)
);
```

RLS (every table, all by membership through the existing helpers):
- `progress_rounds`: members read. No direct writes; rounds are created by `open_progress_rounds` (timer) only.
- `progress_scores`: a member reads their own row; reads teammates' rows in a round only if their own row in that round is finished (P2). Writes only through `save_progress_score(round, answers, done, no_change, seconds, finish)` (security definer): checks membership, `progress_scoring`, round open, counts valid against `skaters`.
- `progress_goals`: members read; insert and end only through `set_progress_goal` / `end_progress_goal`, head coach only, max 3 active.
- `progress_emails`: a coach reads their own rows. Written only by the claim function.
- Analytics reads go through `progress_usage(since)`, security definer, `can_see_analytics()` only, counts only.

Code:
- `src/lib/progress/levels.ts`: the U7 set from the project doc, keyed by age group with a version string. Test: 6 attributes × 5 levels, every line under 70 characters.
- `src/lib/progress/report.ts`: pure. Team score per attribute (mean of levels over all finished coaches' counts, one decimal), spread (sum of counts across coaches, divided by the number of coaches and rounded to whole kids for display), each coach's average, biggest gap between coaches, change from the previous round.
- `src/lib/progress/pace.ts`: pure. Goal score from the target spread; expected score at a date (straight line from the baseline round's score to the goal on `by_date`, re-based on the latest report); status (On pace if within 0.1 of expected, Ahead if 0.2 or more above, else Behind this month's target; at `by_date`, Goal reached or Short of goal); "about N more kids up a level" = round((next expected − current) × skaters).
- `src/lib/progress/ice-time.ts`: share of minutes per attribute across plans since the goal's baseline, from the existing `practiceFocus` (Main counts full minutes, Some counts half; document the rule in the file), and the target share (below).
- `src/lib/progress/store.ts` behind `src/lib/app/store.ts` conventions; local-mode store reads `content/progress/*.json` samples so `npm run dev` works without Supabase.

**Target ice-time share (rules, no AI):** every attribute starts at an even share (1/6). Each active goal adds share in proportion to its remaining gap, and one extra step if it's behind this month's target. Every attribute keeps at least 10%. Shares are normalised to 100%. The numbers live in one exported constant so they can be tuned without touching the logic.

## Flows

**Opening a round (timer).** The existing 10-minute pg_cron call (decisions 0010 and 0027) also calls `open_progress_rounds()`: for each team with a U7 level set, whose first practice of the current month (Vancouver time) has ended, and with no round for this month, it creates the round (`skaters` from `teams.groups`) and closes the team's previous round. A team's first-ever round opens the same way, so existing pilot teams start at their next practice after release.

**Scoring.** From the check-in summary ("Step 2 of 2"), the scoring email, or the Today card. `/progress/score` walks the six attributes on the "Who moved up?" screen: last report's spread for that coach (their own answers, else the team spread, else for a first-ever scoring an even start the coach re-sorts), "One up" / down between levels so the total never changes, "No change · next" in one tap. Every tap saves (debounced) through `save_progress_score`. Leaving midway is fine: the Today card says "2 of 6 attributes · saved". Finishing shows "Your November report is ready".

**The report.** `/progress` shows the latest round's report to a coach who has finished it, built from every finished coach so far ("Brett, Kara · 2 of 3 coaches"). A coach who hasn't finished sees "Kara's report is out. Finish your scores to see it" and the Start button instead. Late scores are added until the round closes. `/progress?month=2026-10` opens an earlier round (Report picker). The page's actions sit with their sections: Change goals in the goals heading, See Thursday's plan on a goal that is behind.

**Goals.** Offered after a team's first finished round (`/progress/goals`, head coach). Per attribute: Now and Goal columns with the level descriptions, "One up" to build the target spread, a plain line ("nobody below level 3, and 6 of 12 hockey stopping both ways or better"), "Start from now", up to 3 goals, `by_date` defaulting to the team's last practice in the calendar feed, else Mar 15. Changing a goal ends the old row and inserts a new one, with this round as its baseline.

**Steering plans.** In the plan builder, `src/lib/plans/suggest.ts` gains one rule, run after the check-in rules and only if fewer than 3 suggestions exist: for a goal that is behind this month's target, if this plan's share for that attribute is under target, suggest swapping the block with the most minutes in an attribute that is over its target share for a drill whose Main is the goal attribute (same block kind and part, within 2 minutes, known to the kids first, not flopped in six weeks). At most one goal suggestion per plan, in the same box and buttons as 0022. The margin's "Season goals" section shows this plan's minutes vs target and the status.

**Over the season.** `/progress/season`: a line chart per goal (full 1–5 scale; solid score, grey dashed pace line, teal goal line, orange only when behind this month's target), every round's scores in one table with season change and ice-time share, monthly focus pips, the biggest gap between coaches by month, and every report linked.

## Emails

Three new emails, sent by the cron route like the check-in email (`sentBy: 'cron'`), from `Firstpass <hello@firstpass.coach>`, each with a link to turn progress emails off (`progress_emails`). Claimed through `claim_progress_emails(secret)`, recorded in `progress_emails`, a failed send handed back for the next run, Resend idempotency key `progress-${kind}-${round_id}-${user_id}`.

| Step | When | Who | Condition at send time |
|---|---|---|---|
| Scoring | 9:00 Vancouver, the morning after the round opens | Every coach with `progress_scoring` and `progress_emails` | Not finished (a coach who scored from the check-in skips it) |
| Reminder | 2 days after the scoring email, 18:00 | Same | Not finished; also sent at once when the head coach taps "Send a reminder" (once per coach per round) |
| Report | 3 days after the scoring email, 9:00 | Coaches who have finished | At least one finished coach; never to a coach who hasn't scored (P2) |

Templates in `src/lib/email/progress-emails.ts` (`progressScoringEmail`, `progressReminderEmail`, `progressReportEmail`), copy from the canvas artboards "Email · monthly progress scoring", "Email · nudge to a coach who hasn't" and "Email · November progress report". Built with tables for email clients, the branded frame from `layout.ts`. No kids' names anywhere (there are none to include). The report email only names coaches who have finished.

### Added to the email journeys (Admin → Emails)

`src/lib/email/journeys.ts` gets a new section and three entries, so the Emails page documents them and the registry test covers the new templates:

```ts
// Section, after 'practice':
{ id: 'progress', title: 'Every month: team progress', note: 'Starts after the first practice of the month. The report only goes to coaches who have scored.' },

// Entries:
{
  id: 'progress.scoring', section: 'progress', journey: 'progress', step: 'scoring', name: 'Time for progress scoring', when: 'Morning after the month’s 1st practice',
  trigger: 'The month’s first practice ends (a round opens)', delay: 'Next morning, 9:00', condition: 'Not scored yet, progress emails on', audience: 'person', to: 'Every coach who scores', from: FIRSTPASS,
  file: 'src/lib/email/progress-emails.ts', fn: 'progressScoringEmail', sentBy: 'cron', tag: 'progress-scoring',
  preview: () => progressScoringEmail(progressSample),
},
{
  id: 'progress.reminder', section: 'progress', journey: 'progress', step: 'reminder', name: 'Scoring reminder', when: 'Day 2 · if not scored',
  trigger: 'Scoring email sent, or the head coach taps Send a reminder', delay: '2 days, 18:00', condition: 'Not scored yet, once per round', audience: 'person', to: 'Coaches who haven’t scored', from: FIRSTPASS,
  file: 'src/lib/email/progress-emails.ts', fn: 'progressReminderEmail', sentBy: 'cron', tag: 'progress-reminder',
  preview: () => progressReminderEmail(progressSample),
},
{
  id: 'progress.report', section: 'progress', journey: 'progress', step: 'report', name: 'Monthly progress report', when: 'Day 3',
  trigger: 'Scoring email sent', delay: '3 days, 9:00', condition: 'At least one coach scored; only to coaches who scored', audience: 'person', to: 'Coaches who scored', from: FIRSTPASS,
  file: 'src/lib/email/progress-emails.ts', fn: 'progressReportEmail', sentBy: 'cron', tag: 'progress-report',
  preview: () => progressReportEmail(progressReportSample),
},
```

`Section` gains `'progress'`. The Emails page's sent counts come from the Resend tags.

## Admin → Analytics → Progress scoring

A section between In the app and Speed, with its own jump link ("Landing page · In the app · Progress scoring · Speed"), drawn like the others (`SectionTitle`, `Tile`), and a Month picker because scoring is monthly. Artboard: "Admin · Analytics · progress scoring". From `progress_usage(month)`:
- **Decides it:** coaches who scored again (scored last round and this round, of those who scored last round), goal suggestions accepted (from the plan edit log and `practice_suggestions_kept`, kind `goal`), teams still planning in the last 14 days (scoring vs not; the tile says a real comparison needs about 10 teams each), coaches who scored (head coaches and assistants split).
- **How easily:** median `seconds`, share of `no_change`, teams with a goal (and how many behind), median biggest gap between coaches.
- **Funnel:** scoring emails sent → opened (Resend) → started (`progress_scores` rows) → finished → opened the report (a `report_viewed` app event through the existing usage events from decision 0029).
- **By team:** scored this month, scored again, goals, goal suggestions taken, last plan. Counts and team names only.

## Lenses

- **Cost:** $0 new. About 3 emails per coach per month (11 coaches ≈ 35 a month), well inside the Resend plan from decision 0010.
- **Privacy (PIPEDA/BC PIPA):** counts only, never a kid. Small teams can make a count identifying to a coach ("1 at level 1"), which is acceptable inside the team's coaches and why reports never go to parents or associations. Data stays in ca-central-1. Emails are about the coach's own team with a turn-off link (CASL).
- **Lock-in:** plain Postgres tables and pure TypeScript; nothing vendor-specific beyond what exists.
- **AI:** none. The goal suggestion is a rule, like 0022.
- **Design system:** uses the new `good-text` and `warn-text` tokens (`npm run ds:sync`). Orange means only behind this month's target, short at season end, or a suggestion. Line charts are a recorded exception to "pips everywhere", for trends over 3+ months only.
- **Security:** all writes through security-definer functions that check membership and role; P2 enforced in RLS; the timer uses the existing private `cron_secret`.
- **Operability:** one more call in the existing timer; claims and retries like the check-in email; every function safe to run twice.

## Risks

1. **Coaches don't come back for month two.** That's the bet; Analytics shows it by the first January round. Trigger to rethink: fewer than half of November's scorers score in December.
2. **Scores drift because coaches read levels differently.** Biggest gap between coaches is on the dashboard; if it stays above 0.8, rewrite the level lines.
3. **A round opens on a practice the team didn't run** (calendar import of a cancelled ice time). Only planned practices with at least one block count, like the check-in email.
4. **Teams with fewer than 3 reports** see an empty-looking Over the season. It shows "Builds as you score: 1 of 3 months" until there are three.

## Confirmed (Brett, 2026-11-15)

1. **The report email goes on day 3, only to coaches who have scored.** A coach who scores later sees the report in the app.
2. **Every coach is invited to score by default;** the head coach can turn a helper off on the Team page. The dashboard shows whether assistants score.
3. **Goals belong to the head coach** (set, change, remove). Other coaches see them.
4. **The round opens when the month's first planned practice ends,** not on the 1st, so the email arrives after a fresh look at the kids.
5. **Teams only see Progress once their age group has a level set** (U7 now).

## Not doing now

Teams like yours; recalled baseline; parents' view; association rollup; PDF and season wrap; re-sorting after the first scoring; AI suggestions; per-zone goal suggestions inside rotations.
