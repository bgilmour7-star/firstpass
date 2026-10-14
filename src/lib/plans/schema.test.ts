import { describe, expect, it } from 'vitest';
import { addMinutes, blockSchema, copyBlocks, newDrillIds, practiceFocus, rotation, startTimes, starterBlocks, totalMinutes, type Block } from './schema';

const drill = (id: string, minutes = 8): Block => ({ id, kind: 'drill', drillId: id, minutes });
const stations = (ids: (string | null)[], minutes = 8): Block => ({
  id: 'st',
  kind: 'stations',
  minutes,
  stations: ids.map((d, i) => ({ station: (['A', 'B', 'C'] as const)[i], drillId: d, coach: '' })),
});

describe('timing', () => {
  it('stations count once per rotation', () => {
    expect(totalMinutes([drill('a', 5), stations(['x', 'y', 'z'], 8)])).toBe(29);
  });
  it('retimes every block after a change', () => {
    expect(startTimes('17:45', [drill('a', 5), stations(['x', 'y', 'z'], 8), drill('b', 3)])).toEqual(['17:45', '17:50', '18:14']);
  });
  it('wraps the clock', () => {
    expect(addMinutes('23:50', 20)).toBe('00:10');
  });
  it('a starter plan fills the practice exactly', () => {
    expect(totalMinutes(starterBlocks(60))).toBe(60);
  });
});

describe('rotation', () => {
  it('every group visits every station once', () => {
    const r = rotation(['Eagles', 'Bears', 'Sharks'], 3);
    expect(r[0]).toEqual(['Eagles', 'Bears', 'Sharks']);
    for (let i = 0; i < 3; i++) expect(new Set(r.map((row) => row[i])).size).toBe(3);
  });
});

describe('focus', () => {
  const drills = new Map([
    ['skate', { focus: [{ attribute: 'Skating' as const, level: 2 as const, why: '' }] }],
    ['pass', { focus: [{ attribute: 'Passing' as const, level: 2 as const, why: '' }, { attribute: 'Skating' as const, level: 1 as const, why: '' }] }],
    ['game', { focus: [{ attribute: 'Game sense' as const, level: 1 as const, why: '' }] }],
  ]);
  it('is minute-weighted and stations count full minutes', () => {
    const f = practiceFocus([drill('skate', 10), stations(['pass', 'game', null], 8)], drills);
    const by = Object.fromEntries(f.map((x) => [x.attribute, x]));
    expect(by.Skating.score).toBe(28);
    expect(by.Passing.score).toBe(16);
    expect(by.Skating.level).toBe(2);
    expect(by.Passing.level).toBe(2);
    expect(by['Game sense'].level).toBe(1);
    expect(by.Shooting.level).toBe(0);
  });
});

describe('new to the kids', () => {
  it('flags drills not used in earlier practices', () => {
    const earlier = [{ id: 'p1', date: '2026-10-07', blocks: [drill('skate')] }];
    const plan = { id: 'p2', date: '2026-10-14', blocks: [drill('skate'), stations(['pass', 'skate', null])] };
    expect([...newDrillIds(plan, earlier)]).toEqual(['pass']);
  });
  it('ignores later practices', () => {
    const later = [{ id: 'p3', date: '2026-10-21', blocks: [drill('pass')] }];
    expect([...newDrillIds({ id: 'p2', date: '2026-10-14', blocks: [drill('pass')] }, later)]).toEqual(['pass']);
  });
});

describe('copy', () => {
  it('copies blocks with fresh ids and independent stations', () => {
    const src = [stations(['a', 'b', 'c'])];
    const c = copyBlocks(src);
    expect(c[0].id).not.toBe(src[0].id);
    if (c[0].kind === 'stations' && src[0].kind === 'stations') {
      c[0].stations[0].drillId = 'z';
      expect(src[0].stations[0].drillId).toBe('a');
    }
    expect(blockSchema.safeParse(c[0]).success).toBe(true);
  });
});
