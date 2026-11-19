// The public site's map (decision 0037): which pages search engines and AI assistants may list, and
// which paths anyone can open without signing in. The sitemap is built from PUBLIC_PAGES, and the
// middleware asks isOpenPath(), so a new public page added here can't end up behind sign-in.

export const SITE = 'https://firstpass.coach';

/** AI search and answer crawlers, named in robots.txt so the welcome is explicit. */
export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

export type PublicPage = {
  path: string;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
  priority: number;
};

/** Public pages that belong in search. Every one sets `robots: { index: true }` in its own metadata. */
export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
];

/** Sections for the coming answer pages (SEO and AEO plan, 2026-11-19): age hubs, plans, associations. */
export const CONTENT_SECTIONS = ['/u5', '/u7', '/u9', '/plans', '/associations'];

// The installable app's files (decision 0021) load before anyone signs in: the manifest, icons, the
// service worker and the offline page.
const APP_FILES = ['/manifest.webmanifest', '/sw.js', '/offline.html', '/apple-icon.png', '/icon.svg'];
// Files for crawlers (decision 0037).
const CRAWLER_FILES = ['/robots.txt', '/sitemap.xml'];
// /api/cron/ is called by the database's timer and checks its own secret (decision 0010).
// /join/ shows who invited you and signs you in on the spot (decision 0013); joining itself needs a
// session. /email/ holds the logo the emails load, /og/ the share card. /s/ is the survey and
// /unsubscribe/ stops survey emails, both by token, no sign-in (decision 0027).
const OPEN_PREFIXES = ['/icons/', '/og/', '/login', '/signup', '/auth/', '/not-allowed', '/p/', '/api/cron/', '/api/vitals', '/join/', '/email/', '/s/', '/unsubscribe/'];

/** True when a signed-out visitor may open this path. */
export function isOpenPath(path: string): boolean {
  if (APP_FILES.includes(path) || CRAWLER_FILES.includes(path)) return true;
  if (PUBLIC_PAGES.some((p) => p.path === path)) return true;
  // Whole segments only: /u7 and /u7/first-practice, never /u7anything.
  if (CONTENT_SECTIONS.some((s) => path === s || path.startsWith(`${s}/`))) return true;
  return OPEN_PREFIXES.some((p) => path.startsWith(p));
}
