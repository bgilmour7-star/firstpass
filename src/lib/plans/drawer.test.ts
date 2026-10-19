import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { EMPTY, blockMinutes, countWith, filterDrills, nameMatches, partForSlot, widenOptions, type DrawerContext } from './drawer';

const dir = join(__dirname, '../../../content/drills');
const all: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const basic = all.filter((d) => d.groupModel === 'basic');
const ctx: DrawerContext = { fitsMinutes: 8, known: new Set(['game-garbage-trucks', 'airplanes']), recent: new Set(['airplanes']) };

describe('add-a-drill drawer filters', () => {
  it('suggests a part from the slot', () => {
    expect(partForSlot(0, 6)).toBe('warmup');
    expect(partForSlot(3, 6)).toBe('skill');
    expect(partForSlot(5, 6)).toBe('game');
    expect(partForSlot(6, 6)).toBe('game');
  });

  it('opens on a fun game that fits 8 minutes', () => {
    const list = filterDrills(basic, { ...EMPTY, part: 'game', fits: true }, ctx);
    expect(list.map((d) => d.id)).toContain('game-garbage-trucks');
    expect(list.every((d) => d.part === 'game' && d.minutes <= 8)).toBe(true);
  });

  it('says which filter is hiding the rest', () => {
    const w = widenOptions(basic, { ...EMPTY, part: 'game', fits: true }, ctx);
    const longer = basic.filter((d) => d.part === 'game' && d.minutes > 8).length;
    expect(longer).toBeGreaterThan(0);
    expect(w[0]).toEqual({ key: 'fits', more: longer });
  });

  it('team favourites show only the starred drills, and can be widened back out', () => {
    const fav = { ...ctx, favorites: new Set(['airplanes', 'game-garbage-trucks']) };
    expect(filterDrills(basic, { ...EMPTY, fav: true }, fav).map((d) => d.id).sort()).toEqual(['airplanes', 'game-garbage-trucks']);
    expect(widenOptions(basic, { ...EMPTY, fav: true }, fav)).toEqual([{ key: 'fav', more: basic.length - 2 }]);
    expect(filterDrills(basic, { ...EMPTY, fav: true }, ctx)).toEqual([]);
  });

  it('known and new split the library', () => {
    const k = countWith(basic, EMPTY, ctx, { known: true });
    const n = countWith(basic, EMPTY, ctx, { isNew: true });
    expect(k + n).toBe(basic.length);
  });

  it('not used lately leaves out the last two practices', () => {
    expect(filterDrills(basic, { ...EMPTY, fresh: true }, ctx).some((d) => d.id === 'airplanes')).toBe(false);
  });

  it('a rotation fits by its total time', () => {
    const r = all.find((d) => d.groupModel === 'rotation')!;
    expect(blockMinutes(r)).toBe(r.minutes * r.zones!.length);
  });
});

describe('nameMatches', () => {
  const d = { funName: 'Sunday Scrimmage', plainName: 'Two cross-ice games, one in each end' };
  it('matches either name, ignoring case and spaces around the text', () => {
    expect(nameMatches(d, '  sunday ')).toBe(true);
    expect(nameMatches(d, 'CROSS-ICE')).toBe(true);
    expect(nameMatches(d, 'tag')).toBe(false);
  });
  it('matches everything when the search is empty', () => {
    expect(nameMatches(d, '   ')).toBe(true);
  });
});
