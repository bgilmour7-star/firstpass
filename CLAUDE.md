# Firstpass

Hockey practice planner for U5–U9 teams (age groups: decision 0025). Coaches arrange curated drills into practice plans and stations. Coaches don't author drills: drills come from existing sources or coaches' requests and are reviewed by admins (Brett and the head coach).

## Read first
- `docs/build-plan.md` — milestones and the next task. Work one task at a time, in order.
- `docs/setup.md` — Supabase, Vercel and environment variables.
- `docs/decisions/` — one-way-door decisions. Don't reverse one without writing a new record.
- Product and design decisions live outside the repo: the Technical Design doc and the design-decisions log in the Firstpass Design System (see `docs/build-plan.md` → Links).
- UX patterns every screen follows (warnings on the item, one filter row pre-set from context, suggest never apply, Strava-style capture, plain-word progress) are in the Practice Plan project doc "Firstpass UX patterns".

## Stack
Next.js 15 (App Router, TypeScript) on Vercel · Supabase (Postgres, Auth, RLS) in `ca-central-1` · Tailwind v4 with design-system tokens · zod for validation · vitest.

## Commands
- `npm run dev` — local app. Without Supabase env vars it runs in **local mode**: drills are read from and saved to `content/drills/*.json`, no sign-in.
- `npm run check` — typecheck, lint, tests, drill validation. Run before every commit.
- `npm run drills -- <command>` — drill library CLI (`scripts/drills.ts`): validate, preview, requests, pull, push, resolve, seed.
- `npm run ds:sync` — regenerate tokens and the RinkDiagram module from `design-system/`.

## Rules
- **No child-identifiable data, ever.** Teams, groups (Sharks, Bears, Eagles) and counts only. No player names, photos or birthdates in any table, log or prompt.
- **Coaches in research are named by their research code** (`research_people.code`, e.g. `c-0104`): files in `research/coaches/<code>.md`, admin page `/admin/coaches/<code>`. Never use an email, phone or user id to identify someone, and never commit either.
- **Authorization on the server.** Every page and server action under `/admin` calls `requireAdmin()` (`src/lib/auth.ts`), and every table has RLS. A new table without RLS policies is a bug.
- **Storage goes through the stores:** `src/lib/drills/store.ts` (drill review) and `src/lib/app/store.ts` (teams, plans, live library) and `src/lib/requests/store.ts` (coaches' drill requests). Don't query Supabase from components. Coach pages call `requireTeam()`.
- **Diagrams are RinkDiagram specs**, rendered only by the design-system module (`src/lib/ds/bundle.mjs`, generated). Never hand-draw a rink. Use design-system tokens (`bg-surface-200`, `text-ink-200`, `font-display`...), not raw colours.
- `src/lib/ds/`, `src/styles/tokens.css` and `src/styles/ds-bundle.css` are generated. Change `design-system/` and run `npm run ds:sync`.
- **Database changes: always paste the SQL.** When Brett needs to run a migration or seed in the Supabase SQL editor, put the full SQL in the reply, every time, even if he has seen it before. Never just name the file. Make migrations safe to run twice (`if not exists`, `create or replace`, `drop policy if exists`).
- `SUPABASE_SERVICE_ROLE_KEY` is for `scripts/` only, never imported by `src/`.

## Diagrams: first draws and change requests
Reviewers ask for diagram changes on the drill review screen; new drills need a first diagram. Both are done with the **rink-diagram** skill (`.claude/skills/rink-diagram/SKILL.md`): the request loop (`requests` → `pull` → edit → `preview` and look → `push` → `resolve`), coordinates and zones, notation, and the checks before pushing. "Work the diagram requests" means: run that skill.

## Drill requests from coaches
Coaches ask for new drills or suggest changes (decision 0018). Each morning the "Firstpass morning" scheduled task works them with the **drill-requests** skill (`.claude/skills/drill-requests/SKILL.md`): draft a new drill In review, or store a change as a proposal; never make anything live. "Work the drill requests" means: run that skill.

## Reviewing pull requests
Brett merges; Claude reviews first with the **pr-review** skill (`.claude/skills/pr-review/SKILL.md`) and posts the verdict on the PR. A PR that touches the database, sign-in, emails, `/admin`, `scripts/` or a public route gets a full review from a fresh agent that didn't write it; UI-only changes get a light review (checks and screenshots). "Review PR #n" means: run that skill.

## Shared conventions (all of Brett's repos)
- **Commit as the repo owner**: `git -c user.name=bgilmour7-star -c user.email=279498074+bgilmour7-star@users.noreply.github.com commit …`, ending the message with `Co-Authored-By: Claude <noreply@anthropic.com>`. Vercel Hobby won't deploy a commit authored by any other account.
- **Branch and PR by default; Brett merges.** Exception: the "Firstpass morning" scheduled task commits drafted drill JSON and `research/` files straight to `main`.
- **Data stays in Canada**: Supabase `ca-central-1`, Vercel functions `yul1`. Anything new that sends personal data outside Canada (a US API, analytics) is called out in the PR and on the privacy page.
- **Database changes**: migrations in `supabase/migrations/`, safe to run twice, never edited once applied, never made in the dashboard. When Brett has to run SQL himself, paste the full SQL in the reply, every time.
- **Secrets** live in Vercel env vars and `.env.local`, never in the repo. The service-role key never reaches client code.
- **Times**: store UTC, show `America/Vancouver`, always converting through the zone name (B.C. is UTC-7 year-round since 2026-11-01).
- **Words Brett publishes as himself** (site copy, emails, case studies) follow the `my-writing-style` skill.
- If a task is ambiguous or conflicts with this file, stop and ask.
