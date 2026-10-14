# Decision: How practice plans and teams are stored
Status: Accepted · 2026-10-13

## Context
A plan is an ordered list of blocks (activities, drills, stations with a drill per station). Coaches reorder, insert and retime blocks constantly, and the plan is always read whole. Teams hold counts only, never children.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. `practices` row per plan, blocks as a validated JSON array | Fastest | $0 | Low | Promote to tables when analytics need it | Cross-plan queries ("how often was X used") read JSON |
| B. `practice_blocks` table with an order column | 2x the work | $0 | Low | Strong per-block constraints | Every reorder rewrites order columns; more code for the agent to get wrong |

## Decision
A. `practices.blocks` is validated by `src/lib/plans/schema.ts` on every read and write. Start times are never stored: they're computed from the practice start and block minutes. Membership (`team_members`) and RLS (`is_team_member`, `is_head_coach`) scope every row to a team; `create_team()` is the only way to create one and makes the caller head coach.

## Consequences
- Check-in data (Milestone 5) will reference block ids and drill ids inside this JSON. That's fine at pilot scale.
- "New to the kids" is computed from earlier plans' drill ids, not stored.

## Revisit when
Suggestions or season views need fast queries across hundreds of plans, or a second team's data shows the JSON shape changing often.
