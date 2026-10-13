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
- **Storage goes through `src/lib/drills/store.ts`.** Don't query Supabase from components.
- **Diagrams are RinkDiagram specs**, rendered only by the design-system module (`src/lib/ds/bundle.mjs`, generated). Never hand-draw a rink. Use design-system tokens (`bg-surface-200`, `text-ink-200`, `font-display`...), not raw colours.
- `src/lib/ds/`, `src/styles/tokens.css` and `src/styles/ds-bundle.css` are generated. Change `design-system/` and run `npm run ds:sync`.
- Secrets live in `.env.local` and Vercel env vars, never in the repo. `SUPABASE_SERVICE_ROLE_KEY` is for `scripts/` only, never imported by `src/`.

## Diagram change requests (the admin review loop)
Reviewers ask for diagram changes on the drill review screen. To work them:
1. `npm run drills -- requests` lists open requests.
2. `npm run drills -- pull <id>`, then edit `content/drills/<id>.json`. Write from the drill's source, never from its name.
3. `npm run drills -- preview <id>` and look at `.local/preview/<id>.html` (screenshot it with Playwright) before pushing.
4. `npm run drills -- push <id>`, then `npm run drills -- resolve <requestId> "<one sentence on what changed>"`.
5. Commit the JSON so the drill's history lives in git.

Drawing rules: courses that end in a shot run toward the real net; groups are either levels of one progression (Sharks 1.0, Bears 1.1, Eagles 1.2) or one station each on half ice (A, B, C); captions are one plain sentence per step.
