---
name: drill-requests
description: Work coaches' drill requests (decision 0018). Draft a requested new drill with its diagram and put it In review, or draft a suggested change as a proposal beside the live drill. Use for "work the drill requests" and for the daily scheduled run.
---

# Working coaches' drill requests

Coaches ask for a new drill or suggest a change from the Drills pages. Each request is a row in
`drill_requests` with `state = 'sent'`. Your job is to draft it so an admin (Brett) can review it.
You never make anything live and never change a live drill: reviewers own status, and a change
waits as a proposal until Brett accepts it. The app emails Brett when a request becomes `drafted`
and emails the coach when Brett decides.

## How to reach the database

Use whichever works, in this order:
1. The drills CLI: `npm run drills -- asks` (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`).
2. The Supabase connector (`execute_sql` on project `hxpwsjqibphnhbzxyjiw`). The SQL for each step
   is below. Keep each write a single small statement; big multi-statement writes can be cancelled.

## 1. List what's waiting

```sql
select r.id, r.kind, r.drill_id, r.answers, r.description, r.link, r.requester_name, t.name as team, r.created_at
from public.drill_requests r join public.teams t on t.id = r.team_id
where r.state = 'sent' order by r.created_at;
```

None waiting: stop and say so in one line.

Work them oldest first, one at a time, and finish each one (drafted or noted) before the next.

## 2a. A new drill

1. Read the request: `description`, `answers` (part `warmup|skill|game`, shape `basic|stations|rotation|unsure`,
   focus, minutes) and `link`. If there's a link to a web page or PDF, read it with WebFetch: write from the
   source, not from your guess. You can't watch videos; work from the description and say so in the note.
2. Check the library isn't already covering it (`content/drills/*.json`, or `select id, content->>'funName' from drills`).
   If an existing drill is the same thing, don't draft a copy: note it (step 3) naming the drill.
3. Write `content/drills/<new-id>.json` against `src/lib/drills/schema.ts`, in the style of the existing
   drills: a fun name kids remember (≤ 40 chars), a plain name, part, groupModel, minutes, gear, description,
   1–6 steps, 1–3 cues ("Say this"), focus (main skill level 2), effort, format, `status: "in_review"`, and
   `source` (label and url of the link, or `{ "label": "Coach request" }` when there's none). Re-describe in
   your own words; never paste text from the source.
4. Draw the diagram with the **rink-diagram** skill (read `.claude/skills/rink-diagram/SKILL.md`): coordinates,
   notation, and the check before pushing (preview, screenshot, look, fix).
5. `npm run drills -- validate`, then `npm run drills -- push <new-id>`, then
   `npm run drills -- drafted <requestId> <new-id> "<note>"`.
   With the connector instead: insert the drill, then mark the request:
   ```sql
   insert into public.drills (id, status, content) values ('<new-id>', 'in_review', $json$<the drill JSON without id/status>$json$::jsonb);
   update public.drill_requests set state = 'drafted', drill_id = '<new-id>', drafted_at = now(), claude_note = $n$<note>$n$ where id = '<requestId>' and state = 'sent';
   ```
6. Commit the JSON ("Drill request: <Fun Name> for <team>").

## 2b. A change to a drill

1. `npm run drills -- pull <drillId>` (or select its `content`) so you start from what's live.
2. Change only what the coach's suggestion needs. If it's a diagram change, follow the rink-diagram skill.
   If the suggestion would break the drill for others (it's about one team's kids, or contradicts the
   source), don't force it: note it (step 3) with what you'd suggest instead.
3. `npm run drills -- validate`, then `npm run drills -- propose <requestId> "<note>"`, then
   `npm run drills -- pull <drillId>` to put the live version back in `content/drills`. Don't push and don't commit:
   the live drill changes only when Brett accepts.
   With the connector instead:
   ```sql
   update public.drill_requests set state = 'drafted', proposed = $json$<the full changed drill JSON, with id>$json$::jsonb, drafted_at = now(), claude_note = $n$<note>$n$
   where id = '<requestId>' and state = 'sent';
   ```

## 3. When you can't draft it

Not hockey, unclear, a duplicate, unreachable link with too little description, or anything unsafe:
`npm run drills -- cant <requestId> "<why, and what you'd suggest>"`, or

```sql
update public.drill_requests set state = 'drafted', drafted_at = now(), claude_note = $n$<why>$n$ where id = '<requestId>' and state = 'sent';
```

Brett sees the note and declines it with a reason the coach will read.

## The note

One or two plain sentences Brett reads in review: what you based it on and anything to check.
"From the Hockey Canada U7 lesson 6 PDF. I made it a 3-zone rotation since the coach chose Rotation; zone C is my addition."
"Changed step 2 so groups of 3 start at once (less waiting, as asked). Diagram adds two more lines; nothing else moved."

## Rules

- No child-identifiable data, ever. If a description names a child, don't carry the name into the drill or the note.
- Never set a drill's status beyond `in_review`, never update a live drill's content, never mark a request accepted or declined.
- `npm run check` before committing.
