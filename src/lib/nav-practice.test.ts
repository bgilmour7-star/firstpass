import { describe, expect, it } from 'vitest';
import { navPractice } from './nav-practice';

const now = new Date('2026-10-19T23:00:00Z'); // Mon Oct 19, 4pm in Nanaimo
describe('navPractice', () => {
  it('names the next practice and its day when none is today', () => {
    const n = navPractice([{ date: '2026-10-31', startTime: '09:45' }, { date: '2026-10-24', startTime: '09:45' }, { date: '2026-10-10', startTime: '09:45' }], now);
    expect(n.label).toBe('Next practice');
    expect(n.sub).toMatch(/Oct 24/);
    expect(n.day).toBe(24);
  });
  it('says Today with the start time on practice day', () => {
    expect(navPractice([{ date: '2026-10-19', startTime: '17:30' }], now)).toEqual({ label: 'Today', sub: '5:30', day: 19 });
  });
  it('says nothing is planned', () => {
    expect(navPractice([], now)).toEqual({ label: 'Next practice', sub: 'Nothing planned', day: 19 });
  });
});
