# 0030 · Team progress: monthly scoring by counts, a report each coach unlocks by scoring

Date: 2026-11-15 · Decided by: Brett (season insights discussion, canvas "Firstpass Season Goals & Evaluations", spec `docs/specs/team-progress.md`)

## Decision
- **Once a month every coach scores the team** on the six attributes (Skating, Puck control, Passing, Shooting, Game
  sense, Effort & fun): for each one, how many skaters are at each of five levels. **Counts only, never a kid**
  (CLAUDE.md). Levels are written per age group (`src/lib/progress/levels.ts`, U7 first, version `U7-2026-11-15`); a team
  sees Progress only when its age group has a set.
- **A round opens when the team's first planned practice of the month ends** (`open_progress_rounds()`, every 10
  minutes) and closes when the next month's opens. The round keeps the team size and level version it opened with.
- **"Who moved up?"** One attribute per screen, starting from the coach's own last spread (or the team's, or an even
  start the first time); "One up" / down moves one skater and keeps the total. "No change · next" is one tap. Saved as
  you go; time taken and "no change" are kept for analytics.
- **Each coach scores on their own first (P2).** RLS shows a coach their own scores, and teammates' scores in a round only
  once they've finished their own. `progress_round_status()` gives "1 of 3 done" without anyone's answers.
- **The report is never blocked by other coaches.** It is computed in the app from whoever has finished: team score
  (everyone's skaters averaged), kids at each level, each coach's average side by side, a flag when coaches are a level
  or more apart, and the change from last month. Monthly reports stay as they were scored; the picker shows each month.
- **Writes only through functions:** `save_progress_score` checks the round is open, the coach scores on that team, and
  every attribute's counts are five non-negative numbers adding up to no more than the team. A finished score stays
  finished. The head coach turns scoring on or off per coach (`set_progress_scoring`); everyone is on by default.
- **A coach can change their answers until the month closes, even after finishing** and seeing teammates' answers
  (Brett, 2026-11-15). The app doesn't offer it as a button yet; the report always uses each coach's latest answers.

## Why
Coaches want to see the season move, and goals need a baseline. Counting kids per level is fast, needs no names, and
gives a spread rather than one number, so it's honest about a mixed group. Scoring on your own first keeps answers
independent, which is what makes the side-by-side useful.

## Emails (PR B, 2026-11-15)
- Three emails ride the check-in emails' 10-minute timer: **scoring** (day 1 after the round opens, 9:00), **reminder**
  (day 3, 18:00, or straight away when the head coach taps it; once per coach), **report** (day 4, 9:00, only to
  coaches who had finished by then). Days counted in Vancouver time from the day the round opened. Nothing goes for a
  closed round or one over 20 days old. Each coach turns them off on the Team page (`progress_emails`).
- The cron route never sees a key: the database checks the timer's secret, hands over coaches' first names and the
  finished coaches' counts, and records each send in `progress_emails` so nobody gets the same one twice.

## Season goals (PR C, 2026-11-15)
- The head coach sets up to three, from the newest finished report: a target spread per skill and a date (March 15 by
  default). Changing one ends the old row and adds a new one. The goal keeps the team's score when it was set
  (`baseline_score`), so every coach sees the same starting point.
- Pace is a straight line from that score to the goal score on the date. On pace within 0.1, Ahead from 0.2 above,
  else Behind this month's target; Goal reached or Short of goal at the date. "About N more kids up a level" is the
  line's gain to next month, in kids.
- Target share of drill time: even, plus weight for each goal's remaining gap and for being behind, at least 10% for
  every skill (`TARGET` in `src/lib/progress/ice-time.ts`). A goal that's behind, in a plan under its share, suggests
  one swap after the check-in suggestions: the longest drill in a skill over its share, for a drill whose Main is the
  goal's skill, the kids' known drills first, never a Big hit. Suggest, never apply.

## Over the season (PR D, 2026-11-15)
`/progress/season`, beside the latest report: a chart per goal on the full 1–5 scale (score solid, pace dashed grey,
goal level teal, a point orange only where it fell behind), every month's scores with the season change and ice-time
share, what practices worked on each month (Main / Some pips from the drills' minutes), the biggest gap between
coaches by month, and every report linked. Only months this coach scored show (P2). No new tables.

## Analytics (PR E, 2026-11-15)
Admin → Analytics → Progress scoring, one month at a time: coaches who scored again, goal suggestions taken (of those
swapped in or kept as is), teams still planning (scoring vs not), coaches who scored, time to score, "No change"
share, teams with a goal, the median biggest gap, the email → report funnel, and a by-team table. Two small records
feed it: `progress_report_views` (first open of each month's report) and `progress_goal_suggestions` (goal swaps
taken). `progress_usage(month)` returns ids, counts and team names to analytics viewers only.
