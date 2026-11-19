# 0038 · Answer pages and age hubs

Date: 2026-11-19 · Decided by: Brett ("let's dig in on the content answer pages (not a blog)" … "I like this
approach"). Task 2 of the "Firstpass SEO and AEO plan" project doc.

## Decision
- **Public answer pages, not a blog.** Each page answers one coach question, in a coach's words, with a real
  Firstpass plan as the proof and what happened on the ice. They're grouped under age hubs (`/u7`, later `/u5` and
  `/u9`). The pilot is `/u7/first-practice`.
- **One list**: `src/lib/content/pages.ts` (`ANSWER_PAGES`, `HUBS`). The hub lists from it, and `PUBLIC_PAGES`
  (decision 0037) includes it, so every page is in the sitemap, open without sign-in, and indexable. Tests check
  all three.
- **Pages are TSX, not MDX.** There are only a few pages, each with a plan table and a RinkDiagram drawn on the
  server, and no new dependency is needed. Shared frame in `src/components/content/content-frame.tsx`; metadata
  and structured data (Article with Brett as author, BreadcrumbList, CollectionPage for hubs) in
  `src/lib/content/meta.ts`.
- **Publish test** (from the plan): a page ships only with a real plan, real numbers and an on-ice lesson. The
  words are Brett's (`my-writing-style`), and he reviews each page before merge.
- **No affiliations named** (decision 0019 still holds). Plans use library drills, described in our own words.
- The one call to action is still "Plan your first practice" (decision 0033), counted as `form_start` with the
  page's path. The landing footer links to `/u7`.

## Limits
- Admin → Analytics doesn't split visits by page yet: content-page visits count with landing visits. The plan's
  measurement step adds a per-page view.
- "Get this plan timed to your ice" goes to sign-up, not a team setup pre-filled from the page. That's a later change.
