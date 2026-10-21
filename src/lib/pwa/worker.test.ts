import { describe, expect, it } from 'vitest';
import { NEVER, workerSource } from './worker';

describe('service worker', () => {
  it('is valid JavaScript and carries its version', () => {
    const src = workerSource('abc123');
    expect(() => new Function(src)).not.toThrow();
    expect(src).toContain('"abc123"');
  });

  it('never saves sign-in, admin, the API, parent or join links', () => {
    for (const p of ['/login', '/auth/', '/admin', '/api/', '/p/', '/join/']) expect(NEVER).toContain(p);
  });

  it('decides what to leave to the network', () => {
    // Run the worker's own never() against a stand-in `self`.
    const src = workerSource('t');
    const fakeSelf = { addEventListener() {}, location: { origin: 'https://firstpass.coach' }, clients: {}, skipWaiting() {} };
    const never = new Function('self', 'caches', `${src}; return never;`)(fakeSelf, {}) as (p: string) => boolean;
    expect(never('/')).toBe(true);
    expect(never('/login')).toBe(true);
    expect(never('/admin/analytics')).toBe(true);
    expect(never('/p/abc')).toBe(true);
    expect(never('/today')).toBe(false);
    expect(never('/plans')).toBe(false);
    expect(never('/adminx')).toBe(false);
  });
});
