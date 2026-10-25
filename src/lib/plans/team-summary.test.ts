import { describe, expect, it } from 'vitest';
import { ageFromName, guessFocus, guessIce, isOlder, seasonSoFar, weeklySlots } from './team-summary';

const ice = (date: string, startTime: string, over: Record<string, unknown> = {}) => ({ date, startTime, minutes: 60, rink: 'Rink 2', kind: 'practice' as const, sharedWith: null as string | null, cancelled: false, ...over });

describe('usual practice times from the calendar', () => {
  // 2026-10-27 is a Tuesday.
  const cal = [
    ice('2026-10-27', '17:45'),
    ice('2026-11-03', '17:45'),
    ice('2026-10-31', '09:45', { rink: 'Rink 1', sharedWith: 'U7 Red' }),
    ice('2026-11-07', '09:45', { rink: 'Rink 1', sharedWith: 'U7 Red' }),
    ice('2026-11-01', '12:00', { kind: 'game' }),
    ice('2026-11-10', '17:45', { cancelled: true }),
    ice('2026-10-20', '17:45'),
  ];
  it('groups practices by weekday and start, in week order; games, cancelled and past ones left out', () => {
    expect(weeklySlots(cal, '2026-10-25').map((s) => [s.label, s.startTime, s.count, s.rink])).toEqual([
      ['Tuesdays', '17:45', 2, 'Rink 2'],
      ['Saturdays', '09:45', 2, 'Rink 1'],
    ]);
  });
  it('guesses half ice when every practice is shared, and says why', () => {
    const g = guessIce(weeklySlots(cal.filter((x) => x.sharedWith), '2026-10-25'));
    expect(g.ice).toBe('half');
    expect(g.why).toContain('U7 Red');
  });
  it('guesses it changes when some are shared', () => {
    expect(guessIce(weeklySlots(cal, '2026-10-25')).ice).toBe('varies');
  });
  it('keeps the fallback without a calendar', () => {
    expect(guessIce([], 'full', 'Like your Avalanche.')).toEqual({ ice: 'full', why: 'Like your Avalanche.' });
  });
});

describe('guesses for a new team', () => {
  it('reads the age from the name', () => {
    expect(ageFromName('Nanaimo U9 Rebels')).toBe('U9');
    expect(ageFromName('u7 blue')).toBe('U7');
    expect(ageFromName('Peewee Rebels')).toBeNull();
    expect(ageFromName('U-11 Hawks')).toBe('U11');
  });
  it('knows which ages are older than we plan for', () => {
    expect(isOlder('U11')).toBe(true);
    expect(isOlder('U15+')).toBe(true);
    expect(isOlder('U9')).toBe(false);
  });
  it('suggests a starting focus for the age', () => {
    expect(guessFocus('U7').focus).toEqual(['Skating', 'Puck control']);
    expect(guessFocus('U9').focus).toEqual(['Passing', 'Skating']);
  });
});

describe('season so far', () => {
  it('counts practices run, check-ins and drills the kids know', () => {
    const d = (id: string) => ({ id, kind: 'drill' as const, drillId: id, minutes: 5, levels: [1] });
    const s = seasonSoFar(
      [
        { id: 'a', date: '2026-10-10', blocks: [d('x'), d('y')] },
        { id: 'b', date: '2026-10-17', blocks: [d('y'), d('z')] },
        { id: 'c', date: '2026-10-30', blocks: [d('w')] },
      ],
      [{ practiceId: 'a' }, { practiceId: 'b' }, { practiceId: 'b' }, { practiceId: 'other-team' }],
      '2026-10-25',
    );
    expect(s).toEqual({ run: 2, total: 3, checkins: 3, known: 3 });
  });
});
