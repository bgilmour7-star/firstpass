import { describe, expect, it } from 'vitest';
import { sameDrill } from './same';

describe('sameDrill', () => {
  it('ignores key order at any depth (jsonb reorders keys)', () => {
    expect(sameDrill({ a: 1, b: { y: [1, { q: 1, p: 2 }], x: 2 } }, { b: { x: 2, y: [1, { p: 2, q: 1 }] }, a: 1 })).toBe(true);
  });
  it('treats a missing key and an undefined one as the same', () => {
    expect(sameDrill({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
  it('still sees real changes, including array order', () => {
    expect(sameDrill({ steps: ['a', 'b'] }, { steps: ['b', 'a'] })).toBe(false);
    expect(sameDrill({ minutes: 8 }, { minutes: 9 })).toBe(false);
  });
});
