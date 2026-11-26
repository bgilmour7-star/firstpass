import { describe, expect, it } from 'vitest';
import { parseFeedback, requestInput, stateLine, waitingForRedraw } from './schema';

describe('drill requests', () => {
  it('accepts a new-drill request with a link', () => {
    const r = requestInput.safeParse({ kind: 'new', answers: { part: 'game', shape: 'basic', focus: ['Skating'], minutes: 8 }, description: 'Kids skate through a tunnel of coaches legs', link: 'https://example.com/drill' });
    expect(r.success).toBe(true);
  });
  it('rejects a link that is not a web address', () => {
    const r = requestInput.safeParse({ kind: 'new', answers: { focus: [] }, description: 'Kids skate through a tunnel', link: 'javascript:alert(1)' });
    expect(r.success).toBe(false);
  });
  it('limits focus to two skills', () => {
    const r = requestInput.safeParse({ kind: 'new', answers: { focus: ['Skating', 'Passing', 'Shooting'] }, description: 'Kids skate through a tunnel', link: null });
    expect(r.success).toBe(false);
  });
  it('says where a request is in plain words', () => {
    expect(stateLine({ state: 'declined', kind: 'new', reason: 'Too much waiting' })).toBe('Not this time: Too much waiting');
    expect(stateLine({ state: 'accepted', kind: 'change', reason: null })).toBe('Changed');
  });
  it('keeps well-formed feedback notes and drops broken ones', () => {
    expect(parseFeedback([{ text: 'Move the nets out', at: '2026-11-25T18:00:00Z' }, { text: 3 }, null])).toEqual([{ text: 'Move the nets out', at: '2026-11-25T18:00:00Z' }]);
    expect(parseFeedback('nope')).toEqual([]);
  });
  it('knows a change sent back to Claude is waiting for a redraw', () => {
    const note = [{ text: 'Move the nets out', at: '2026-11-25T18:00:00Z' }];
    expect(waitingForRedraw({ state: 'sent', feedback: note })).toBe(true);
    expect(waitingForRedraw({ state: 'sent', feedback: [] })).toBe(false);
    expect(waitingForRedraw({ state: 'drafted', feedback: note })).toBe(false);
  });
});
