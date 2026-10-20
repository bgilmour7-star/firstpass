import { describe, expect, it } from 'vitest';
import { nextPracticeDate } from './next-date';

const ice = (o: Partial<Parameters<typeof nextPracticeDate>[1][number]>) => ({ id: 'i1', date: '2026-10-22', startTime: '17:45', kind: 'practice', cancelled: false, ignored: false, practiceId: null, ...o });
describe('nextPracticeDate', () => {
  it('takes the next unplanned practice ice time', () => {
    expect(nextPracticeDate([{ id: 'p', date: '2026-10-24', startTime: '09:45' }], [ice({ kind: 'game', id: 'g' }), ice({})], '2026-10-19')).toEqual({ iceId: 'i1' });
  });
  it('skips ice times that already have a plan', () => {
    const n = nextPracticeDate([{ id: 'p', date: '2026-10-24', startTime: '09:45' }], [ice({ practiceId: 'p' })], '2026-10-19');
    expect(n).toEqual({ date: '2026-10-31', startTime: '09:45', why: 'week' });
  });
  it('moves a week at a time past today', () => {
    expect(nextPracticeDate([{ id: 'p', date: '2026-10-03', startTime: '17:45' }], [], '2026-10-19')).toEqual({ date: '2026-10-24', startTime: '17:45', why: 'week' });
  });
  it('falls back to the coming Saturday', () => {
    expect(nextPracticeDate([], [], '2026-10-19')).toEqual({ date: '2026-10-24', startTime: '09:30', why: 'sat' });
    expect(nextPracticeDate([], [], '2026-10-24')).toEqual({ date: '2026-10-31', startTime: '09:30', why: 'sat' });
  });
});
