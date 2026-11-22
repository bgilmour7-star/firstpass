import { describe, expect, it, vi } from 'vitest';
vi.mock('next/server', () => ({ after: () => {} }));
import { areaOf, scrub } from './errors';

describe('areaOf', () => {
  it('reads the [tag] at the start', () => {
    expect(areaOf('[email] welcome failed: 500')).toBe('email');
    expect(areaOf('[team/new] calendar: bad url')).toBe('team/new');
    expect(areaOf('something broke')).toBe('app');
  });
});

describe('scrub (decision 0054)', () => {
  it('takes out emails, ids, phone numbers and tokens', () => {
    expect(scrub('send to kara.smith+u7@example.com failed')).toBe('send to <email> failed');
    expect(scrub('user 3f2b8c1e-1234-4abc-9def-0123456789ab not found')).toBe('user <id> not found');
    expect(scrub('call 250-555-0148 or (250) 555 0148')).toBe('call <phone> or <phone>');
    expect(scrub('token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 rejected')).toBe('token <token> rejected');
  });
  it('keeps one short line', () => {
    expect(scrub('a\n  b\tc')).toBe('a b c');
    expect(scrub('x'.repeat(10) + ' ' + 'y '.repeat(300)).length).toBeLessThanOrEqual(400);
  });
});
