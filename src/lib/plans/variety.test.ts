import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { drillFeedback } from './feedback';
import { varietyWarnings } from './variety';
import type { Checkin } from './checkin';
import type { Block } from './schema';

const dir = join(__dirname, '../../../content/drills');
const drills: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const byId = new Map(drills.map((d) => [d.id, d]));
const drill = (id: string, drillId: string): Block => ({ id, kind: 'drill', drillId, minutes: 6, levels: [1] });
const act = (id: string, activity: 'water' | 'free_skate'): Block => ({ id, kind: 'activity', activity, title: activity, minutes: 2, note: '' });

describe('variety check', () => {
  it('lets two in a row through and warns on the third', () => {
    const w = varietyWarnings([drill('a', 'hot-potato-partners'), drill('b', 'keep-away-circle'), drill('c', 'snake-in-the-forest')], byId);
    expect([...w.keys()]).toEqual(['c']);
    expect(w.get('c')!.map((x) => x.rule)).toEqual(['skill']);
  });

  it('warns on a third Hard drill, and a water break resets it', () => {
    const three = varietyWarnings([drill('a', 'ski-racer'), drill('b', 'game-garbage-trucks'), drill('c', 'knock-the-tower')], byId);
    expect(three.get('c')!.map((x) => x.rule)).toContain('hard');
    const rested = varietyWarnings([drill('a', 'ski-racer'), drill('b', 'game-garbage-trucks'), act('w', 'water'), drill('c', 'knock-the-tower')], byId);
    expect(rested.size).toBe(0);
  });

  it('a game or an everyone-moves drill breaks the skill streak; water does not', () => {
    expect(varietyWarnings([drill('a', 'hot-potato-partners'), drill('b', 'keep-away-circle'), drill('g', 'game-ice-soccer'), drill('c', 'snake-in-the-forest')], byId).size).toBe(0);
    expect(varietyWarnings([drill('a', 'hot-potato-partners'), drill('b', 'keep-away-circle'), act('w', 'water'), drill('c', 'snake-in-the-forest')], byId).has('c')).toBe(true);
  });

  it('warns on a third drill with the same Main skill', () => {
    const w = varietyWarnings([drill('a', 'airplanes'), drill('b', 'warmup-free-skate-challenges'), drill('c', 'horse-and-buggy')], byId);
    expect(w.get('c')!.map((x) => x.rule)).toEqual(['main']);
    expect(w.get('c')![0].text).toBe('Third Skating drill in a row.');
  });

  it('skips empty blocks', () => {
    expect(varietyWarnings([drill('a', 'hot-potato-partners'), drill('b', 'keep-away-circle'), drill('e', ''), drill('c', 'game-ice-soccer')], byId).size).toBe(0);
  });
});

describe('drill feedback', () => {
  const base: Omit<Checkin, 'practiceId' | 'userId' | 'editor' | 'marks'> = { overall: null, steam: null, steamFrom: null, ready: [], note: '', teamId: 't', savedAt: '' };
  const dates = new Map([['p1', '2026-10-07'], ['p2', '2026-10-14'], ['old', '2026-08-01'], ['now', '2026-10-21']]);
  const hit = (drillId: string) => ({ key: 'k', drillId, rating: 'hit' as const, reasons: [] });
  const flop = (drillId: string) => ({ key: 'k', drillId, rating: 'flop' as const, reasons: ['waiting' as const] });

  it('counts hits, warns on the last flop, and names who said it', () => {
    const f = drillFeedback(
      [
        { ...base, practiceId: 'p1', userId: 'b', editor: 'Brett', marks: [hit('ski-racer'), hit('airplanes')] },
        { ...base, practiceId: 'p2', userId: 'b', editor: 'Brett', marks: [hit('airplanes')] },
        { ...base, practiceId: 'p2', userId: 'k', editor: 'Kara', marks: [flop('ski-racer')] },
      ],
      dates,
      '2026-10-21',
      () => null,
    );
    expect(f.get('airplanes')).toMatchObject({ hits: 2, loved: true, warn: false, line: 'Big hit ×2 · last Oct 14' });
    expect(f.get('ski-racer')).toMatchObject({ warn: true, line: 'Flopped Oct 14 · too much waiting (Kara)' });
  });

  it('marks disagreement as mixed, fades old feedback, ignores later practices', () => {
    const f = drillFeedback(
      [
        { ...base, practiceId: 'p2', userId: 'b', editor: 'Brett', marks: [hit('snake-in-the-forest')] },
        { ...base, practiceId: 'p2', userId: 'k', editor: 'Kara', marks: [flop('snake-in-the-forest')] },
        { ...base, practiceId: 'old', userId: 'b', editor: 'Brett', marks: [flop('knock-the-tower')] },
        { ...base, practiceId: 'now', userId: 'b', editor: 'Brett', marks: [flop('airplanes')] },
      ],
      dates,
      '2026-10-21',
      () => null,
    );
    expect(f.get('snake-in-the-forest')!.last!.verdict).toBe('split');
    expect(f.get('knock-the-tower')).toMatchObject({ stale: true, warn: false });
    expect(f.has('airplanes')).toBe(false);
  });

  it('warns where they lost steam', () => {
    const f = drillFeedback([{ ...base, practiceId: 'p2', userId: 'b', editor: 'Brett', steam: 'bored', steamFrom: 'x', marks: [] }], dates, '2026-10-21', () => 'hot-potato-partners');
    expect(f.get('hot-potato-partners')).toMatchObject({ warn: true, line: 'Got bored from here Oct 14' });
  });
});
