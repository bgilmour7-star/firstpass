# 0023 · A first plan that's ready to run, and no plan status to set

Date: 2026-10-20 · Decided by: Brett (assessment "Planner Simplification", moves 1 and 6 in part)

## Decision
- **The first plan comes ready** (`src/lib/plans/first-plan.ts`). With no plan to copy, a new practice is built from the live
  library in the Hockey Canada shape: free skate, a warm-up drill, an easy skill drill on a different skill, a rotation, water,
  a fun game, a huddle. Earliest lessons and easier drills first. Time left over becomes small games; on short ice the skill
  drill, then the warm-up, then water drop out. It passes its own variety check. Without a rotation and a game in the library
  it falls back to the old template.
- **No new-drill limit on the first practice.** Everything is new to the kids, so the warning and the orange count wait until
  the team has practised once; the margin says so.
- **The rotation picker compares whole blocks.** Choosing or swapping a rotation from a rotation block filtered by the
  minutes per zone (8) against a rotation drill's total (18–21), so it showed 0 of 9. It now uses the block's total time.
- **Draft · Ready · Done is gone from the planner.** It only changed a label on Plans. Done still comes from the check-in, and
  Plans shows Done. The phone bar's Status slot is now Rink-side. The field stays in the data.

## Why
Brett's sense that the planner is too complex for a novice; the walkthrough found the first plan had no drills and its first
tap was a dead end. A new coach should open a practice that could run tomorrow.

## Next
Clickable mockups of the read-first plan and one drill picker (moves 2 and 3), tested with three novice coaches before building.
