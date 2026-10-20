import { describe, expect, it } from 'vitest';
import { requestInput, stateLine } from './schema';

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
});
