# Decision: Activation and retention on Admin → Analytics
Status: Accepted · 2026-11-22 (Brett)

## Context
Visits and sign-ups say whether people arrive. For a practice planner, the health signals are whether a new team runs a practice soon after it's made, and whether it keeps using Firstpass week after week. The In the app section counts activity in a period; it doesn't follow each team over time.

## Decision
- **Activated** means a new team checked in after a practice within 7 days of being made. It's judged only for teams at least 7 days old.
- **Days to first practice** is the middle value, from a team being made to its first check-in.
- **Active** in a week (Monday to Sunday, Vancouver time) means a coach on the team opened the app, changed a plan or checked in. Weeks with a check-in are marked apart.
- The section shows four tiles: ran a practice in 7 days, days to first practice, active this week, and came back (last week's active teams that are active again this week). Below them is a grid of each team by week, for up to 12 weeks, starting from the first team's week.
- **Only coaches' use counts.** Admins' own opens, plan changes and check-ins (Brett and the head coach) are left out, so a team they're on is measured by its other coaches (`20261129010000_team_weeks_coaches_only.sql`). A coach's app opens count for a team from when they joined it.
- `team_weeks()` returns one row per team: when it was made, its age group, its first check-in and its active weeks. No ids, names or coaches. It's for analytics viewers only. Teams with only admins on them are left out.

## Limits
- At pilot numbers each team is a large share of any rate. Read the grid, not the percentages.
- "Opened the app" counts toward every team the coach is on.
- A check-in's time is when it was last saved, so editing an old check-in can move a team's first check-in later.
- Days to first practice includes teams under 7 days old that have already checked in.
