# 0025 · Drills say which ages they suit

Date: 2026-10-25 · Decided by: Brett (technical design "Teams and discovery", PR 1; mockups D1 Review and D2 Library)

## Decision
- **Age groups live in the drill's content** (`src/lib/drills/schema.ts`): `ageGroups` (U5, U7, U9, at least one, default
  `['U7']`) and `startLevel` (per age, 1–3, e.g. Ski Racer `{ U9: 2 }`; missing means Level 1). Drills saved before this read
  as U7 and are written in the new shape the next time they are saved. No SQL: the `drills.content` jsonb already holds it.
- **Set in drill review.** An Age groups row of pill toggles (aria-pressed, at least one stays on) and, when U9 is ticked and
  the drill has levels, "U9 teams start at" with each level's name. Unticking an age drops its start level. It saves through
  the drill store like every other field, and a coach's change request shows it in the diff.
- **One filter for the coach side** (`src/lib/drills/age.ts`, `drillsForAge(drills, ageGroup)`). The Drills page, the
  add-a-drill drawer, swaps, suggestions and the first plan (decision 0023) only offer drills whose `ageGroups` include the
  team's `ageGroup`. No age toggle for coaches. Drills already in a plan still show wherever the plan is read.
- **A Drill block starts at the drill's start level for the team's age** when it is added (picker, swap, suggestion, first
  plan). The coach can still switch levels on the block.
- **U9 with few drills.** Until there are `U9_FALLBACK_BELOW = 10` U9 drills, a U9 team also sees U7 drills that have levels,
  started at their top level, with one line: "U9 drills are new. Until there are more, you'll also see U7 drills at their
  harder levels." Set the constant to 0 to remove the fallback.

## Why
U9 teams are the strongest signal the bet is spreading past U7, and a U9 coach shouldn't plan from drills built for
five-year-olds. Keeping it in the drill content means no migration and nothing for the existing U7 library to do.

## Next
The "Firstpass U9 drills" scheduled task drafts drills with `ageGroups: ['U9']`. Teams (PR 2) adds U5/U9 team creation.
