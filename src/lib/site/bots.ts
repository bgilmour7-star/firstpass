// Crawlers (decisions 0037, 0047). Plain module with no path aliases, so next.config.ts can import it.

/** AI search and answer crawlers, named in robots.txt so the welcome is explicit. */
export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

/** Next's own list of crawlers that can't run JavaScript (next/dist/shared/lib/router/utils/html-bots.js, 15.5).
 *  Next streams a page's title, description and canonical into the body for everyone else. */
const NEXT_HTML_LIMITED = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;

/** Crawlers that get the metadata in <head> on the first byte: Next's list plus the AI crawlers, which Next
 *  doesn't list (GPTBot, ClaudeBot and PerplexityBot were getting it streamed into the body). */
export const HTML_LIMITED_BOTS = new RegExp(`${NEXT_HTML_LIMITED}|${[...AI_BOTS, 'Claude-User', 'Perplexity-User'].join('|')}`, 'i');
