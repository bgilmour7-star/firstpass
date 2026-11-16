import { describe, expect, it } from 'vitest';
import { ATTRIBUTES, LEVELS, levelSetFor } from './levels';
import { average, canSeeReport, moveOne, monthName, monthOf, resize, startingCounts, teamReport, total, validCounts, type CoachScore, type Counts, type Round } from './report';

const round: Round = { id: 'nov', teamId: 't', month: '2026-11-01', openedAt: '2026-11-01T20:00:00Z', closedAt: null, levelsVersion: 'U7-2026-11-15', skaters: 12 };
const coach = (userId: string, name: string, skating: Counts, shooting: Counts, finished = true): CoachScore => ({
  roundId: 'nov', userId, name, answers: { Skating: skating, Shooting: shooting }, done: ['Skating', 'Shooting'], noChange: [], startedAt: '2026-11-02T17:00:00Z', finishedAt: finished ? '2026-11-02T17:03:00Z' : null, seconds: 130,
});

// The canvas's November report: Skating 2.7 (B 2.6 · K 2.9 · S 2.6), Shooting 2.1 (B 1.7 · K 2.7 · S 1.9).
const brett = coach('b', 'Brett', [1, 4, 6, 1, 0], [5, 6, 1, 0, 0]);
const kara = coach('k', 'Kara', [0, 4, 5, 3, 0], [1, 4, 5, 2, 0]);
const sam = coach('s', 'Sam', [1, 4, 6, 1, 0], [3, 7, 2, 0, 0]);

describe('U7 levels', () => {
  it('has five short lines for each of the six attributes', () => {
    const set = levelSetFor('U7')!;
    for (const a of ATTRIBUTES) {
      expect(set.levels[a]).toHaveLength(LEVELS.length);
      for (const line of set.levels[a]) expect(line.length).toBeLessThanOrEqual(90);
    }
  });
  it('has no set for ages without one yet', () => {
    expect(levelSetFor('U9')).toBeNull();
  });
});

describe('counts', () => {
  it('averages levels', () => {
    expect(average([1, 4, 6, 1, 0])).toBeCloseTo(2.583, 2);
    expect(average([0, 0, 0, 0, 0])).toBeNull();
  });
  it('moves one skater without changing the total', () => {
    expect(moveOne([1, 4, 6, 1, 0], 3, 1)).toEqual([1, 4, 5, 2, 0]);
    expect(moveOne([1, 4, 6, 1, 0], 1, -1)).toEqual([1, 4, 6, 1, 0]);
    expect(moveOne([0, 4, 6, 1, 0], 1, 1)).toEqual([0, 4, 6, 1, 0]);
  });
  it('validates against the team size', () => {
    expect(validCounts([1, 4, 6, 1, 0], 12)).toBe(true);
    expect(validCounts([1, 4, 6, 1, 1], 12)).toBe(false);
    expect(validCounts([1, 4, -1, 1, 0], 12)).toBe(false);
    expect(validCounts([1, 4, 6, 1], 12)).toBe(false);
    expect(validCounts([0, 0, 0, 0, 0], 12)).toBe(false);
  });
  it('starts from your own answer, then the team spread, resized to the team', () => {
    expect(startingCounts([1, 4, 6, 1, 0], [9, 9, 9, 9, 9], 12)).toEqual([1, 4, 6, 1, 0]);
    expect(startingCounts(undefined, [2, 4, 6, 0, 0], 12)).toEqual([2, 4, 6, 0, 0]);
    expect(total(startingCounts(undefined, undefined, 11))).toBe(11);
    expect(total(resize([1, 4, 6, 1, 0], 10))).toBe(10);
  });
});

describe('teamReport', () => {
  const r = teamReport(round, [brett, kara, sam]);
  const skating = r.attributes.find((a) => a.attribute === 'Skating')!;
  const shooting = r.attributes.find((a) => a.attribute === 'Shooting')!;
  it('scores the canvas November report', () => {
    expect(skating.score).toBe(2.7);
    expect(skating.coaches.map((c) => c.average)).toEqual([2.6, 2.9, 2.6]);
    expect(shooting.score).toBe(2.1);
    expect(shooting.coaches.map((c) => c.average)).toEqual([1.7, 2.7, 1.9]);
    expect(shooting.gap).toBe(1);
    expect(total(skating.spread)).toBe(12);
  });
  it('leaves out coaches who have not finished', () => {
    const r2 = teamReport(round, [brett, { ...kara, finishedAt: null }]);
    expect(r2.coaches.map((c) => c.name)).toEqual(['Brett']);
    expect(r2.attributes.find((a) => a.attribute === 'Skating')!.gap).toBeNull();
  });
  it('shows the change from the previous report', () => {
    const oct = teamReport({ ...round, id: 'oct', month: '2026-10-01' }, [{ ...brett, roundId: 'oct', answers: { Skating: [1, 5, 6, 0, 0] } }]);
    expect(teamReport(round, [brett, kara, sam], oct).attributes.find((a) => a.attribute === 'Skating')!.change).toBe(0.3);
  });
  it('gives no score for an attribute nobody scored', () => {
    expect(r.attributes.find((a) => a.attribute === 'Passing')!.score).toBeNull();
  });
});

describe('who sees the report', () => {
  it('only coaches who finished this round', () => {
    expect(canSeeReport([brett, { ...kara, finishedAt: null }], 'nov', 'b')).toBe(true);
    expect(canSeeReport([brett, { ...kara, finishedAt: null }], 'nov', 'k')).toBe(false);
  });
});

describe('months', () => {
  it('names and finds months in Vancouver time', () => {
    expect(monthName('2026-11-01')).toBe('November');
    expect(monthOf(new Date('2026-12-01T05:00:00Z'))).toBe('2026-11-01');
  });
});
