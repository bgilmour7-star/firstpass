import { describe, expect, it } from 'vitest';
import { expectedAt, goalScore, goalWords, kidsUp, nextMonth, pace, status, type Goal } from './pace';
import { targetShares, timeShares, TARGET } from './ice-time';
import { ATTRIBUTES } from './levels';
import type { Block } from '../plans/schema';

const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g', attribute: 'Shooting', target: [0, 2, 6, 4, 0], byDate: '2027-03-15', baselineRoundId: 'oct', baselineScore: 2, setAt: '', ...over });

describe('goal score and words', () => {
  it('scores the target spread', () => {
    expect(goalScore([0, 2, 6, 4, 0])).toBe(3.2);
    expect(goalScore([0, 0, 6, 6, 0])).toBe(3.5);
  });
  it('says the goal in plain words', () => {
    expect(goalWords([0, 0, 6, 6, 0])).toBe('Nobody below level 3, and 6 of 12 at level 4');
    expect(goalWords([0, 0, 4, 6, 2])).toBe('Nobody below level 3, and 8 of 12 at level 4 or better');
    expect(goalWords([1, 5, 6, 0, 0])).toBe('6 of 12 at level 3');
  });
});

describe('pace', () => {
  const from = { score: 2.0, date: '2026-10-01' };
  const to = { score: 3.0, date: '2027-03-01' };
  it('draws a straight line from the baseline to the goal', () => {
    expect(expectedAt(from, to, '2026-10-01')).toBe(2);
    expect(expectedAt(from, to, '2026-12-16')).toBeCloseTo(2.5, 1);
    expect(expectedAt(from, to, '2027-06-01')).toBe(3);
  });
  it('is on pace within 0.1, ahead from 0.2, else behind', () => {
    expect(status(2.2, 2.2, to, '2026-11-01')).toBe('on-pace');
    expect(status(2.1, 2.2, to, '2026-11-01')).toBe('on-pace');
    expect(status(2.4, 2.2, to, '2026-11-01')).toBe('ahead');
    expect(status(2.0, 2.2, to, '2026-11-01')).toBe('behind');
  });
  it('says reached or short at the date, and reached early', () => {
    expect(status(3.0, 3.0, to, '2027-03-01')).toBe('reached');
    expect(status(2.7, 3.0, to, '2027-03-01')).toBe('short');
    expect(status(3.1, 2.4, to, '2026-12-01')).toBe('reached');
  });
  it('turns the line into kids for next month', () => {
    expect(kidsUp(2.1, 2.4, 12)).toBe(4);
    expect(kidsUp(2.6, 2.4, 12)).toBe(0);
    expect(nextMonth('2026-12-01')).toBe('2027-01-01');
  });
  it('puts it together: the canvas case, Shooting behind in November', () => {
    const p = pace(goal({ target: [0, 0, 6, 6, 0], byDate: '2027-03-01' }), { month: '2026-10-01', score: 2.0 }, { month: '2026-11-01', score: 2.1 }, 12);
    expect(p.target).toBe(3.5);
    expect(p.expected).toBe(2.3);
    expect(p.status).toBe('behind');
    expect(p.next).toBe(6);
  });
});

describe('ice time', () => {
  const byId = new Map([
    ['skate', { focus: [{ attribute: 'Skating' as const, level: 2 as const, why: '' }] }],
    ['shoot', { focus: [{ attribute: 'Shooting' as const, level: 2 as const, why: '' }, { attribute: 'Effort & fun' as const, level: 1 as const, why: '' }] }],
  ]);
  const b = (drillId: string, minutes: number): Block => ({ id: drillId, kind: 'drill', drillId, minutes, levels: [1] });
  it('counts Main fully and Some at half, activities not at all', () => {
    const s = timeShares([{ blocks: [b('skate', 10), b('shoot', 10), { id: 'w', kind: 'activity', activity: 'water', title: 'Water', minutes: 5, note: '' }] }], byId);
    expect(s.Skating).toBeCloseTo(0.4);
    expect(s.Shooting).toBeCloseTo(0.4);
    expect(s['Effort & fun']).toBeCloseTo(0.2);
  });
  it('gives goals more share, keeps every skill at 10% or more, and adds up to 100%', () => {
    const even = targetShares([]);
    expect(even.Skating).toBeCloseTo(1 / 6);
    const t = targetShares([{ attribute: 'Shooting', gap: 0.9, behind: true }, { attribute: 'Skating', gap: 0.8, behind: false }]);
    expect(t.Shooting).toBeGreaterThan(t.Skating);
    expect(t.Skating).toBeGreaterThan(t.Passing);
    for (const a of ATTRIBUTES) expect(t[a]).toBeGreaterThanOrEqual(TARGET.floor - 1e-9);
    expect(ATTRIBUTES.reduce((x, a) => x + t[a], 0)).toBeCloseTo(1);
    const big = targetShares([{ attribute: 'Shooting', gap: 3, behind: true }, { attribute: 'Skating', gap: 3, behind: true }, { attribute: 'Passing', gap: 3, behind: true }]);
    for (const a of ATTRIBUTES) expect(big[a]).toBeGreaterThanOrEqual(TARGET.floor - 1e-9);
    expect(ATTRIBUTES.reduce((x, a) => x + big[a], 0)).toBeCloseTo(1);
  });
});
