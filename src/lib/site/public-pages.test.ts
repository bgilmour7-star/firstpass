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
  const files: Record<string, string> = { '/': 'src/app/page.tsx', '/privacy': 'src/app/privacy/page.tsx' };
  it('every public page sets index: true (the root layout defaults to noindex)', () => {
    for (const p of PUBLIC_PAGES) {
      const file = files[p.path];
      expect(file, `add ${p.path} to this test's file map`).toBeTruthy();
      expect(readFileSync(file, 'utf8')).toMatch(/robots:\s*\{\s*index:\s*true/);
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
