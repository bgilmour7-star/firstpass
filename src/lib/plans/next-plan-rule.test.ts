import { describe, expect, it } from 'vitest';
import { dueDayBefore, nextToPlan } from './next-plan-rule';

const ice = (id: string, date: string, extra: Partial<{ practiceId: string | null; cancelled: boolean; kind: string }> = {}) => ({ id, date, startTime: '18:15', minutes: 60, kind: 'practice', cancelled: false, ignored: false, practiceId: null, ...extra });

describe('the next practice to plan (decision 0046)', () => {
  it('is the next unplanned ice time', () => {
    const t = nextToPlan([{ id: 'a', date: '2026-11-21', startTime: '09:30', status: 'done' }], [ice('i1', '2026-11-26')], '2026-11-22');
    expect(t).toMatchObject({ date: '2026-11-26', startTime: '18:15', iceId: 'i1', guessed: false });
  });
  it('is nothing when a future plan already exists', () => {
    expect(nextToPlan([{ id: 'b', date: '2026-11-26', startTime: '18:15', status: 'draft' }], [ice('i1', '2026-11-28')], '2026-11-22')).toBeNull();
  });
  it('skips cancelled ice and games, and guesses a week on without a calendar', () => {
    const t = nextToPlan([{ id: 'a', date: '2026-11-21', startTime: '09:30', status: 'done' }], [ice('i1', '2026-11-26', { cancelled: true }), ice('g', '2026-11-27', { kind: 'game' })], '2026-11-22');
    expect(t).toMatchObject({ date: '2026-11-28', startTime: '09:30', guessed: true });
  });
  it('never plans for a team with no plans', () => {
    expect(nextToPlan([], [], '2026-11-22')).toBeNull();
  });
});

describe('the day before', () => {
  it('is due within 36 hours of a calendar ice time, not for a guess or a past time', () => {
    const t = { date: '2026-11-26', startTime: '18:15', guessed: false };
    expect(dueDayBefore(t, { date: '2026-11-25', time: '12:00' })).toBe(true);
    expect(dueDayBefore(t, { date: '2026-11-24', time: '12:00' })).toBe(false);
    expect(dueDayBefore({ ...t, guessed: true }, { date: '2026-11-25', time: '12:00' })).toBe(false);
    expect(dueDayBefore(t, { date: '2026-11-27', time: '12:00' })).toBe(false);
  });
});
