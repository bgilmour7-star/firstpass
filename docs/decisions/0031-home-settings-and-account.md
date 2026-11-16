# 0031 · Home, Team settings and Account: three places, one job each

Date: 2026-11-16 · Decided by: Brett (canvas "Firstpass Team · Home, Settings and Account", https://claude.ai/artifact/9pCPxM2UoyQuLbSsmdtSCr) · Changes part of 0026

## Decision
- **Home** (the old Team page, still at `/team`) is read-only: what to do next, the next practice and how the team is
  doing. The nav item is **Home** with a house icon; the page title stays the team's name.
- **Team settings** move to their own page, `/team/settings`: team name, practices and ice, calendar, skill groups,
  coaches, join link, gear, planning, and Leave or delete. Same drawers and the same server actions as today (0026).
  Coaches who aren't the head coach see the page read-only ("Only head coaches can change these: ask <name>").
- **Account** holds what's only yours, including **your emails for each team you're on** (after-practice check-in,
  progress). One group of switches per team; one team shows as one group. Sign-in codes are never optional.
- **Next up** on Home shows the single most urgent thing, or nothing, in this order: check in on your last practice
  (same rule as the plan page nudge), score an open progress round you haven't finished, then ice in the next 7 days
  with no plan. **Later** hides it on that device until the next day. When nothing is waiting, Open the plan is the
  main button.
- **Next practice** shows the plan's drills in order as small diagrams (no water or breaks; a rotation or station block
  is one drill), each with its start time and minutes, marked **Shooting goal** (a drill whose focus serves a goal that is
  behind) or **New today** (not yet known to the kids). Desktop shares the row equally up to 6; 7+ shows 5 and
  "+N more drills". Phones scroll sideways.
- **Progress on Home** is one chart, not numbers: each skill on the 1–5 level scale, October dot to latest dot, goal
  skills shaded with the goal flag and a tick where the team should be by now, Ahead/Behind in words. Before the first
  round: "Score your first round…" with a button. No goals: the chart without flags and a Set goals nudge. One sentence on
  top joins it to the plan ("Sunday's plan gives it 18 of 50 minutes").

- **A goal for every skill** (changes 0030, which allowed 3): one active goal per skill, up to six. U7 is about
  all-round development; focus comes at later ages, so a goal on each skill is the expected setup. Plans still get one
  goal suggestion each, for the goal furthest behind; Home shades only goals that are behind.

## Why
The Team page was the only place for team settings and personal email preferences, so it was mostly forms. Coaches open
it between practices wanting the next thing to do and whether the season is working; that now comes first.

## Kept
The `/team` URL (links in emails, `next=` redirects and bookmarks keep working), the drawers, `saveTeam` and every RLS
rule. The only database change is lifting the 3-goal limit in `set_progress_goal`.

## Revisit when
Coaches use the app across many teams (Account's per-team groups get long), or Next up needs more than three kinds.
