import { describe, expect, it } from 'vitest';
import { nextUp } from './next-up';

// Monday Nov 16, 2026, 10:00 in Vancouver. Sunday's practice is over; Thursday has ice.
const now = new Date('2026-11-16T18:00:00Z');
const sunday = { id: 'p-sun', date: '2026-11-15', startTime: '07:00', minutes: 50 };
const nextSun = { id: 'p-next', date: '2026-11-22', startTime: '07:00', minutes: 50 };
const thursdayIce = { id: 'ice-thu', date: '2026-11-19', startTime: '18:15', minutes: 50, kind: 'practice', cancelled: false, ignored: false, practiceId: null };
const round = { id: 'r-dec', month: '2026-12-01', open: true, scoring: true, finished: false };
const base = { userId: 'brett', now, practices: [sunday, nextSun], checkins: [], round, ice: [thursdayIce] };

describe('Next up on Home (decision 0031)', () => {
  it('asks for the check-in first', () => {
    expect(nextUp(base)).toEqual({ kind: 'checkin', practiceId: 'p-sun', date: '2026-11-15' });
  });
  it('then an open round this coach hasn’t finished', () => {
    expect(nextUp({ ...base, checkins: [{ practiceId: 'p-sun', userId: 'brett' }] })).toEqual({ kind: 'score', roundId: 'r-dec', month: '2026-12-01' });
  });
  it('then ice in the coming week with no plan', () => {
    const done = { ...base, checkins: [{ practiceId: 'p-sun', userId: 'brett' }], round: { ...round, finished: true } };
    expect(nextUp(done)).toEqual({ kind: 'plan', iceId: 'ice-thu', date: '2026-11-19', startTime: '18:15', minutes: 50 });
  });
  it('is empty when nothing is waiting', () => {
    expect(nextUp({ ...base, checkins: [{ practiceId: 'p-sun', userId: 'brett' }], round: null, ice: [{ ...thursdayIce, practiceId: 'p-thu' }] })).toBeNull();
  });
  it('ignores a teammate’s check-in, practices over two weeks old and ones not over yet', () => {
    expect(nextUp({ ...base, checkins: [{ practiceId: 'p-sun', userId: 'kara' }] })?.kind).toBe('checkin');
    expect(nextUp({ ...base, practices: [{ ...sunday, date: '2026-10-30' }], round: null, ice: [] })).toBeNull();
    const later = new Date('2026-11-15T14:30:00Z'); // Sunday 6:30, before the 7:00 practice
    expect(nextUp({ ...base, now: later, practices: [sunday], round: null, ice: [] })).toBeNull();
  });
  it('skips ice from earlier today that has already ended', () => {
    const checked = { ...base, checkins: [{ practiceId: 'p-sun', userId: 'brett' }], round: null };
    expect(nextUp({ ...checked, ice: [{ ...thursdayIce, date: '2026-11-16', startTime: '06:00' }] })).toBeNull();
  });
  it('skips a round this coach doesn’t score, cancelled or ignored ice, and ice more than a week out', () => {
    const checked = { ...base, checkins: [{ practiceId: 'p-sun', userId: 'brett' }] };
    expect(nextUp({ ...checked, round: { ...round, scoring: false }, ice: [] })).toBeNull();
    expect(nextUp({ ...checked, round: null, ice: [{ ...thursdayIce, cancelled: true }, { ...thursdayIce, id: 'b', ignored: true }, { ...thursdayIce, id: 'c', date: '2026-11-25' }] })).toBeNull();
  });
});
