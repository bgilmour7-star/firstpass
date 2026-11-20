import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { AI_BOTS, CONTENT_SECTIONS, PUBLIC_PAGES, SITE, isOpenPath } from './public-pages';
import { jsonLd, landingStructuredData } from './structured-data';

// Decision 0037: crawlers can read the public site, and public pages can't fall behind sign-in.

describe('robots.txt', () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  it('points at the sitemap', () => expect(r.sitemap).toBe(`${SITE}/sitemap.xml`));
  it('never blocks the site itself', () => {
    for (const rule of rules) {
      const blocked = [rule.disallow ?? []].flat();
      expect(blocked).not.toContain('/');
      expect(blocked).not.toContain('/p/');
    }
  });
  it('names the AI crawlers', () => expect(rules.some((rule) => [rule.userAgent].flat().includes('GPTBot'))).toBe(true));
  it('lists each AI crawler once', () => expect(new Set(AI_BOTS).size).toBe(AI_BOTS.length));
});

describe('sitemap.xml', () => {
  it('lists every public page as an absolute firstpass.coach URL', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toHaveLength(PUBLIC_PAGES.length);
    for (const u of urls) expect(u.startsWith(SITE)).toBe(true);
  });
});

describe('isOpenPath', () => {
  it('opens every public page, the crawler files and the content sections', () => {
    for (const p of PUBLIC_PAGES) expect(isOpenPath(p.path), p.path).toBe(true);
    for (const f of ['/robots.txt', '/sitemap.xml']) expect(isOpenPath(f), f).toBe(true);
    for (const s of CONTENT_SECTIONS) {
      expect(isOpenPath(s), s).toBe(true);
      expect(isOpenPath(`${s}/a-page`), s).toBe(true);
    }
  });
  it('matches whole segments only', () => {
    expect(isOpenPath('/u7anything')).toBe(false);
    expect(isOpenPath('/practice-plansecret')).toBe(false);
  });
  it('keeps what was open before', () => {
    for (const p of ['/login', '/signup', '/auth/callback', '/p/abc', '/join/abc', '/s/abc', '/unsubscribe/abc', '/og/x.png', '/icons/icon-192.png', '/manifest.webmanifest', '/sw.js', '/api/cron/x', '/api/vitals'])
      expect(isOpenPath(p), p).toBe(true);
  });
  it('keeps the app behind sign-in', () => {
    for (const p of ['/team', '/plans', '/plans/x', '/plans/x/check-in', '/admin', '/admin/analytics', '/account', '/api/other']) expect(isOpenPath(p), p).toBe(false);
  });
});

describe('public pages opt in to search', () => {
  // Each page's own file, or the shared answer-page metadata (answerMetadata sets index: true).
  const file = (path: string) => (path === '/' ? 'src/app/page.tsx' : `src/app${path}/page.tsx`);
  it('every public page sets index: true (the root layout defaults to noindex)', () => {
    for (const p of PUBLIC_PAGES) {
      const src = readFileSync(file(p.path), 'utf8');
      expect(/robots:\s*\{\s*index:\s*true/.test(src) || /export const metadata = (answer|hub)Metadata\(/.test(src), p.path).toBe(true);
    }
  });
});

describe('landing structured data', () => {
  it('describes the organization and the app', () => {
    const data = JSON.parse(jsonLd(landingStructuredData()));
    const types = data['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'WebApplication']));
  });
  it('escapes < so it cannot close the script tag', () => expect(jsonLd({ a: '</script>' })).not.toContain('</'));
});

describe('answer pages', () => {
  it('are in the sitemap, open without sign-in, and indexable', async () => {
    const { ANSWER_PAGES, HUBS } = await import('@/lib/content/pages');
    const { answerMetadata, hubMetadata } = await import('@/lib/content/meta');
    const urls = sitemap().map((e) => e.url);
    for (const p of ANSWER_PAGES) {
      expect(urls).toContain(`${SITE}${p.path}`);
      expect(isOpenPath(p.path), p.path).toBe(true);
      expect(answerMetadata(p).robots).toMatchObject({ index: true });
      expect(HUBS.some((h) => h.age === p.age), `${p.path} has a hub`).toBe(true);
    }
    for (const h of HUBS) expect(hubMetadata(h).robots).toMatchObject({ index: true });
  });
});

describe('drills on public pages', () => {
  it('are listed once per page and exist in the library', async () => {
    const { existsSync } = await import('node:fs');
    const { PUBLIC_DRILLS, allPublicDrillIds } = await import('@/lib/content/public-drills');
    for (const id of allPublicDrillIds()) expect(existsSync(`content/drills/${id}.json`), id).toBe(true);
    for (const page of Object.keys(PUBLIC_DRILLS)) expect(PUBLIC_PAGES.some((p) => p.path === page), page).toBe(true);
  });
  it('the files that name drills only name listed ones', async () => {
    const { readdirSync } = await import('node:fs');
    const { PUBLIC_DRILLS } = await import('@/lib/content/public-drills');
    const files: Record<string, string> = { '/': 'src/components/landing/landing.tsx', '/u7/first-practice': 'src/app/u7/first-practice/page.tsx', '/u7/keep-kids-listening': 'src/app/u7/keep-kids-listening/page.tsx' };
    const names = readdirSync('content/drills').map((f) => ({ id: f.replace(/\.json$/, ''), name: JSON.parse(readFileSync(`content/drills/${f}`, 'utf8')).funName as string }));
    for (const [page, file] of Object.entries(files)) {
      const src = readFileSync(file, 'utf8');
      const named = names.filter((d) => src.includes(`'${d.name}'`) || src.includes(`/${d.id}.json`)).map((d) => d.id);
      for (const id of named) expect(PUBLIC_DRILLS[page], `${page} names ${id}: add it to PUBLIC_DRILLS`).toContain(id);
    }
  });
});
