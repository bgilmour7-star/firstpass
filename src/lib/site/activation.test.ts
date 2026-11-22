import { describe, expect, it } from 'vitest';
import { mondayOf, summarizeActivation } from './activation';
import type { TeamWeeks } from './store';

const NOW = new Date('2026-11-22T19:00:00Z'); // Sunday Nov 22, noon in Vancouver; week of Mon Nov 16

describe('mondayOf', () => {
  it('finds the Monday a day falls in', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(mondayOf('2026-11-17')).toBe('2026-11-16');
  });
});

describe('summarizeActivation (decision 0053)', () => {
  const rows: TeamWeeks[] = [
    // Made Oct 13, first check-in 5 days later, active every week since.
    { createdAt: '2026-10-13T20:00:00Z', ageGroup: 'U7', firstCheckinAt: '2026-10-18T20:00:00Z', weeks: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((week, i) => ({ week, checkedIn: i === 0 || i >= 4 })) },
    // Made Oct 28, never checked in, gone after its first week.
    { createdAt: '2026-10-28T20:00:00Z', ageGroup: 'U7', firstCheckinAt: null, weeks: [{ week: '2026-10-26', checkedIn: false }] },
    // Made 3 days ago: too new to judge activation, though it checked in the next day.
    { createdAt: '2026-11-19T20:00:00Z', ageGroup: 'U9', firstCheckinAt: '2026-11-20T20:00:00Z', weeks: [{ week: '2026-11-16', checkedIn: true }] },
    // Old team that checked in only after 20 days: not activated.
    { createdAt: '2026-10-01T20:00:00Z', ageGroup: 'U5', firstCheckinAt: '2026-10-21T20:00:00Z', weeks: [{ week: '2026-10-19', checkedIn: true }, { week: '2026-11-09', checkedIn: false }] },
  ];
  const a = summarizeActivation(rows, { now: NOW, weeks: 8 });

  it('judges activation only for teams at least a week old', () => {
    expect(a.activated).toEqual({ teams: 3, yes: 1 });
  });
  it('takes the middle number of days to a first check-in', () => {
    expect(a.medianDays).toBe(5); // 1, 5, 20
    expect(a.neverCheckedIn).toBe(1);
  });
  it('counts teams active this week and last, and who came back', () => {
    expect(a.activeThisWeek).toBe(2);
    expect(a.activeLastWeek).toBe(2);
    expect(a.cameBack).toBe(1);
  });
  it('lays out each team by week, blank before it was made', () => {
    expect(a.weeks[0]).toBe('2026-09-28');
    expect(a.weeks.at(-1)).toBe('2026-11-16');
    expect(a.teams[1].cells).toEqual(['before', 'before', 'before', 'before', 'active', 'quiet', 'quiet', 'quiet']);
    expect(a.teams[0].cells.slice(2)).toEqual(['checkin', 'active', 'active', 'active', 'checkin', 'checkin']);
    expect(a.teams[1]).toMatchObject({ activeWeeks: 1, ageWeeks: 4 });
  });
});
