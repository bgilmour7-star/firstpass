import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  blockForDrill,
  blockSchema,
  changeBlock,
  copyBlocks,
  drillIds,
  isAdapted,
  isOldRotation,
  blockLevel,
  newDrillIds,
  practiceFocus,
  practiceSchema,
  rotationToday,
  startTimes,
  starterBlocks,
  todayUnits,
  totalMinutes,
  unusedZones,
  zoneFor,
  type Block,
  type RotationBlock,
} from './schema';

const drill = (id: string, minutes = 8): Block => ({ id, kind: 'drill', drillId: id, minutes, level: 1 });
const rotation = (ids: (string | null)[], minutes = 8, drop: ('A' | 'B' | 'C')[] = []): RotationBlock => ({
  id: 'rot',
  kind: 'rotation',
  minutes,
  drillId: null,
  stations: ids.map((d, i) => ({ station: (['A', 'B', 'C'] as const)[i], drillId: d, coach: '' })),
  drop,
});
const team = { groups: [{ group: 'Sharks' as const, skaters: 3 }, { group: 'Bears' as const, skaters: 4 }, { group: 'Eagles' as const, skaters: 5 }] };

describe('timing', () => {
  it('a rotation counts every station it runs', () => {
    expect(totalMinutes([drill('a', 5), rotation(['x', 'y', 'z'], 8)])).toBe(29);
  });
  it('a rotation runs one station per group today', () => {
    expect(totalMinutes([drill('a', 5), rotation(['x', 'y', 'z'], 8)], 2)).toBe(21);
  });
  it('retimes every block after a change', () => {
    expect(startTimes('17:45', [drill('a', 5), rotation(['x', 'y', 'z'], 8), drill('b', 3)])).toEqual(['17:45', '17:50', '18:14']);
  });
  it('wraps the clock', () => {
    expect(addMinutes('23:50', 20)).toBe('00:10');
  });
  it('a starter plan fills the practice exactly', () => {
    expect(totalMinutes(starterBlocks(60))).toBe(60);
  });
});

describe('older plans', () => {
  it('read a saved "stations" rotation as a rotation', () => {
    const old = { id: 's', kind: 'stations', minutes: 8, stations: [{ station: 'A', drillId: 'x', coach: '' }, { station: 'B', drillId: null, coach: '' }] };
    const b = blockSchema.parse(old);
    expect(b.kind).toBe('rotation');
  });
  it('read a drill block without a level', () => {
    expect(blockSchema.parse({ id: 'd', kind: 'drill', drillId: 'x', minutes: 5 })).toMatchObject({ level: 1 });
  });
  it('read a practice without attendance', () => {
    const p = practiceSchema.parse({ id: 'p', teamId: 't', date: '2026-10-15', startTime: '17:45', minutes: 60, ice: 'half', status: 'draft', blocks: [] });
    expect(p.attendance).toBeNull();
  });
});

describe("who's here today", () => {
  it('uses the usual groups, easiest first', () => {
    expect(todayUnits(team, null).map((u) => u.label)).toEqual(['Sharks', 'Bears', 'Eagles']);
  });
  it('merges groups and adds their skaters', () => {
    const u = todayUnits(team, { counts: { Sharks: 2, Bears: 3, Eagles: 4 }, merges: [['Bears', 'Sharks']] });
    expect(u.map((x) => [x.key, x.skaters])).toEqual([
      ['Sharks+Bears', 5],
      ['Eagles', 4],
    ]);
  });
  it('drops a group with nobody there', () => {
    expect(todayUnits(team, { counts: { Sharks: 0, Bears: 4, Eagles: 5 }, merges: [['Sharks', 'Bears']] }).map((u) => u.key)).toEqual(['Bears', 'Eagles']);
  });
  it('knows when today differs from usual', () => {
    expect(isAdapted(team, { counts: { Sharks: 3, Bears: 4, Eagles: 5 }, merges: [] })).toBe(false);
    expect(isAdapted(team, { counts: { Sharks: 3, Bears: 4, Eagles: 5 }, merges: [['Sharks', 'Bears']] })).toBe(true);
  });
});

describe('blocks adapt', () => {
  const units2 = todayUnits(team, { counts: { Sharks: 2, Bears: 3, Eagles: 4 }, merges: [['Sharks', 'Bears']] });
  const snake = {
    groupModel: 'basic' as const,
    levels: [
      { name: 'Puck the whole way', adds: '', diagram: {} },
      { name: 'Give-and-go', adds: '', diagram: {} },
    ],
  };
  const knock = {
    stations: [
      { station: 'A' as const, group: 'Eagles' as const, version: '3 on 3, two pucks' },
      { station: 'B' as const, group: 'Bears' as const, version: '3 on 3' },
      { station: 'C' as const, group: 'Sharks' as const, version: '2 on 2 with a coach' },
    ],
  };
  it('a drill block runs one level for everyone, Level 1 by default', () => {
    expect(blockLevel(snake, { level: 1 })).toBe(1);
    expect(blockLevel(snake, { level: 3 })).toBe(3);
  });
  it('a level the drill no longer has falls back to its last level', () => {
    expect(blockLevel({ groupModel: 'basic', levels: [] }, { level: 3 })).toBe(1);
    expect(blockLevel(snake, { level: 5 as number })).toBe(3);
  });
  it('older plans: one chosen level is kept, a mix or per-group levels become Level 1', () => {
    const read = (b: object) => blockSchema.parse({ id: 'x', kind: 'drill', drillId: 'snake', minutes: 10, ...b });
    expect(read({ use: [2], levels: {} })).toMatchObject({ level: 2 });
    expect(read({ use: [1, 3], levels: { Sharks: 1 } })).toMatchObject({ level: 1 });
    expect(read({ levels: { Sharks: '1.0', Bears: '1.2' } })).toMatchObject({ level: 1 });
    expect(read({ level: 2 })).not.toHaveProperty('use');
  });
  it('a merged group gets its easier group’s station, and the rest sit out', () => {
    expect(zoneFor(knock, units2[0], {})).toBe('C');
    expect(unusedZones(knock, units2, {})).toEqual(['B']);
    expect(unusedZones(knock, units2, { 'Sharks+Bears': 'B' })).toEqual(['C']);
  });
  it('a rotation drops the last station unless the coach picks another', () => {
    expect(rotationToday(rotation(['x', 'y', 'z']), 2).off).toEqual(['C']);
    expect(rotationToday(rotation(['x', 'y', 'z'], 8, ['B']), 2).off).toEqual(['B']);
    expect(rotationToday(rotation(['x', 'y', 'z'], 8, ['B']), 3).off).toEqual([]);
  });
});

describe('changing a block', () => {
  it('keeps its place and minutes', () => {
    const water: Block = { id: 'w', kind: 'activity', activity: 'water', title: 'Water', minutes: 3, note: '' };
    const d = changeBlock(water, 'drill');
    expect(d).toMatchObject({ id: 'w', kind: 'drill', drillId: '', minutes: 3 });
  });
  it('a drill keeps its drill when it becomes station-based', () => {
    expect(changeBlock(drill('knock', 13), 'stations')).toMatchObject({ kind: 'stations', drillId: 'knock', minutes: 13 });
  });
  it('a rotation spreads the minutes over one station per group', () => {
    const r = changeBlock(drill('x', 24), 'rotation');
    expect(r).toMatchObject({ kind: 'rotation', drillId: null, minutes: 8 });
    expect(totalMinutes([r])).toBe(24);
  });
  it('a rotation drill brings its zones', () => {
    const r = blockForDrill({ id: 'rot', minutes: 8, groupModel: 'rotation', zones: [{ station: 'A', name: 'a', how: '', cue: '' }, { station: 'C', name: 'c', how: '', cue: '' }] });
    expect(r).toMatchObject({ kind: 'rotation', drillId: 'rot' });
    expect(r.kind === 'rotation' && r.stations.map((s) => s.station)).toEqual(['A', 'C']);
    expect(drillIds(r)).toEqual(['rot']);
  });
  it('an older rotation built from single drills still reads', () => {
    expect(isOldRotation(rotation(['x', 'y', null]))).toBe(true);
    expect(isOldRotation(rotation([null, null]))).toBe(false);
  });
  it('a station drill from the library goes in as stations', () => {
    expect(blockForDrill({ id: 'knock', minutes: 12, groupModel: 'stations' }).kind).toBe('stations');
    expect(blockForDrill({ id: 'snake', minutes: 10, groupModel: 'basic' }).kind).toBe('drill');
  });
});

describe('focus', () => {
  const drills = new Map([
    ['skate', { focus: [{ attribute: 'Skating' as const, level: 2 as const, why: '' }] }],
    ['pass', { focus: [{ attribute: 'Passing' as const, level: 2 as const, why: '' }, { attribute: 'Skating' as const, level: 1 as const, why: '' }] }],
    ['game', { focus: [{ attribute: 'Game sense' as const, level: 1 as const, why: '' }] }],
  ]);
  it('is minute-weighted and rotation stations count full minutes', () => {
    const f = practiceFocus([drill('skate', 10), rotation(['pass', 'game', null], 8)], drills);
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
    const plan = { id: 'p2', date: '2026-10-14', blocks: [drill('skate'), rotation(['pass', 'skate', null])] };
    expect([...newDrillIds(plan, earlier)]).toEqual(['pass']);
  });
  it('ignores later practices', () => {
    const later = [{ id: 'p3', date: '2026-10-21', blocks: [drill('pass')] }];
    expect([...newDrillIds({ id: 'p2', date: '2026-10-14', blocks: [drill('pass')] }, later)]).toEqual(['pass']);
  });
});

describe('copy', () => {
  it('copies blocks with fresh ids and independent stations', () => {
    const src = [rotation(['a', 'b', 'c'])];
    const c = copyBlocks(src);
    expect(c[0].id).not.toBe(src[0].id);
    if (c[0].kind === 'rotation') c[0].stations[0].drillId = 'z';
    expect(src[0].stations[0].drillId).toBe('a');
    expect(blockSchema.safeParse(c[0]).success).toBe(true);
  });
});
