---
name: pr-review
description: Review a Firstpass pull request before Brett merges it. Checks it against the repo's rules (RLS and auth, no child data, migrations safe to run twice with the SQL in the PR, secrets, email registry, UX patterns), runs the checks, looks at the screens, and posts a verdict on the PR. Use for "review PR #n", before asking Brett to merge, and for any PR that touches the database, sign-in or emails.
---

# Reviewing a Firstpass pull request

Brett merges. Your job is to tell him, on the PR, whether it is safe to merge and what he should look
at. You never merge, approve on his behalf, or push fixes to the branch during a review: you report.
If the author asks you afterwards to fix what you found, that is a separate task.

## Who reviews

- **Full review** (a fresh agent that did not write the code): any PR that touches `supabase/`,
  `src/lib/auth*`, `src/middleware.ts`, an `/admin` page or action, `src/lib/email/`, `scripts/`,
  RLS or grants, a public route (`/s/`, `/unsubscribe/`, `/join/`, `/p/`, `/api/`), or more than
  about 400 changed lines. The session that wrote the PR starts the reviewer with only the PR number
  and this skill's path, never its own summary of the change, so the review isn't anchored on the
  author's view.
- **Light review** (the author may run it): UI-only changes. Run the checks and look at the screens
  (steps 3 and 5); skip what doesn't apply.

Say at the top of the verdict which kind it was.

## 1. Get the PR

```bash
gh api repos/bgilmour7-star/firstpass/pulls/<n> --jq '.title, .head.ref, .base.ref, .body'
gh api repos/bgilmour7-star/firstpass/pulls/<n>/files --paginate --jq '.[] | "\(.status) \(.additions)+ \(.deletions)- \(.filename)"'
# The clone only fetches main by default, so fetch the PR's branch by name:
git fetch origin main +refs/heads/<head-ref>:refs/remotes/origin/<head-ref>
git checkout -q --detach origin/<head-ref>
git diff origin/main...HEAD
# Other open PRs (for step 4):
gh api 'repos/bgilmour7-star/firstpass/pulls?state=open' --jq '.[] | "#\(.number) \(.head.ref) \(.title)"'
```

(GitHub GraphQL is blocked here, so `gh pr view`/`gh pr list` fail: use `gh api` REST routes.)
Read the whole diff, not a sample, and the PR body. Read `CLAUDE.md` and any decision record or spec
the PR names. For a change to existing behaviour, read the surrounding code too.

## 2. Check it against the rules

Go through every item. Note each problem as **file:line → what goes wrong, for whom, when**. Only
report problems you can point to; "consider adding tests" without a concrete gap is noise.

**Data and access**
- Every new table has `enable row level security` and policies for each operation it allows. A table
  with RLS on and no policy for an operation the app performs is a bug too (the call fails silently).
- Policies match who should see it: coaches through team membership (`is_team_member`,
  `is_head_coach`), admins through `is_admin()`, discovery data through `can_see_analytics()` only.
- `security definer` functions set `search_path = ''`, check `auth.uid()` or a secret themselves,
  and have `revoke all ... from public` plus grants to exactly the roles that call them. Anything
  granted to `anon` must be safe for anyone on the internet to call with any input.
- Every page and server action under `/admin` calls `requireAdmin()` or `requireAnalytics()` first;
  coach pages and actions call `requireTeam()`. Server actions validate input (zod or an explicit
  check) before using it, and check the caller may act on that team or row, not only that they're
  signed in.
- Storage goes through the stores (`src/lib/app/store.ts`, `src/lib/drills/store.ts`,
  `src/lib/requests/store.ts`, `src/lib/discovery/store.ts`), and local mode (`store-local.ts`)
  still works for anything new.

**No child-identifiable data, ever**
- No new column, field, log line, email, prompt or research file that could hold a player's name,
  photo or birthdate. Free-text fields coaches fill in say "No kids' names, please."
- Grep the diff: `git diff origin/main...HEAD | grep -niE "player|kid|child|birth|photo|roster"` and
  read each hit.
- People in research files, summaries and notes are named by first name and research code
  (`c-0101`), never by email, phone or user id (decision 0027).

**Migrations**
- Safe to run twice: `create ... if not exists`, `create or replace`, `drop policy if exists` before
  `create policy`, `drop trigger if exists`, `on conflict do nothing` for seeds. Read each statement
  and ask "what happens the second time?"
- Safe against the live data: a new `not null` column has a default; a backfill can't fail on
  existing rows; nothing drops or rewrites data without saying so in the PR body.
- The PR body contains the full SQL, matching the migration file exactly (diff them). Brett runs it
  by hand in the Supabase SQL editor, so the body must say when to run it relative to the merge and
  what breaks in between.
- Anything the deployed code calls (a column, function or table) either exists before the merge or
  the code handles its absence (like `MigrationMissing`).

**Secrets and services**
- `SUPABASE_SERVICE_ROLE_KEY` appears only under `scripts/`, never imported by `src/`
  (`grep -rn SERVICE_ROLE src` must be empty). No keys, tokens or real email addresses in code,
  tests or fixtures.
- Cron routes check the cron secret. Emails sent through Resend use an idempotency key.

**Emails**
- Every new template function in `src/lib/email/` is registered in `src/lib/email/journeys.ts`
  (the registry test enforces this; check the entry's trigger, delay, condition and audience are
  true to the code that sends it).
- Discovery emails have an unsubscribe link and `List-Unsubscribe`. Practice emails don't depend on
  the discovery unsubscribe.

**Product and UX** (the Practice Plan project doc "Firstpass UX patterns" has the full list)
- Warnings sit on the item they're about; filters are one row pre-set from context; Claude suggests
  and never applies on its own; progress is in plain words.
- Copy: plain, short, no jargon, no exclamation-mark cheer. Anything that's Brett speaking (emails
  from "Brett at Firstpass", survey intro) is flagged for him to read, since he approves his own
  voice.
- Design tokens only (`bg-surface-200`, `text-ink-200`...), no raw colours outside emails. Rinks
  only through the RinkDiagram module. Touch targets at least 44px on phones.

**Scope**
- The PR body describes this diff: what changed, the SQL if any, and how it was checked. A body that
  describes something else, or is missing, is a fix-before-merge item (Brett merges from it).
- The PR does what its title and body say and nothing unrelated. A drive-by refactor or a
  reformatted file (for example running prettier, which this repo doesn't use) is called out:
  it hides real changes in the diff.
- `docs/build-plan.md` and a decision record are updated when the PR makes a one-way-door choice.

## 3. Run the checks

Run these from the repo root (in an agent worktree, the worktree's root):

```bash
npm ci
npx tsc --noEmit
npx eslint .                                   # main checkout with worktrees in it: add --ignore-pattern '.claude/**'
npx vitest run                                 # main checkout with worktrees in it: add --exclude '.claude/**'
npm run drills -- validate | grep -c '^ok'     # prints one "ok <id>" per drill; any other line is a problem
```

(`npm run check` runs all of these but picks up `.claude/worktrees/` if any exist.) Report the
counts. A failing check is always a blocker.

## 4. Merge order and conflicts

If other PRs are open, say whether this one merges cleanly on main and with them:
`git merge-tree --write-tree origin/main HEAD` prints a tree id and exits 0 when it merges cleanly,
and lists the conflicts and exits 1 when it doesn't. Run it once per command (fetch each other PR's
branch as in step 1 and run it against `origin/<other-ref>`), or compare the PRs' changed-file lists
when only overlap matters. Name the order Brett should merge and run SQL in.

## 5. Look at the screens

For any UI change, run it in local mode and look:

Start `npx next dev -p 3100` as a background task (local mode needs no env vars), wait for
`curl -s localhost:3100` to answer, and stop it with TaskStop when you're done. Don't kill it with a
`pkill -f` pattern: it can match your own shell.

Screenshot each changed screen with Playwright at 1440×900 and 390×844, and open the images with
Read. Playwright and Chromium are installed globally, not in the repo, so require them by path:
`require('/home/claude/.npm-global/lib/node_modules/playwright')` (if that moved:
`npm root -g`). Write the script in the scratchpad, not the repo. Try the main path and one edge: empty state,
a long name, Escape and back for drawers, keyboard focus. Stop the server when done. Say what you
looked at; a screen you didn't see is "not checked", not "fine".

## 6. Post the verdict

Post one review on the PR, as a comment (you aren't Brett, so never `APPROVE`):

```bash
gh api repos/bgilmour7-star/firstpass/pulls/<n>/reviews -f event=COMMENT -F body=@review.md
```

Format:

```
**Ready to merge** | **Merge after fixes** | **Don't merge**  ·  Full review | Light review

<one or two sentences: what the PR does and the call>

Blockers
- file:line: what goes wrong, for whom, when. Fix: ...

Worth fixing
- ...

Brett to check
- Copy in his voice, product calls, anything only he can judge.

Checked: typecheck · lint · N tests · drills validate · screens at 1440 and 390 (list) · merge
order · SQL in the body matches the file
Not checked: ...
```

Already there (not from this PR)
- Problems you noticed that this PR didn't cause, one line each. They don't change the verdict.

The verdict:
- **Ready to merge**: no blockers, and nothing in Worth fixing that should hold the merge.
- **Merge after fixes**: no blockers, but something should be fixed first because it's cheap and
  merging without it leaves a real problem (a PR body that doesn't match the diff, a bug a user will
  hit, a missing test for new logic).
- **Don't merge**: any blocker. Blockers are things that would break production, leak data, lose
  data, or leave the database out of step with the code, plus any failing check.

Leave a section out when it's empty. Keep it short; Brett reads it on his phone.

Then tell Brett in the conversation: the verdict line, the blockers if any, and that the review is on
the PR. If it's Ready to merge, he can merge on GitHub or say "merge it".
