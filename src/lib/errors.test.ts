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

describe('describe (decision 0054)', () => {
  it('keeps only the code and message of an error-like object, never its details', async () => {
    const { describe: d } = await import('./errors');
    const pgError = { code: '23514', message: 'new row violates check constraint', details: "Failing row contains (12, Sam, Jordan's mom said he cried)", hint: null };
    const out = d(['[plans] edit log:', pgError]);
    expect(out).toBe('[plans] edit log: 23514 new row violates check constraint');
    expect(out).not.toContain('Sam');
    expect(d(['[x] %s failed', new Error('boom')])).toBe('[x] boom failed');
    expect(d(['[x]', { some: 'thing' }])).toBe('[x] [object]');
  });
});

describe('scrub, more', () => {
  it('catches encoded and dotless emails, and join codes', () => {
    expect(scrub('next=%2Fjoin&email=kara.smith%40example.com')).not.toContain('kara');
    expect(scrub('bad user kara@gmail')).toBe('bad user <email>');
    expect(scrub('code Ab3dE6gH9 expired')).toBe('code <token> expired');
    expect(scrub('exchangeCodeForSession failed')).toBe('exchangeCodeForSession failed');
    expect(scrub('PGRST202 could not find the function')).toBe('PGRST202 could not find the function');
  });
});
