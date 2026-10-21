import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema, type Drill } from '../drills/schema';
import { rateUnits, type Checkin, type Mark } from './checkin';
import type { DrillFeedback } from './feedback';
import type { Block } from './schema';
import { pickSwap, suggestions, type SuggestInput } from './suggest';

const dir = join(__dirname, '../../../content/drills');
const drills: Drill[] = readdirSync(dir).map((f) => drillSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const byId = new Map(drills.map((d) => [d.id, d]));
const team = { groups: [{ group: 'Sharks' as const, skaters: 4 }, { group: 'Bears' as const, skaters: 4 }, { group: 'Eagles' as const, skaters: 4 }] };

const drill = (id: string, drillId: string, minutes = 8, levels = [1]): Block => ({ id, kind: 'drill', drillId, minutes, levels });
const act = (id: string, activity: 'water' | 'huddle' | 'free_skate', minutes = 2): Block => ({ id, kind: 'activity', activity, title: activity, minutes, note: '' });

// Saturday: the practice the coaches checked in on. Thursday's plan starts as a copy of it.
const saturday: Block[] = [act('f', 'free_skate', 4), drill('w', 'warmup-free-skate-challenges', 6), drill('s', 'ski-racer'), drill('n', 'snake-in-the-forest'), act('h2o', 'water'), drill('t', 'toilet-bowl-tag'), act('hd', 'huddle')];
const thursday = saturday.map((b) => ({ ...b, id: `${b.id}2` })) as Block[];
const units = rateUnits({ blocks: saturday, startTime: '09:45', attendance: null }, team, byId);

const mark = (key: string, drillId: string, rating: 'hit' | 'flop', reasons: Mark['reasons'] = []): Mark => ({ key, drillId, rating, reasons });
const checkin = (editor: string, over: Partial<Checkin> = {}): Checkin => ({ practiceId: 'sat', teamId: 't', userId: editor, editor, savedAt: '', overall: 'ok', steam: 'no', steamFrom: null, ready: [], note: '', marks: [], ...over });

const known = new Set(['warmup-free-skate-challenges', 'ski-racer', 'snake-in-the-forest', 'toilet-bowl-tag', 'inside-out']);
const fb = (over: Partial<DrillFeedback>): DrillFeedback => ({ hits: 0, flops: 0, last: null, steam: null, stale: false, warn: false, loved: false, line: '', ...over });

function run(checkins: Checkin[], over: Partial<SuggestInput> = {}) {
  return suggestions({ blocks: thursday, last: { date: '2026-10-17', blocks: saturday }, checkins, units, byId, known, feedback: {}, runs: { 'ski-racer': 2, 'snake-in-the-forest': 1 }, ...over });
}

describe('suggestions from the check-in', () => {
  it('too much waiting: swaps for a same-skill drill where everyone moves, and folds in lost steam', () => {
    const r = run([
      checkin('Brett', { steam: 'bored', steamFrom: 'n', marks: [mark('n', 'snake-in-the-forest', 'flop', ['waiting'])] }),
      checkin('Kara', { marks: [mark('n', 'snake-in-the-forest', 'flop', ['waiting'])] }),
    ]);
    const s = r.list.find((x) => x.blockId === 'n2')!;
    expect(s.kind).toBe('swap');
    expect(s.title).toBe('Flopped: too much waiting.');
    expect(s.detail).toContain('Both of you marked it.');
    expect(s.detail).toContain('got bored from here');
    const d = byId.get(s.drillId!)!;
    expect(d.format).toBe('everyone');
    expect(d.part).toBe('skill');
    expect(s.fits).toContain('Everyone moves');
    // Lost steam is part of the flop suggestion, not a second one on the same drill.
    expect(r.list.filter((x) => x.blockId === 'n2')).toHaveLength(1);
  });

  it('prefers a drill the kids know', () => {
    const s = pickSwap(byId.get('snake-in-the-forest')!, thursday[3], { format: 'everyone' }, { blocks: thursday, byId, known, feedback: {} });
    expect(s?.id).toBe('inside-out');
  });

  it('never proposes a drill that flopped recently', () => {
    const s = pickSwap(byId.get('snake-in-the-forest')!, thursday[3], { format: 'everyone' }, { blocks: thursday, byId, known, feedback: { 'inside-out': fb({ warn: true }) } });
    expect(s?.id).not.toBe('inside-out');
  });

  it('too hard with levels on: turns off the top level', () => {
    const blocks = thursday.map((b) => (b.id === 's2' ? { ...b, levels: [1, 2] } : b)) as Block[];
    const r = run([checkin('Brett', { marks: [mark('s', 'ski-racer', 'flop', ['too_hard'])] })], { blocks });
    expect(r.list[0]).toMatchObject({ kind: 'drop-level', level: 2, blockId: 's2' });
  });

  it('too easy: adds the next level', () => {
    const r = run([checkin('Brett', { marks: [mark('s', 'ski-racer', 'flop', ['too_easy'])] })]);
    expect(r.list[0]).toMatchObject({ kind: 'add-level', level: 2, blockId: 's2' });
  });

  it('a split between coaches gives no suggestion', () => {
    const r = run([checkin('Brett', { marks: [mark('n', 'snake-in-the-forest', 'flop', ['waiting'])] }), checkin('Kara', { marks: [mark('n', 'snake-in-the-forest', 'hit')] })]);
    expect(r.list).toHaveLength(0);
  });

  it('ready for harder: one level on the drill they have done most', () => {
    const r = run([checkin('Brett', { ready: ['Bears'] }), checkin('Kara', { ready: ['Bears'] })]);
    expect(r.list).toHaveLength(1);
    expect(r.list[0]).toMatchObject({ key: 'ready', kind: 'add-level', level: 2, blockId: 's2', title: 'Bears were ready for harder.', by: ['Brett', 'Kara'] });
    expect(r.list[0].detail).toContain('4 min each');
  });

  it('ready for harder stops once the level is in the plan', () => {
    const blocks = thursday.map((b) => (b.id === 's2' ? { ...b, levels: [1, 2] } : b)) as Block[];
    const r = run([checkin('Brett', { ready: ['Bears'] })], { blocks });
    // Ski Racer already has Level 2: the next candidate is Snake in the Forest.
    expect(r.list[0]?.blockId).not.toBe('s2');
  });

  it('got bored at a drill that did not flop: a fun game before it, a Big hit first', () => {
    // Not before Ski Racer: the warm-up before it already has everyone moving.
    expect(run([checkin('Brett', { steam: 'bored', steamFrom: 's' })]).list).toHaveLength(0);
    const r = run([checkin('Brett', { steam: 'bored', steamFrom: 'n' })], { feedback: { 'toilet-bowl-tag': fb({ loved: true }), 'cops-and-robbers': fb({ loved: true }) } });
    const s = r.list[0];
    expect(s).toMatchObject({ kind: 'game-before', blockId: 'n2', drillId: 'cops-and-robbers' });
    expect(s.fits).toContain('A Big hit before');
  });

  it('got tired: a water break before it, unless there is one', () => {
    const r = run([checkin('Kara', { steam: 'tired', steamFrom: 'n' })]);
    expect(r.list[0]).toMatchObject({ kind: 'water-before', blockId: 'n2', detail: 'Kara said so. Put a 2-minute water break before it.' });
    const watered = run([checkin('Kara', { steam: 'tired', steamFrom: 't' })]);
    expect(watered.list).toHaveLength(0);
  });

  it('a flopped drill no longer in the plan: nothing to suggest', () => {
    const blocks = thursday.filter((b) => b.id !== 'n2');
    expect(run([checkin('Brett', { marks: [mark('n', 'snake-in-the-forest', 'flop', ['waiting'])] })], { blocks }).list).toHaveLength(0);
  });

  it('at most three, flops first; Big hits stay', () => {
    const r = run([
      checkin('Brett', {
        steam: 'tired',
        steamFrom: 'w',
        ready: ['Eagles'],
        marks: [mark('n', 'snake-in-the-forest', 'flop', ['waiting']), mark('s', 'ski-racer', 'flop', ['too_easy']), mark('t', 'toilet-bowl-tag', 'hit')],
      }),
    ]);
    expect(r.list).toHaveLength(3);
    expect(r.list.slice(0, 2).every((s) => s.key.startsWith('flop:'))).toBe(true);
    expect(r.stays).toEqual(['Toilet Bowl Tag']);
  });
});
