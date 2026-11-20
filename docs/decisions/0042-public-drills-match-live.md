# 0042 · Public pages show the live drill, not a stale file

Date: 2026-11-19 · Found while writing the second answer page.

## What happened
Public pages are built from `content/drills/*.json`, but drills are edited in drill review (Supabase). Seven
public drills had drifted. **Puck Party** was 4 minutes per station live but 6 in the file, so the pilot page showed
18 minutes for it. Hot Potato Partners, Ski Racer, Cops and Robbers, Skill Doctor Tag, Steal the Treasure and Snake
in the Forest had other differences (levels, model, effort, age groups).

## Decision
- The public drills' files are replaced with the live content (checked equal in SQL), status `live`.
- `npm run drills -- public` now also fails when a public drill's file differs from the live drill (key order and
  the file's status ignored), and says to `pull` it. Run it before merging any public-page change.
- Answer-page plans work out their start times from the drills' minutes (`PlanTable`, `withTimes`), and each page
  checks its plan adds up to 60 minutes at build time. A pulled change to a drill's minutes moves the times. If a
  pull breaks the 60, the build fails rather than publishing wrong times.
- The pilot page is retimed: Puck Party 3 × 4 = 12 minutes, plus 8 minutes of small games, so the plan still fills 60.
