---
name: rink-diagram
description: Draw or redraw a Firstpass drill diagram (a RinkDiagram spec in content/drills/<id>.json). Use for a new drill's first diagram, for working the open diagram change requests from drill review ("work the diagram requests"), and for any change to a drill's players, paths, cones or levels.
---

# Drawing Firstpass drill diagrams

A diagram is data: the `diagram` (and each added level's `diagram`) in `content/drills/<id>.json`, rendered only by the design-system RinkDiagram module. Never hand-draw a rink, an SVG or an image. The full spec is in `design-system/index.d.ts`.

## Two jobs, one loop

**Working diagram requests** (a reviewer asked for a change on the drill review screen):
1. `npm run drills -- requests` lists open requests with their ids and drills. If it fails for lack of Supabase access, say so and ask Brett to paste the requests (see docs/setup.md, "Let Claude work diagram requests").
2. Work them one at a time, oldest first. `npm run drills -- pull <drillId>` so you edit what is live, not a stale file.
3. Read the request and the drill's source (below), then change only what the request asks. Keep everything else where it is: the reviewer compares before and after side by side.
4. Check it (below), `npm run drills -- push <drillId>`, then `npm run drills -- resolve <requestId> "<one plain sentence on what changed>"`. That sentence shows in drill review under "What changed", so name the zone or step and say what moved ("Added a third skater pushing off the bottom boards in zone B. Nothing else moved.").
5. If a request can't be done as asked (it contradicts the source or the drawing rules), don't guess: resolve it with a sentence saying why and what you'd suggest, and leave the diagram alone.

**First draws** (a new drill, or a drill whose diagram is a placeholder):
1. Read the source first: the drill's `source.url` (Hockey Canada U7 plans are PDFs) and `sourceTitle`. Write from the source, never from the drill's name; name-only drafts got 3 of 6 wrong.
2. Draw it, check it, and leave the drill In review. Never change `status`: reviewers own it.

Then `npm run check`, and commit the JSON so the drill's history lives in git (one commit per drill or per batch of requests, saying what changed).

## Coordinates and framing

- Feet on the full 200 × 85 rink: x from the left end boards (goal line at 11, blue line at 75, centre at 100), y from the top boards (0–85). A drill keeps the same coordinates at every scope.
- `scope` follows what the drill covers: `half` for U7 work (with `side: 'left'`, net at x = 11), `full` only for drills that span both ends. No custom crops.
- U7 half-ice zones (`stations: { layout: 'halfice' }`, left side):
  - **A** top corner: x 0–75, y 0–42.5
  - **B** bottom corner: x 0–75, y 42.5–85
  - **C** neutral strip: x 75–100, y 0–85
  Keep each zone's players, paths and cones inside its box, a few feet off the dividers.
- Courses that end in a shot run toward the real net (x ≈ 11), so no net needs moving.

## Notation

O skater, X defender, C coach (never anything else), G goalie. Paths: `skate` solid, `puck` wavy, `pass` dashed, `shot` double line, `backward` ticked; `end: 'stop'` for a stop. Cones are `cones`, puck piles `piles`. Paths start just outside the player who makes them.

## Steps and captions by drill shape

- **Basic** drills: number the steps 1, 2, 3 in the order they happen; give each numbered path a `caption`, one plain sentence. Extra paths in the same step use `stepWith`. Each added level (`levels[]`) has its own diagram, a copy of the one before plus the one thing it adds.
- **Stations**: one station per group in A, B, C, all running at once, on one diagram.
- **Rotations** (2–3 zones, everyone does every zone): step n is zone n (A = 1, B = 2, C = 3). Don't write captions, `stepLabel`, `steps` or `cues` by hand: they are derived from the zones (`fromZones` in `src/lib/drills/schema.ts`), and the badge shows the zone letter. Put `stations.labels` in zone order to match the zone names.

## Check before you push

1. `npm run drills -- preview <id>`, then screenshot `.local/preview/<id>.html` with Playwright and look at it, at full size and at thumbnail size (`detail: 'thumb'`, about 190 px wide).
2. Look for: anything outside its zone or crossing a divider; overlapping players, badges or labels; paths that don't start at their player; a step badge on top of a path or a player; thumbnails that turn to mush.
3. Fix and look once more. Don't push a diagram you haven't seen.
