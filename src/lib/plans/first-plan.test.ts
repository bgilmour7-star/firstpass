import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { firstPlan } from './first-plan';
import { totalMinutes, type Block } from './schema';
import { varietyWarnings } from './variety';

const dir = join(__dirname, '../../../content/drills');
const library: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));

describe('the first plan', () => {
  it('is a real practice: a rotation and a game picked, nothing left to choose', () => {
    const blocks = firstPlan(60, library);
    expect(totalMinutes(blocks)).toBe(60);
    expect(blocks.some((b) => b.kind === 'rotation' && b.drillId)).toBe(true);
    expect(blocks.filter((b) => b.kind !== 'activity').every((b) => b.drillId)).toBe(true);
    expect(blocks[0]).toMatchObject({ kind: 'activity', activity: 'free_skate' });
    expect(blocks.at(-1)).toMatchObject({ kind: 'activity', activity: 'huddle' });
    const game = blocks.find((b) => b.kind === 'drill' && library.find((d) => d.id === b.drillId)?.part === 'game');
    expect(game).toBeDefined();
  });

  it('passes its own variety check', () => {
    const byId = new Map(library.map((d) => [d.id, d]));
    for (const m of [40, 50, 60, 75]) expect(varietyWarnings(firstPlan(m, library), byId).size).toBe(0);
  });

  it('fits shorter and longer ice exactly', () => {
    for (const m of [30, 40, 45, 50, 75, 90]) expect(totalMinutes(firstPlan(m, library))).toBe(m);
  });

  it('drops the optional drills first when the ice is short', () => {
    const short = firstPlan(35, library);
    expect(short.some((b) => b.kind === 'rotation' && b.drillId)).toBe(true);
    expect(short.filter((b) => b.kind === 'drill').length).toBeLessThan(firstPlan(60, library).filter((b) => b.kind === 'drill').length);
  });

  it('starts each drill at its start level for the team age', () => {
    const lib = library.map((d) => (d.groupModel === 'basic' && d.levels.length ? { ...d, startLevel: { U9: d.levels.length + 1 } } : d));
    const u9 = firstPlan(60, lib, 3, 'U9').filter((b) => b.kind === 'drill');
    const u7 = firstPlan(60, lib, 3, 'U7').filter((b) => b.kind === 'drill');
    for (const b of u7) expect(b.kind === 'drill' && b.levels).toEqual([1]);
    for (const b of u9) {
      const d = lib.find((x) => x.id === (b.kind === 'drill' ? b.drillId : ''))!;
      expect(b.kind === 'drill' && b.levels).toEqual([d.levels.length + 1]);
    }
  });

  it('falls back to the plain template with no library', () => {
    const blocks = firstPlan(60, []);
    expect(totalMinutes(blocks)).toBe(60);
    expect(blocks.some((b) => b.kind === 'rotation' && !b.drillId)).toBe(true);
  });

  describe('leaning toward the team focus (decision 0039)', () => {
    const byId = new Map(library.map((d) => [d.id, d]));
    const drillOf = (b: Block) => (b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined);
    const works = (b: Block, a: string) => !!drillOf(b)?.focus.some((f) => f.attribute === a && f.level === 2);
    const attrs = ['Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun'];

    it('is the same plan as before with no focus', () => {
      const strip = (bs: Block[]) => bs.map((b) => ({ ...b, id: '' }));
      expect(strip(firstPlan(60, library, 3, 'U7', []))).toEqual(strip(firstPlan(60, library, 3, 'U7')));
    });

    it('picks drills that work each focus when the library has one', () => {
      for (const a of attrs) {
        const blocks = firstPlan(60, library, 3, 'U7', [a]);
        const libHas = library.some((d) => d.focus.some((f) => f.attribute === a && f.level === 2) && (d.groupModel === 'rotation' || (d.groupModel === 'basic' && d.minutes <= 10 && ((d.part === 'game' && d.format === 'everyone') || (d.part === 'skill' && d.format !== 'line' && d.effort !== 'hard')))));
        if (libHas) expect(blocks.filter((b) => works(b, a)).length, a).toBeGreaterThan(0);
      }
    });

    it('still fits the ice and passes its variety check with any focus', () => {
      const pairs = attrs.flatMap((a, i) => attrs.slice(i + 1).map((b) => [a, b]));
      for (const f of [...attrs.map((a) => [a]), ...pairs])
        for (const m of [40, 60, 75]) {
          const blocks = firstPlan(m, library, 3, 'U7', f);
          expect(totalMinutes(blocks), `${f} ${m}`).toBe(m);
          expect(varietyWarnings(blocks, byId).size, `${f} ${m}`).toBe(0);
          expect(blocks.some((b) => b.kind === 'rotation' && b.drillId), `${f} ${m}`).toBe(true);
        }
    });

    it('keeps the warm-up, water and huddle, and never fills the plan with one skill', () => {
      const blocks = firstPlan(60, library, 3, 'U7', ['Skating']);
      expect(blocks[0]).toMatchObject({ activity: 'free_skate' });
      expect(blocks.at(-1)).toMatchObject({ activity: 'huddle' });
      expect(blocks.some((b) => b.kind === 'activity' && b.activity === 'water')).toBe(true);
      const game = blocks.find((b) => drillOf(b)?.part === 'game');
      expect(game).toBeDefined();
    });
  });

  it('never picks a one-at-a-time skill drill', () => {
    const byId = new Map(library.map((d) => [d.id, d]));
    for (const f of [[], ['Passing'], ['Skating'], ['Puck control']])
      for (const b of firstPlan(60, library, 3, 'U7', f)) {
        const d = b.kind === 'drill' ? byId.get(b.drillId) : undefined;
        if (d?.part === 'skill') expect(d.format, d.id).not.toBe('line');
      }
  });
});

describe('coaches on the ice (decision 0046)', () => {
  it('one coach: no rotation, a second game instead, and the minutes still add up', () => {
    for (const m of [45, 60, 75]) {
      const blocks = firstPlan(m, library, 1, 'U7', [], 1);
      expect(blocks.some((b) => b.kind === 'rotation')).toBe(false);
      expect(totalMinutes(blocks, 1)).toBe(m);
    }
  });
  it('two coaches: the rotation runs 2 stations and the minutes still add up', () => {
    const blocks = firstPlan(60, library, 2, 'U7', [], 2);
    expect(blocks.some((b) => b.kind === 'rotation')).toBe(true);
    expect(totalMinutes(blocks, 2)).toBe(60);
  });
});
