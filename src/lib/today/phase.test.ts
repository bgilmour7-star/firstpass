import { describe, expect, it } from 'vitest';
import { currentIndex, isBreak, practicePhase, upNextIndex, whenLabel } from './phase';

const start = 8 * 60 + 15;
const end = 9 * 60 + 15;

describe('practicePhase', () => {
  it('is Before on an earlier day and After on a later one', () => {
    expect(practicePhase('2026-11-21', '2026-11-16', 600, start, end)).toBe('before');
    expect(practicePhase('2026-11-14', '2026-11-16', 100, start, end)).toBe('after');
  });
  it('turns rink-side 15 minutes before the start, and After at the end', () => {
    const d = '2026-11-21';
    expect(practicePhase(d, d, null, start, end)).toBe('before');
    expect(practicePhase(d, d, start - 16, start, end)).toBe('before');
    expect(practicePhase(d, d, start - 15, start, end)).toBe('during');
    expect(practicePhase(d, d, end - 0.1, start, end)).toBe('during');
    expect(practicePhase(d, d, end, start, end)).toBe('after');
  });
});

describe('whenLabel', () => {
  it('says today, tomorrow or in N days', () => {
    expect(whenLabel('2026-11-16', '2026-11-16')).toBe('today');
    expect(whenLabel('2026-11-17', '2026-11-16')).toBe('tomorrow');
    expect(whenLabel('2026-11-21', '2026-11-16')).toBe('in 5 days');
    expect(whenLabel('2026-12-01', '2026-11-30')).toBe('tomorrow');
  });
});

describe('currentIndex and upNextIndex', () => {
  const spans = [
    { s: 0, e: 5 },
    { s: 5, e: 13 },
    { s: 13, e: 15 },
  ];
  it('is the first block before the start, the running one during, -1 after', () => {
    expect(currentIndex(spans, -10)).toBe(0);
    expect(currentIndex(spans, 6)).toBe(1);
    expect(currentIndex(spans, 15)).toBe(-1);
  });
  it('skips water for Up next, unless water is all that is left', () => {
    const blocks = [{ kind: 'drill' }, { kind: 'activity', title: 'Water' }, { kind: 'stations' }, { kind: 'activity', title: 'Water' }];
    expect(upNextIndex(blocks, 0)).toBe(2);
    expect(upNextIndex(blocks, 2)).toBe(3);
    expect(upNextIndex(blocks, 3)).toBe(-1);
    expect(upNextIndex(blocks, -1)).toBe(-1);
  });
  it('treats water and breaks as breaks, not the huddle', () => {
    expect(isBreak({ kind: 'activity', title: 'Water break' })).toBe(true);
    expect(isBreak({ kind: 'activity', title: 'Huddle & shout-outs' })).toBe(false);
    expect(isBreak({ kind: 'drill' })).toBe(false);
    expect(isBreak({ kind: 'activity', activity: 'water', title: 'Drink up' })).toBe(true);
  });
});
