import { describe, expect, it } from 'vitest';
import { change, summarize, summarizeGrowth } from './summary';
import type { PageEvent, WaitlistEntry } from './schema';

const NOW = new Date('2026-10-20T19:00:00Z'); // noon in Vancouver
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
const view = (at: string, visitor: string, extra: Partial<PageEvent> = {}): PageEvent => ({ occurredAt: at, name: 'view', visitor, source: null, device: 'phone', region: 'Nanaimo, BC', ...extra });
const entry = (at: string, extra: Partial<WaitlistEntry> = {}): WaitlistEntry => ({ id: at, email: `${at}@example.com`, kind: 'coach', ageGroup: 'U7', orgName: null, teamCount: null, source: null, status: 'new', createdAt: at, ...extra });

describe('summarize', () => {
  it('counts visits, uniques, sign-ups and conversion in the period, and the period before', () => {
    const events = [view(ago(1), 'a'), view(ago(1, 1), 'a'), view(ago(2), 'b'), view(ago(10), 'c'), view(ago(8), 'old')];
    const waitlist = [entry(ago(1)), entry(ago(9))];
    const s = summarize(events, waitlist, { days: 7, now: NOW });
    expect(s.visits).toEqual({ now: 3, before: 2 });
    expect(s.uniques).toEqual({ now: 2, before: 2 });
    expect(s.signups.now).toBe(1);
    expect(s.signups.before).toBe(1);
    expect(s.conversion.now).toBeCloseTo(0.5);
  });

  it('has one row per day, quiet days included, and finds the peak', () => {
    const s = summarize([view(ago(0), 'a'), view(ago(0, 1), 'b'), view(ago(3), 'c')], [], { days: 7, now: NOW });
    expect(s.daily).toHaveLength(7);
    expect(s.daily.at(-1)).toEqual({ day: '2026-10-20', visits: 2, signups: 0 });
    expect(s.peak).toEqual({ day: '2026-10-20', visits: 2 });
    expect(s.from).toBe('2026-10-14');
  });

  it('builds the funnel from distinct visitors and sign-ups', () => {
    const at = ago(1);
    const events: PageEvent[] = [view(at, 'a'), view(at, 'b'), view(at, 'c'), { ...view(at, 'a'), name: 'reached_form' }, { ...view(at, 'b'), name: 'reached_form' }, { ...view(at, 'a'), name: 'form_start' }, { ...view(at, 'a'), name: 'form_start' }];
    const s = summarize(events, [entry(at)], { days: 7, now: NOW });
    expect(s.funnel.map((f) => f.visitors)).toEqual([3, 2, 1, 1]);
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
    expect(s.conversion.now).toBeNull();
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
