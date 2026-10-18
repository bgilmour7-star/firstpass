import { describe, expect, it } from 'vitest';
import { activityLine, describeChange, editorLabel, initials, type Snapshot } from './activity';
import type { Block } from './schema';

const d = (id: string, drillId: string, minutes = 8): Block => ({ id, kind: 'drill', drillId, minutes, levels: [1] });
const base: Snapshot = { blocks: [d('a', 'airplanes'), d('b', 'ski-racer')], status: 'draft', attendance: null, minutes: 60, startTime: '18:00', date: '2026-10-23' };
const names = (id: string) => ({ airplanes: 'Airplanes', 'ski-racer': 'Ski Racer', 'keep-away': 'Keep Away', 'hot-potato': 'Hot Potato Partners' })[id];

describe('practice activity', () => {
  it('names one added drill, counts several', () => {
    expect(describeChange(base, { ...base, blocks: [...base.blocks, d('c', 'keep-away')] }, names)).toBe('added Keep Away');
    expect(describeChange(base, { ...base, blocks: [...base.blocks, d('c', 'keep-away'), d('e', 'hot-potato')] }, names)).toBe('added 2 drills');
  });
  it('says swapped, removed, Ready, times and order', () => {
    expect(describeChange(base, { ...base, blocks: [d('a', 'airplanes'), d('b', 'keep-away')] }, names)).toBe('swapped in Keep Away');
    expect(describeChange(base, { ...base, blocks: [d('a', 'airplanes')] }, names)).toBe('removed a drill');
    expect(describeChange(base, { ...base, status: 'ready' }, names)).toBe('marked it Ready');
    expect(describeChange(base, { ...base, blocks: [d('a', 'airplanes', 10), d('b', 'ski-racer')] }, names)).toBe('changed the times');
    expect(describeChange(base, { ...base, blocks: [d('b', 'ski-racer'), d('a', 'airplanes')] }, names)).toBe('reordered the plan');
  });
  it('labels coaches from their email', () => {
    expect(editorLabel('kara@example.com')).toBe('Kara');
    expect(initials('Kara')).toBe('K');
  });
  it('flags another coach’s change you haven’t seen, never your own', () => {
    const now = Date.parse('2026-10-18T05:00:00Z');
    const kara = { userId: 'k', editor: 'Kara', summary: 'added 2 drills', at: '2026-10-18T04:00:00Z' };
    const me = { userId: 'me', editor: 'Brett', summary: 'started the plan', at: '2026-10-17T20:00:00Z' };
    const a = activityLine({ edits: [kara, me], viewedAt: '2026-10-17T21:00:00Z' }, 'me', now)!;
    expect(a.text).toBe('Kara added 2 drills · 1h ago');
    expect(a.unseen).toBe(true);
    expect(a.editors.map((e) => e.label)).toEqual(['Kara', 'Brett']);
    expect(activityLine({ edits: [kara, me], viewedAt: '2026-10-18T04:30:00Z' }, 'me', now)!.unseen).toBe(false);
    expect(activityLine({ edits: [me], viewedAt: null }, 'me', now)!.text).toBe('You started the plan · 9h ago');
  });
});
