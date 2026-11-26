# 0056 · U11 and U13 teams

Date: 2026-11-26 · Decided by: Brett (a U13 girls' coach signed up; "I'd like to support them")

## Decision
- **U11 and U13 are age groups** everywhere U5–U9 are: `AGE_GROUPS` in `src/lib/drills/schema.ts` (with `AGE_LABEL`,
  "Ages 9 and 10", "Ages 11 and 12"), team creation, drill review's Age groups, and email segments by age.
  The "not yet" screen in team creation is now for U15 and older only.
- **Team settings can change the age group** (the "Team name and age group" section). Plans already made keep their drills;
  the age sets which drills the team sees from then on and where Drill blocks start.
- **Drill review: "<age> teams start at" for every ticked age above the youngest** (was U9 only). The youngest ticked age
  starts at Level 1.
- **Fallback until there are enough of their own** (`OLDER_FALLBACK_BELOW = 25` in `src/lib/drills/age.ts`): U11 and U13
  teams also see U9 warm-ups and games as they are, and U9 drills with levels started at their top level, with a one-line
  notice. The first U11/U13 drills are skill drills, so without this a first plan would have no warm-up or game.
  Set the constant to 0 to turn it off. U9's own fallback (decision 0025) is unchanged.
- **Focus guess** for a new U11 or U13 team is Passing and Shooting.

## Not yet
Team progress has level descriptions for U7 only; U11 and U13 see "coming", like U9. Answer pages, the waitlist and the
survey still list U5–U9.
