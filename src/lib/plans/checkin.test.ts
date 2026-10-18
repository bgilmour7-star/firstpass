import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { cleanMarks, practiceOver, rateUnits, summarize, type Checkin } from './checkin';
import type { Block, Team } from './schema';

const dir = join(__dirname, '../../../content/drills');
const drills: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const byId = new Map(drills.map((d) => [d.id, d]));
const team: Pick<Team, 'groups'> = { groups: [{ group: 'Eagles', skaters: 4 }, { group: 'Bears', skaters: 4 }, { group: 'Sharks', skaters: 4 }] };
const blocks: Block[] = [
  { id: 'a', kind: 'drill', drillId: 'airplanes', minutes: 6, levels: [1] },
  { id: 'w', kind: 'activity', activity: 'water', title: 'Water', minutes: 2, note: '' },
  { id: 'r', kind: 'rotation', drillId: 'rotation-backwards-day', minutes: 6, stations: [{ station: 'A', drillId: null, coach: '' }, { station: 'B', drillId: null, coach: '' }, { station: 'C', drillId: null, coach: '' }], drop: [] },
  { id: 'g', kind: 'drill', drillId: 'game-garbage-trucks', minutes: 8, levels: [1] },
];
const p = { blocks, startTime: '18:00', attendance: null };
const base: Omit<Checkin, 'userId' | 'editor' | 'marks'> = { overall: null, steam: null, steamFrom: null, ready: [], note: '', practiceId: 'p', teamId: 't', savedAt: '' };

describe('check-in', () => {
  it('rates drills and each rotation zone, never water', () => {
    const u = rateUnits(p, team, byId);
    expect(u.map((x) => x.key)).toEqual(['a', 'r:A', 'r:B', 'r:C', 'g']);
    expect(u.map((x) => x.time)).toEqual(['6:00', '6:08', '6:14', '6:20', '6:26']);
    expect(u[1].name).toBe('Walk backwards');
  });

  it('drops marks that do not match the plan, and reasons on a Big hit', () => {
    const u = rateUnits(p, team, byId);
    const m = cleanMarks([{ key: 'g', drillId: 'x', rating: 'hit', reasons: ['waiting'] }, { key: 'nope', drillId: 'x', rating: 'flop', reasons: [] }], u);
    expect(m).toEqual([{ key: 'g', drillId: 'game-garbage-trucks', rating: 'hit', reasons: [] }]);
  });

  it('merges coaches without averaging, and finds the earliest lost steam', () => {
    const u = rateUnits(p, team, byId);
    const me: Checkin = { ...base, userId: 'me', editor: 'Brett', steam: 'bored', steamFrom: 'r:B', ready: ['Eagles'], marks: [{ key: 'g', drillId: 'game-garbage-trucks', rating: 'hit', reasons: [] }, { key: 'a', drillId: 'airplanes', rating: 'flop', reasons: ['waiting'] }] };
    const kara: Checkin = { ...base, userId: 'k', editor: 'Kara', steam: 'tired', steamFrom: 'r:A', marks: [{ key: 'a', drillId: 'airplanes', rating: 'hit', reasons: [] }] };
    const earlier: Checkin[] = [{ ...base, practiceId: 'old', userId: 'me', editor: 'Brett', marks: [{ key: 'z', drillId: 'game-garbage-trucks', rating: 'hit', reasons: [] }] }];
    const s = summarize([me, kara], u, earlier);
    expect(s.split.map((x) => x.key)).toEqual(['a']);
    expect(s.hits.map((x) => x.key)).toEqual(['g']);
    expect(s.again.map((x) => x.key)).toEqual(['g']);
    expect(s.lostSteam).toEqual({ unit: u[1], how: 'tired' });
    expect(s.ready).toEqual(['Eagles']);
  });

  it('knows when the ice time is over', () => {
    const now = new Date('2026-10-22T02:30:00Z'); // 7:30 pm in Vancouver on Oct 21
    expect(practiceOver({ date: '2026-10-21', startTime: '18:00', minutes: 60 }, now)).toBe(true);
    expect(practiceOver({ date: '2026-10-21', startTime: '19:00', minutes: 60 }, now)).toBe(false);
    expect(practiceOver({ date: '2026-10-20', startTime: '18:00', minutes: 60 }, now)).toBe(true);
  });
});
