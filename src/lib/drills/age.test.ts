import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, levelCount, startLevelFor, type Drill } from './schema';
import { drillsForAge, U9_FALLBACK_BELOW, U9_FALLBACK_NOTICE } from './age';

const dir = join(__dirname, '../../../content/drills');
const library: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const base = library.find((d) => d.id === 'ski-racer')!;
const plain = library.find((d) => d.groupModel === 'basic' && d.levels.length === 0)!;
const as = (d: Drill, id: string, over: Partial<Drill>): Drill => ({ ...d, id, ...over });

describe('drillsForAge', () => {
  it('a U7 team sees only drills ticked for U7', () => {
    const u5 = as(plain, 'u5-only', { ageGroups: ['U5'] });
    const r = drillsForAge([...library, u5], 'U7');
    expect(r.drills.map((d) => d.id)).not.toContain('u5-only');
    expect(r.drills).toHaveLength(library.length);
    expect(r.notice).toBeNull();
  });

  it('a U5 team sees only U5 drills and no fallback', () => {
    const u5 = as(plain, 'u5-too', { ageGroups: ['U5', 'U7'] });
    expect(drillsForAge([...library, u5], 'U5')).toEqual({ drills: [u5], notice: null });
  });

  it('an unknown age sees nothing', () => {
    expect(drillsForAge(library, 'U11').drills).toEqual([]);
  });

  it('a U9 team with few U9 drills also sees U7 drills with levels, at their top level, with the notice', () => {
    const own = as(plain, 'u9-own', { ageGroups: ['U9'] });
    const r = drillsForAge([...library, own], 'U9');
    const ids = r.drills.map((d) => d.id);
    expect(ids).toContain('u9-own');
    expect(ids).toContain('ski-racer');
    expect(ids).not.toContain(plain.id);
    expect(r.notice).toBe(U9_FALLBACK_NOTICE);
    const borrowed = r.drills.find((d) => d.id === 'ski-racer')!;
    expect(startLevelFor(borrowed, 'U9')).toBe(levelCount(base));
    expect(startLevelFor(r.drills.find((d) => d.id === 'u9-own')!, 'U9')).toBe(1);
    // Borrowing never changes the drill itself.
    expect(base.startLevel).toBeUndefined();
  });

  it('turns the fallback off once there are enough U9 drills', () => {
    const own = Array.from({ length: U9_FALLBACK_BELOW }, (_, i) => as(plain, `u9-${i}`, { ageGroups: ['U9'] }));
    const r = drillsForAge([...library, ...own], 'U9');
    expect(r.drills).toHaveLength(U9_FALLBACK_BELOW);
    expect(r.notice).toBeNull();
  });

  it('a U9 drill keeps its own start level', () => {
    const both = as(base, 'both', { ageGroups: ['U7', 'U9'], startLevel: { U9: 2 } });
    const r = drillsForAge([both], 'U9');
    expect(r.drills).toEqual([both]);
    expect(startLevelFor(r.drills[0], 'U9')).toBe(2);
    expect(startLevelFor(r.drills[0], 'U7')).toBe(1);
  });
});
