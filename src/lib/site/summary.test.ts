import { describe, expect, it } from 'vitest';
import { change, channelOf, summarize, summarizeGrowth } from './summary';
import type { PageEvent, WaitlistEntry } from './schema';

const NOW = new Date('2026-10-20T19:00:00Z'); // noon in Vancouver
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
const view = (at: string, visitor: string, extra: Partial<PageEvent> = {}): PageEvent => ({ occurredAt: at, name: 'view', visitor, source: null, device: 'phone', region: 'Nanaimo, BC', ...extra });
const entry = (at: string, extra: Partial<WaitlistEntry> = {}): WaitlistEntry => ({ id: at, email: `${at}@example.com`, kind: 'coach', ageGroup: 'U7', orgName: null, teamCount: null, source: null, status: 'new', createdAt: at, ...extra });

describe('summarize', () => {
  it('counts visits, uniques and association leads in the period, and the period before', () => {
    const events = [view(ago(1), 'a'), view(ago(1, 1), 'a'), view(ago(2), 'b'), view(ago(10), 'c'), view(ago(8), 'old')];
    const waitlist = [entry(ago(1)), entry(ago(9))];
    const s = summarize(events, waitlist, { days: 7, now: NOW });
    expect(s.visits).toEqual({ now: 3, before: 2 });
    expect(s.uniques).toEqual({ now: 2, before: 2 });
    expect(s.signups.now).toBe(1);
    expect(s.signups.before).toBe(1);
  });

  it('has one row per day, quiet days included, and finds the peak', () => {
    const s = summarize([view(ago(0), 'a'), view(ago(0, 1), 'b'), view(ago(3), 'c')], [], { days: 7, now: NOW });
    expect(s.daily).toHaveLength(7);
    expect(s.daily.at(-1)).toEqual({ day: '2026-10-20', visits: 2, accounts: 0 });
    expect(s.peak).toEqual({ day: '2026-10-20', visits: 2 });
    expect(s.from).toBe('2026-10-14');
  });

  it('builds the funnel from distinct visitors, taps, new accounts, and new teams that checked in (decisions 0033, 0034)', () => {
    const at = ago(1);
    const events: PageEvent[] = [view(at, 'a'), view(at, 'b'), view(at, 'c'), { ...view(at, 'a'), name: 'reached_form' }, { ...view(at, 'a'), name: 'form_start' }, { ...view(at, 'a'), name: 'form_start' }, { ...view(at, 'b'), name: 'form_start' }];
    const app = {
      teams: [{ id: 't1', createdAt: at }, { id: 't2', createdAt: at }, { id: 'old', createdAt: ago(30) }],
      practices: [{ teamId: 't1', createdAt: at, checkedIn: true }, { teamId: 't2', createdAt: at, checkedIn: false }, { teamId: 'old', createdAt: at, checkedIn: true }],
      accounts: [at, at, ago(0), ago(9)],
    };
    const s = summarize(events, [entry(at)], { days: 7, now: NOW, app });
    expect(s.funnel.map((f) => f.label)).toEqual(['Visited', 'Tapped Plan your first practice', 'Created an account', 'Made a team', 'Checked in after a practice']);
    expect(s.funnel.map((f) => f.visitors)).toEqual([3, 2, 3, 2, 1]);
    // New accounts: 3 this week, 1 the week before, and one bar per day.
    expect(s.accounts).toEqual({ now: 3, before: 1 });
    expect(s.daily.reduce((n, d) => n + d.accounts, 0)).toBe(3);
  });

  it('groups sources, with no tag counted as direct', () => {
    const at = ago(1);
    const s = summarize([view(at, 'a', { source: 'shared-ice' }), view(at, 'b', { source: 'shared-ice' }), view(at, 'c')], [entry(at, { source: 'shared-ice' })], { days: 7, now: NOW });
    expect(s.sources).toEqual([
      { source: 'shared-ice', visitors: 2, signups: 1 },
      { source: 'direct', visitors: 1, signups: 0 },
    ]);
  });

  it('shares devices and regions by visitor, folding the long tail', () => {
    const at = ago(1);
    const events = ['A', 'A', 'B', 'C', 'D', 'E'].map((r, i) => view(at, `v${i}`, { region: r, device: i ? 'phone' : 'desktop' }));
    const s = summarize(events, [], { days: 7, now: NOW });
    expect(s.regions.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D', 'Elsewhere']);
    expect(s.regions[0].share).toBeCloseTo(2 / 6);
    expect(s.devices[0]).toEqual({ label: 'Phone', share: 5 / 6 });
  });

  it('copes with no data at all', () => {
    const s = summarize([], [], { days: 30, now: NOW });
    expect(s.peak).toBeNull();
    expect(s.sources).toEqual([]);
  });
});

describe('change', () => {
  it('reads as a direction and amount', () => {
    expect(change(138, 100, 'percent')).toBe('↑ 38%');
    expect(change(5, 10, 'percent')).toBe('↓ 50%');
    expect(change(3, 0, 'percent')).toBeNull();
    expect(change(19, 12, 'count')).toBe('↑ 7');
    expect(change(0.071, 0.057, 'points')).toBe('↑ 1.4 pts');
    expect(change(4, 4, 'count')).toBe('No change');
  });
});

describe('summarizeGrowth', () => {
  it('gives all-time totals, the period and the period before, and running totals per day', () => {
    const g = { teams: [ago(30), ago(2)], coaches: [ago(30), ago(10), ago(2), ago(0, 1)] };
    const s = summarizeGrowth(g, { days: 7, now: NOW });
    expect(s.teams).toEqual({ total: 2, inPeriod: 1, before: 0 });
    expect(s.coaches).toEqual({ total: 4, inPeriod: 2, before: 1 });
    expect(s.daily).toHaveLength(7);
    expect(s.daily[0]).toEqual({ day: '2026-10-14', teams: 1, coaches: 2 });
    expect(s.daily.at(-1)).toEqual({ day: '2026-10-20', teams: 2, coaches: 4 });
  });

  it('is all zeros with nobody yet', () => {
    const s = summarizeGrowth({ teams: [], coaches: [] }, { days: 7, now: NOW });
    expect(s.coaches.total).toBe(0);
    expect(s.daily.every((d) => d.teams === 0 && d.coaches === 0)).toBe(true);
  });
});

describe('channels and pages (decision 0041)', () => {
  it('sorts sources into channels', () => {
    expect(channelOf(null)).toBe('Direct');
    expect(channelOf('google.com')).toBe('Search');
    expect(channelOf('google.ca')).toBe('Search');
    expect(channelOf('bing.com')).toBe('Search');
    expect(channelOf('chatgpt.com')).toBe('AI assistants');
    expect(channelOf('perplexity.ai')).toBe('AI assistants');
    expect(channelOf('gemini.google.com')).toBe('AI assistants');
    expect(channelOf('l.facebook.com')).toBe('Social');
    expect(channelOf('reddit.com')).toBe('Social');
    expect(channelOf('1a2b3c4d-2')).toBe('Email');
    expect(channelOf('mail.google.com')).toBe('Email');
    expect(channelOf('mail.yahoo.com')).toBe('Email');
    expect(channelOf('edgeservices.bing.com')).toBe('AI assistants');
    expect(channelOf('share')).toBe('Shared links');
    expect(channelOf('nanaimominorhockey.com')).toBe('Other sites');
  });

  it('counts visitors per channel', () => {
    const s = summarize([view(ago(1), 'a', { source: 'google.com' }), view(ago(1), 'a', { source: 'google.com' }), view(ago(1), 'b', { source: 'chatgpt.com' }), view(ago(1), 'c')], [], { days: 7, now: NOW });
    expect(s.channels).toEqual([
      { channel: 'Search', visitors: 1 },
      { channel: 'AI assistants', visitors: 1 },
      { channel: 'Direct', visitors: 1 },
    ]);
  });

  it('counts visitors and taps per public page, with old events as the landing page', () => {
    const tap = (at: string, visitor: string, path: string): PageEvent => ({ ...view(at, visitor, { path }), name: 'form_start' });
    const s = summarize(
      [view(ago(1), 'a'), view(ago(1), 'b', { path: '/' }), view(ago(1), 'c', { path: '/u7/first-practice' }), view(ago(1), 'd', { path: '/u7/first-practice/' }), tap(ago(1), 'c', '/u7/first-practice'), view(ago(1), 'e', { path: '/nope' }), view(ago(1), 'f', { path: '/u7?x=1' })],
      [],
      { days: 7, now: NOW },
    );
    expect(s.pages).toEqual([
      { path: '/u7/first-practice', label: 'How do I run my first U7 hockey practice?', visitors: 2, taps: 1 },
      { path: '/', label: 'Home', visitors: 2, taps: 0 },
      { path: '/u7', label: 'U7 hockey practice help for volunteer coaches', visitors: 1, taps: 0 },
    ]);
  });
});

