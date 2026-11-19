# 0037 · Search and AI crawler basics

Date: 2026-11-19 · Decided by: Brett ("I want Firstpass to the top option for AEO and SEO rankings" … "let's
start working through the tasks"). Task 1 of the "Firstpass SEO and AEO plan" project doc.

## Decision
- **robots.txt and sitemap.xml exist** (`src/app/robots.ts`, `src/app/sitemap.ts`). Before this, the middleware
  sent signed-out requests for both to `/login`, so crawlers got the sign-in page.
- **AI answer crawlers are welcome** on public pages and named explicitly (GPTBot, OAI-SearchBot, ChatGPT-User,
  ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended). Only `/api/` and `/admin` are
  disallowed. Shared plans, surveys and join links stay crawlable but carry noindex, because a crawler has to fetch
  a page to see its noindex tag.
- **One map of the public site**: `src/lib/site/public-pages.ts`. `PUBLIC_PAGES` builds the sitemap, and the
  middleware's `isOpenPath()` reads the same list, so a public page can't end up behind sign-in. The coming
  answer-page sections (`/u5`, `/u7`, `/u9`, `/practice-plans`, `/associations`) are open already, matched by whole segment.
  Not `/plans`: that is the coaches' own Plans area and stays behind sign-in (a test checks it).
- **App pages stay out of search.** The root layout keeps `robots: noindex`; each public page opts in. A test
  fails if a page in `PUBLIC_PAGES` doesn't set `index: true`.
- **Landing title** is "Firstpass · Hockey practice planner for U5–U9 coaches", and the footer says "Hockey
  practice planner, built in Nanaimo, BC", because "first pass" is an everyday phrase and the brand needs
  "hockey" beside it.
- **Structured data** on the landing page: Organization, WebSite, WebApplication (first team free, CAD). No FAQ
  schema (no visible FAQ) and no ratings.

## Not in this change
- Google Search Console and Bing Webmaster Tools: Brett verifies the domain and submits the sitemap.
- The answer pages themselves (the next tasks in the plan).
