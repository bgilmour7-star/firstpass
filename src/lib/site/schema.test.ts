import { describe, expect, it } from 'vitest';
import { cleanSource, deviceOf, isBot, regionOf, waitlistInput } from './schema';

describe('waitlistInput', () => {
  it('keeps a coach’s age group and drops association-only fields', () => {
    const r = waitlistInput.parse({ kind: 'coach', email: ' Kara@Example.com ', ageGroup: 'U7', orgName: 'U7 Red', teamCount: '12', source: 'Shared-Ice' });
    expect(r).toEqual({ kind: 'coach', email: 'kara@example.com', ageGroup: 'U7', orgName: 'U7 Red', teamCount: null, source: 'shared-ice' });
  });

  it('needs an association’s name and team count, and drops the age group', () => {
    expect(waitlistInput.safeParse({ kind: 'association', email: 'reg@assoc.org' }).success).toBe(false);
    const r = waitlistInput.parse({ kind: 'association', email: 'reg@assoc.org', orgName: 'Mid-Island', teamCount: '14', ageGroup: 'U7' });
    expect(r).toMatchObject({ ageGroup: null, orgName: 'Mid-Island', teamCount: 14 });
  });

  it('rejects an email without a domain, in plain words', () => {
    const r = waitlistInput.safeParse({ kind: 'coach', email: 'kara@example' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/doesn’t look right/);
  });
});

describe('visit helpers', () => {
  it('ignores our own site as a source', () => {
    expect(cleanSource('www.Google.com')).toBe('google.com');
    expect(cleanSource('firstpass.coach')).toBeNull();
    expect(cleanSource('')).toBeNull();
  });

  it('spots bots and devices', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('Mozilla/5.0 HeadlessChrome/120')).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1')).toBe(false);
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148')).toBe('phone');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile')).toBe('phone');
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('desktop');
  });

  it('names the place at city level, with the country only outside Canada', () => {
    expect(regionOf({ city: 'Nanaimo', region: 'BC', country: 'CA' })).toBe('Nanaimo, BC');
    expect(regionOf({ city: 'S%C3%A3o%20Paulo', region: 'SP', country: 'BR' })).toBe('São Paulo, SP, BR');
    expect(regionOf({})).toBeNull();
  });
});
