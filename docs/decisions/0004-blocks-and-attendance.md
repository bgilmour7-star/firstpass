# Decision: Block kinds and who's here today
Status: Accepted · 2026-10-14 (Brett, after the "Plan builder rework" canvas page)

## Context
Coaches nested station drills inside a Stations block, couldn't change a block's kind after adding it, could only add at the bottom, and had no way to say "only enough kids for two stations today". Brett's rules: a station drill needs one diagram, because the zones are all on it. Sharks, Bears and Eagles as levels belong to a progression drill. In a rotation everyone does every station, and who starts where is the coach's call on the ice.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. Four block kinds in the same JSON list, attendance as a nullable column on `practices`, per-block choices keyed by group | Days | $0 | Low | Check-in can read levels and stations per group | One more jsonb column to migrate |
| B. Keep "stations" and add per-drill station counts | Hours | $0 | Low | Weak: the nesting confusion stays | Coaches keep nesting station drills |
| C. Store attendance per block | Days | $0 | Low | Weak | Coaches set the same thing several times |

## Decision
A.
- **drill:** one drill for everyone. If the drill has levels, each group does its own level, shown easiest to hardest. A merged group starts at its easier group's level. The coach can change it per group.
- **stations:** one drill and one diagram, with each group at its own station (A, B, C). A merged group takes its easier group's station. Stations nobody needs today are greyed out (`unused` on RinkDiagram), and the coach can change them.
- **rotation:** every group does every station, moving on the whistle. It runs as many stations as there are groups today; the last ones sit out unless the coach picks another ("Use instead of B"). There is no group-to-station schedule.
- **activity:** free skate, water, huddle, small games.
- **Who's here today** (`practices.attendance`: counts per group plus merges) applies to this practice only and adapts every block, including blocks added later.
- Per-block choices are keyed by group (`"Sharks+Bears"`), so they survive attendance changes.
- Any block can be changed to another kind in place, keeping its slot and minutes.
- Older plans load unchanged: a saved "stations" rotation is read as a rotation, and a station drill saved as a plain drill shows as stations.

## Consequences
- Run `supabase/migrations/20261015000000_attendance.sql`. Until then, plans still save, but without today's groups (logged on the server).
- `RinkDiagram` gained `unused` in `design-system/`. Carry it back to the Firstpass Design System artifact on the next design-system update.
- Printout, Rink-side and the parent link use today's groups, so their times match the ice.

## Revisit when
A team needs four groups or a rotation with more stations than groups (stations left empty in turn).
