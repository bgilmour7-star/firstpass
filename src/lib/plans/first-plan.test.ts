import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { firstPlan } from './first-plan';
import { totalMinutes } from './schema';
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

  it('falls back to the plain template with no library', () => {
    const blocks = firstPlan(60, []);
    expect(totalMinutes(blocks)).toBe(60);
    expect(blocks.some((b) => b.kind === 'rotation' && !b.drillId)).toBe(true);
  });
});
