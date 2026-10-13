# Decision: How drills are stored
Status: Accepted · 2026-10-13

## Context
Drills are curated content: names, steps, cues, focus tags, group levels or stations, and RinkDiagram specs (nested JSON). Admins edit them in the review screen; Claude edits diagrams from requests. Plans will reference drills by id. The record shape is still moving (levels vs stations was settled this week).

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. One `drills` row per drill: id + status as columns, the rest as a validated JSON document | Fastest | $0 | Low (Postgres jsonb) | Easy to promote fields to columns later | App must validate the document (zod does) |
| B. Fully normalized tables (drills, steps, cues, focus, levels, stations, diagram paths) | 2–3x the work | $0 | Low | Strong constraints | Every shape change is a migration; diagrams are awkward as rows |
| C. Drills only as JSON files in git, no database | Fast | $0 | None | Reviews need git; the head coach can't edit | Doesn't meet "admin screen" |

## Decision
A, with the JSON files in `content/drills/` kept as the seed and git history. Filterable fields (`status`) are columns; the rest is `content jsonb`, validated by `src/lib/drills/schema.ts` on every read and write. Review activity (diagram requests, notes) is relational because it's queried by state.

## Consequences
- Changing the drill shape is a schema edit plus a content migration script, not a database migration.
- Queries inside the document (e.g. "drills with Passing as Main") need jsonb operators or a promoted column. Promote when the coach library needs that filter.

## Revisit when
The coach-facing library needs server-side filtering on focus, gear or minutes, or the library passes ~1,000 drills.
