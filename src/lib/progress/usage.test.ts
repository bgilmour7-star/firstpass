import { describe, expect, it } from 'vitest';
import { minSec, summarizeProgress, type ProgressUsageRows } from './usage';

// Two teams. Blue: head coach + 2 assistants, all scored October; in November the head and one
// assistant finish, the other only starts. Red: one head coach, scored November only.
const rows: ProgressUsageRows = {
  teams: [
    { id: 'blue', name: 'U7 Blue', lastPlanAt: '2026-11-14T10:00:00Z' },
    { id: 'red', name: 'U7 Red', lastPlanAt: '2026-10-20T10:00:00Z' },
    { id: 'green', name: 'U7 Green', lastPlanAt: '2026-11-10T10:00:00Z' },
  ],
  members: [
    { teamId: 'blue', userId: 'b', role: 'head_coach', scores: true },
    { teamId: 'blue', userId: 'k', role: 'coach', scores: true },
    { teamId: 'blue', userId: 's', role: 'coach', scores: true },
    { teamId: 'red', userId: 'r', role: 'head_coach', scores: true },
  ],
  rounds: [
    { id: 'bo', teamId: 'blue', month: '2026-10-01', skaters: 12 },
    { id: 'bn', teamId: 'blue', month: '2026-11-01', skaters: 12 },
    { id: 'rn', teamId: 'red', month: '2026-11-01', skaters: 10 },
  ],
  scores: [
    ...['b', 'k', 's'].map((u) => ({ roundId: 'bo', teamId: 'blue', userId: u, finished: true, seconds: 200, done: 6, noChange: 0, answers: { Shooting: [5, 6, 1, 0, 0] as [number, number, number, number, number] } })),
    { roundId: 'bn', teamId: 'blue', userId: 'b', finished: true, seconds: 120, done: 6, noChange: 4, answers: { Shooting: [5, 6, 1, 0, 0] } },
    { roundId: 'bn', teamId: 'blue', userId: 'k', finished: true, seconds: 140, done: 6, noChange: 2, answers: { Shooting: [1, 4, 5, 2, 0] } },
    { roundId: 'bn', teamId: 'blue', userId: 's', finished: false, seconds: 30, done: 2, noChange: 1, answers: null },
    { roundId: 'rn', teamId: 'red', userId: 'r', finished: true, seconds: 100, done: 6, noChange: 6, answers: { Shooting: [0, 10, 0, 0, 0] } },
  ],
  goals: [{ teamId: 'blue', attribute: 'Shooting', target: [0, 0, 6, 6, 0], byDate: '2027-03-01', baselineRoundId: 'bo', baselineScore: '2.2', setAt: '2026-10-07T00:00:00Z' }],
  emailed: [{ roundId: 'bn', userId: 'b' }, { roundId: 'bn', userId: 'k' }, { roundId: 'bn', userId: 's' }],
  views: [{ roundId: 'bn', userId: 'b' }],
  taken: [{ teamId: 'blue', key: 'goal:Shooting:tour-bus' }],
  kept: [{ teamId: 'blue', key: 'goal:Shooting:ski-racer' }, { teamId: 'blue', key: 'flop:ski-racer' }],
  months: ['2026-11-01', '2026-10-01'],
};

describe('progress usage', () => {
  const u = summarizeProgress(rows, '2026-11-01', new Date('2026-11-15T12:00:00Z'));
  it('answers "did coaches score again?"', () => {
    expect(u.again).toEqual({ n: 2, of: 3 });
    expect(u.scored).toMatchObject({ n: 3, of: 4, head: { n: 2, of: 2 }, assistants: { n: 1, of: 2 } });
  });
  it('counts goal suggestions taken of those acted on, goals only', () => {
    expect(u.taken).toEqual({ n: 1, of: 2 });
  });
  it('compares planning for scoring teams and the rest', () => {
    expect(u.stillPlanning.scoring).toEqual({ n: 1, of: 2 });
    expect(u.stillPlanning.others).toEqual({ n: 1, of: 1 });
  });
  it('measures how easily it goes', () => {
    expect(u.medianSeconds).toBe(120);
    expect(u.noChange).toBeCloseTo(12 / 18);
    expect(u.withGoal).toMatchObject({ n: 1, of: 2, goals: 1, behind: 1 });
    expect(u.medianGap).toBe(1);
  });
  it('follows the email to the report', () => {
    expect(u.funnel).toEqual({ emailed: 3, started: 4, finished: 3, viewed: 1, finishedWithoutEmail: 1 });
  });
  it('lists teams with counts only', () => {
    expect(u.byTeam[0]).toMatchObject({ name: 'U7 Blue', scored: { n: 2, of: 3 }, again: { n: 2, of: 3 }, goals: 1, behind: 1, taken: { n: 1, of: 2 } });
    expect(JSON.stringify(u.byTeam)).not.toMatch(/"(b|k|s|r)"/);
  });
  it('formats time to score', () => expect(minSec(130)).toBe('2:10'));
});
