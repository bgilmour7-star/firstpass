# Firstpass

U7 hockey practice planner. Coaches arrange curated drills into practice plans and stations. v1 has no drill authoring for coaches: drills come from existing sources and are reviewed by admins (Brett and the head coach).

## Read first
- `docs/build-plan.md` — milestones and the next task. Work one task at a time, in order.
- `docs/setup.md` — Supabase, Vercel and environment variables.
- `docs/decisions/` — one-way-door decisions. Don't reverse one without writing a new record.
- Product and design decisions live outside the repo: the Technical Design doc and the design-decisions log in the Firstpass Design System (see `docs/build-plan.md` → Links).

## Stack
Next.js 15 (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, RLS) in `ca-central-1` · Tailwind v4 with design-system tokens · zod for validation · vitest.

## Commands
- `npm run dev` — local app. Without Supabase env vars it runs in **local mode**: drills are read from and saved to `content/drills/*.json`, no sign-in.
- `npm run check` — typecheck, lint, tests, drill validation. Run before every commit.
- `npm run drills -- <command>` — drill library CLI (`scripts/drills.ts`): validate, preview, requests, pull, push, resolve, seed.
- `npm run ds:sync` — regenerate tokens and the RinkDiagram module from `design-system/`.

## Rules
- **No child-identifiable data, ever.** Teams, groups (Sharks, Bears, Eagles) and counts only. No player names, photos or birthdates in any table, log or prompt.
- **Authorization on the server.** Every page and server action under `/admin` calls `requireAdmin()` (`src/lib/auth.ts`), and every table has RLS. A new table without RLS policies is a bug.
- **Storage goes through the stores:** `src/lib/drills/store.ts` (drill review) and `src/lib/app/store.ts` (teams, plans, live library). Don't query Supabase from components. Coach pages call `requireTeam()`.
- **Diagrams are RinkDiagram specs**, rendered only by the design-system module (`src/lib/ds/bundle.mjs`, generated). Never hand-draw a rink. Use design-system tokens (`bg-surface-200`, `text-ink-200`, `font-display`...), not raw colours.
- `src/lib/ds/`, `src/styles/tokens.css` and `src/styles/ds-bundle.css` are generated. Change `design-system/` and run `npm run ds:sync`.
- **Database changes: always paste the SQL.** When Brett needs to run a migration or seed in the Supabase SQL editor, put the full SQL in the reply, every time, even if he has seen it before. Never just name the file. Make migrations safe to run twice (`if not exists`, `create or replace`, `drop policy if exists`).
- Secrets live in `.env.local` and Vercel env vars, never in the repo. `SUPABASE_SERVICE_ROLE_KEY` is for `scripts/` only, never imported by `src/`.

## Diagrams: first draws and change requests
Reviewers ask for diagram changes on the drill review screen; new drills need a first diagram. Both are done with the **rink-diagram** skill (`.claude/skills/rink-diagram/SKILL.md`): the request loop (`requests` → `pull` → edit → `preview` and look → `push` → `resolve`), coordinates and zones, notation, and the checks before pushing. "Work the diagram requests" means: run that skill.
