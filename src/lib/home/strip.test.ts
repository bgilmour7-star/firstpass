import { describe, expect, it } from 'vitest';
import { practiceStrip, stripShown } from './strip';
import type { Block } from '../plans/schema';

const drill = (id: string, main: string[]) => ({ id, funName: id, diagram: {}, focus: main.map((attribute) => ({ attribute, level: 2 as const, why: '' })) });
const byId = new Map([
  ['scatter-puck', drill('scatter-puck', ['Shooting'])],
  ['ski-racer', drill('ski-racer', ['Skating'])],
  ['first-shots', drill('first-shots', ['Shooting', 'Puck control'])],
] as [string, ReturnType<typeof drill>][]) as unknown as Parameters<typeof practiceStrip>[1];
const d = (id: string, drillId: string, minutes: number): Block => ({ id, kind: 'drill', drillId, minutes, levels: [] }) as unknown as Block;
const water: Block = { id: 'w', kind: 'activity', activity: 'water', title: 'Water', note: '', minutes: 3 } as unknown as Block;

describe('the next practice as its drills (decision 0031)', () => {
  const plan = { startTime: '07:00', blocks: [d('a', 'ski-racer', 8), water, d('b', 'scatter-puck', 6), d('c', 'gone', 5)] };
  it('keeps drills only, in order, with start times that count the water break', () => {
    const s = practiceStrip(plan, byId, 3, new Set(['ski-racer', 'scatter-puck']));
    expect(s.map((x) => [x.name, x.time, x.minutes])).toEqual([
      ['ski-racer', '07:00', 8],
      ['scatter-puck', '07:11', 6],
    ]);
  });
  it('marks a drill the kids haven’t done', () => {
    const s = practiceStrip(plan, byId, 3, new Set(['ski-racer']));
    expect(s.map((x) => [x.name, x.isNew])).toEqual([
      ['ski-racer', false],
      ['scatter-puck', true],
    ]);
  });
  it('keeps an older rotation built from single drills as one item, so later times stay right', () => {
    const old = { id: 'r', kind: 'rotation', drillId: null, minutes: 5, stations: [{ station: 'A', drillId: 'ski-racer' }, { station: 'B', drillId: 'scatter-puck' }, { station: 'C', drillId: null }], drop: [] } as unknown as Block;
    const s = practiceStrip({ startTime: '07:00', blocks: [old, d('b', 'first-shots', 6)] }, byId, 3, new Set(['ski-racer']));
    expect(s.map((x) => [x.name, x.time, x.isNew])).toEqual([
      ['Rotation', '07:00', true],
      ['first-shots', s[1].time, true],
    ]);
    expect(s[1].time).not.toBe('07:00');
  });
  it('shows up to 6, and 5 plus "+N more" from 7', () => {
    expect(stripShown([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3, 4, 5, 6], more: 0 });
    expect(stripShown([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4, 5], more: 2 });
  });
});
