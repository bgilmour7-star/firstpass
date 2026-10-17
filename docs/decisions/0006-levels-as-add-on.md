# Decision: Levels are an add-on to a basic drill
Status: Accepted · 2026-10-17 (Brett, after the model map)

## Context
A drill had five group models: levels, stations, rotation, together and the legacy versions. "Levels" and "together" both went in a Drill block, so the block's name said little, and a levels drill fixed one level per group (Sharks 1.0, Bears 1.1, Eagles 1.2). Brett: "A drill can be a basic drill, no level (or just 1 level), and you can add more levels if needed." And: "when building the practice plan … select the drill and set it to one or more of the levels available, making the drill more of a comprehensive object."

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. Levels as an add-on: every non-station, non-rotation drill is `basic` (Level 1) with 0–2 added levels; the block picks the levels in play | Hours | $0 | Low | A drill grows a level without changing type; season plans can pick a level by lesson | Old plans store level labels ("1.1") |
| B. Two drill types: normal and progression | Hours | $0 | Low | Weak: converting a drill to add a level | The Levels/Together split stays |
| C. Keep levels fixed to groups | None | $0 | Low | Weak | Coach can't run one level for everyone |

## Decision
A.
- **Group models are now three:** `basic`, `stations` and `rotation`. Each matches one block kind: Drill, Stations or Rotation.
- **A basic drill is Level 1.** `levelName` names it in a few words. `levels` holds up to two added levels, each with a name, what it adds (one sentence) and its own diagram. A new level starts as a copy of the diagram before it, and the reviewer asks Claude to redraw what changes.
- **Levels don't belong to groups.** A Drill block picks the **levels in play** (`use`; empty means all). The levels in play are spread over today's groups, easiest group on the easiest level. With one level in play, everyone does it. With more levels than groups, the easiest and hardest are used. The coach can still change a group's level (`levels`, now level numbers).
- **Older data is upgraded when read, so there's no data migration.** `together` becomes basic. `levels` (1.0/1.1/1.2) becomes basic: the first level names Level 1 and the others become added levels. `versions` becomes basic: the easiest group's line names Level 1. A plan's old labels "1.0", "1.1" and "1.2" read as levels 1, 2 and 3. Stored drills take the new shape the next time they're saved.
- "Progression" is kept for how skills build across the season, lesson to lesson, not for levels inside a drill.

## Consequences
- Airplanes and Hot Potato Partners came from per-group versions. Their added levels reuse the main diagram until someone asks for a redraw.
- The coach drill page, Rink-side, the printout and the parent link show "Level n" with what it adds.
- The model map ("Firstpass Model Map" artifact) shows the new shape.

## Revisit when
- A drill needs more than three levels, or levels need their own steps and cues rather than one "adds" sentence.
