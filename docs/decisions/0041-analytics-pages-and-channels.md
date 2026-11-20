# 0041 · Analytics by page and by channel

Date: 2026-11-19 · Decided by: Brett ("Okay", to the measurement step of the "Firstpass SEO and AEO plan").

## Decision
- Admin → Analytics reads each visit's **path**, which has been recorded since decision 0019 but never read back. Its
  first section is now **Public site**, covering the landing page and the answer pages.
- **Pages**: each public page (landing, hubs, answer pages; privacy records no visits) with its visitors and how many tapped "Plan your
  first practice" on that page. Labels come from `src/lib/content/pages.ts`. Paths that aren't public pages are left
  out, and trailing slashes and queries are ignored.
- **How they found us**: visitors by channel. Search, AI assistants (ChatGPT, Perplexity, Claude, Gemini, Copilot and
  others), Social, Email (decision 0036 tags and webmail), Shared links (`share`, `shared-ice`, `invite`), Other sites, Direct.
  `channelOf()` in `src/lib/site/summary.ts`. The source table below it stays for the detail.
- No database change, no new data collected, still no cookies.

## Limits
- Search engines and AI apps often send no referrer (in-app browsers, privacy settings), so those visits land in
  Direct. Search Console stays the source for search words.
- Taps are counted per page. Accounts aren't linked to a page (no cookies), so the funnel's later steps stay site-wide.
