# Decision: AI crawlers get the page metadata in the head
Status: Accepted · 2026-11-20 (SEO and AEO retest)

## Context
Next 15 streams a page's title, description, canonical and robots tags into the body, after the page starts loading, unless the visitor is on its list of crawlers that can't run JavaScript. That list has Bingbot and Google's preview bots, but not GPTBot, OAI-SearchBot, ClaudeBot or PerplexityBot. The retest found those crawlers got every public page with the metadata after `</head>`. Browsers and Googlebot fix this up when they run the page. AI crawlers read the raw HTML, so they may miss the title, description and canonical.

## Decision
`htmlLimitedBots` in `next.config.ts` is Next's own list plus the AI crawlers we name in robots.txt (and Claude-User, Perplexity-User). The list lives in `src/lib/site/bots.ts`, with a test that each AI crawler matches and a phone browser doesn't. Those crawlers get the full page with metadata in `<head>`, the same as Bingbot.

Also from the retest: the associations title no longer repeats "Firstpass", the associations and comparison descriptions fit in about 155 characters, privacy has a canonical, and each answer page links to the other answers for its age group.

## Revisit when
Next changes its default list (check `next/dist/shared/lib/router/utils/html-bots.js` on upgrade), or a new AI crawler is added to robots.txt.
