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
- **Levels don't belong to groups.** A Drill block picks **one level** (`level`, default 1) and the whole group does it. *(Amended 2026-10-17, Brett: "the entire group must do drills. You cannot run 2 different levels of a progression at the same time… No groups for drills, only for stations and as an option for rotations." This replaces the first version, where a block could put several levels in play and spread them over the groups.)*
- **Older data is upgraded when read, so there's no data migration.** `together` becomes basic. `levels` (1.0/1.1/1.2) becomes basic: the first level names Level 1 and the others become added levels. `versions` becomes basic: the easiest group's line names Level 1. An older drill block keeps its level if it had exactly one in play, otherwise it reads as Level 1. Stored drills take the new shape the next time they're saved.
- "Progression" is kept for how skills build across the season, lesson to lesson, not for levels inside a drill.

## Consequences
- Airplanes and Hot Potato Partners came from per-group versions. Their added levels reuse the main diagram until someone asks for a redraw.
- The builder shows the chosen level with its diagram and the other levels as "Use this level" stubs (the "Level picker" design canvas). On a phone the chosen level goes full width.
- The coach drill page, Rink-side, the printout and the parent link show "Level n" with what it adds, and the printout and Rink-side draw that level's diagram.
- Groups appear only in Stations blocks. Rotations may get an optional "which group starts in which zone" later.
- The model map ("Firstpass Model Map" artifact) shows the new shape.

## Revisit when
- A drill needs more than three levels, or levels need their own steps and cues rather than one "adds" sentence.
