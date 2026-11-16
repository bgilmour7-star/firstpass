import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { googleProfilePatch, safeNext } from './auth-after';

describe('safeNext', () => {
  it('keeps same-site paths', () => expect(safeNext('/join/abc12345')).toBe('/join/abc12345'));
  it('refuses other sites and falls back to home (Team or Today, decision 0026)', () => {
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
  it('refuses the forms browsers also read as another site (/\\evil.com, tabs and newlines)', () => {
    for (const bad of ['/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com', '/%09/evil.com'.replace('%09', '\t')]) expect(safeNext(bad)).toBe('/');
  });
  it('keeps the query and hash of a same-site path', () => expect(safeNext('/plans/abc?x=1#y')).toBe('/plans/abc?x=1#y'));
});

describe('googleProfilePatch (decision 0033)', () => {
  it('takes Google’s first name when the account has none, and answers the password offer', () => {
    expect(googleProfilePatch({ given_name: 'Kara', full_name: 'Kara Lee' })).toEqual({ first_name: 'Kara', pw_prompted: true });
    expect(googleProfilePatch({ full_name: '  Kara  Lee ' })).toEqual({ first_name: 'Kara', pw_prompted: true });
  });
  it('keeps a name the coach already gave, and saves nothing when there is nothing new', () => {
    expect(googleProfilePatch({ first_name: 'Brett', given_name: 'Bretton', pw_prompted: true })).toEqual({});
    expect(googleProfilePatch({ pw_prompted: true })).toEqual({});
  });
});
