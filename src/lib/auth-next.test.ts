import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { safeNext } from './auth-after';

describe('safeNext', () => {
  it('keeps same-site paths', () => expect(safeNext('/join/abc12345')).toBe('/join/abc12345'));
  it('refuses other sites and falls back to plans', () => {
    expect(safeNext('//evil.com')).toBe('/plans');
    expect(safeNext('https://evil.com')).toBe('/plans');
    expect(safeNext(null)).toBe('/plans');
  });
});
