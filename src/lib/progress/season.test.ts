import { describe, expect, it } from 'vitest';
import { season } from './season';
import type { CoachScore, Counts, Round } from './report';
import type { Goal } from './pace';
import type { Block } from '../plans/schema';

// A season like the canvas: Oct to Mar, one report a month. Shooting climbs 2.0 → 2.9 against a 3.0 goal.
const MONTHS = ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'];
const SHOOT: Counts[] = [[0, 10, 0, 0, 0], [0, 9, 1, 0, 0], [0, 6, 4, 0, 0], [0, 4, 6, 0, 0], [0, 2, 8, 0, 0], [0, 1, 9, 0, 0]];
const rounds: Round[] = MONTHS.map((m, i) => ({ id: `r${i}`, teamId: 't', month: m, openedAt: `${m.slice(0, 8)}04T20:00:00Z`, closedAt: i < 5 ? 'x' : null, levelsVersion: 'U7', skaters: 10 })).reverse();
const coach = (i: number, user: string, shooting: Counts, finished = true): CoachScore => ({ roundId: `r${i}`, userId: user, name: user, answers: { Shooting: shooting, Skating: [0, 5, 5, 0, 0] }, done: [], noChange: [], startedAt: '', finishedAt: finished ? 'x' : null, seconds: null });
const scores: CoachScore[] = [...MONTHS.map((_, i) => coach(i, 'b', SHOOT[i])), coach(1, 'k', [0, 0, 0, 10, 0])];
const goal: Goal = { id: 'g', attribute: 'Shooting', target: [0, 0, 10, 0, 0], byDate: '2027-03-15', baselineRoundId: 'r0', baselineScore: 2.0, setAt: '2026-10-06T00:00:00Z' };
const block = (drillId: string, minutes: number): Block => ({ id: drillId, kind: 'drill', drillId, minutes, levels: [1] });
const byId = new Map([
  ['skate', { focus: [{ attribute: 'Skating' as const, level: 2 as const, why: '' }] }],
  ['shoot', { focus: [{ attribute: 'Shooting' as const, level: 2 as const, why: '' }] }],
]);
const practices = [
  { date: '2026-10-10', blocks: [block('skate', 30), block('shoot', 5)] },
  { date: '2026-12-10', blocks: [block('skate', 15), block('shoot', 15)] },
];

describe('season', () => {
  const s = season(rounds, scores, 'b', [goal], practices, byId, '2027-03-09');
  it('lays out every report this coach can see, oldest first', () => {
    expect(s.months.map((m) => m.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']);
    expect(s.rows.find((r) => r.attribute === 'Shooting')!.scores).toEqual([2, 3.1, 2.4, 2.6, 2.8, 2.9]);
    expect(s.rows.find((r) => r.attribute === 'Shooting')!.change).toBe(0.9);
    expect(s.rows.find((r) => r.attribute === 'Shooting')!.goal).toBe(true);
    expect(s.practices).toBe(2);
  });
  it('leaves out months this coach did not score', () => {
    const k = season(rounds, scores, 'k', [goal], practices, byId, '2027-03-09');
    expect(k.months.map((m) => m.label)).toEqual(['Nov']);
  });
  it('draws the goal: starting point, the line, and how it ended', () => {
    const g = s.goals[0];
    expect(g.points[0]).toMatchObject({ label: 'Oct', score: 2, status: null });
    expect(g.points.at(-1)).toMatchObject({ label: 'Mar', score: 2.9, status: 'short' });
    expect(g.status).toBe('Short of goal');
    expect(g.warn).toBe(true);
    expect(g.ice[0]).toBe(14);
    expect(g.ice[1]).toBeNull();
    expect(g.ice[2]).toBe(50);
  });
  it('shows what practices worked on, and where coaches disagreed', () => {
    const shoot = s.focus.find((f) => f.attribute === 'Shooting')!.levels;
    expect(shoot[0]).toBe(2);
    expect(shoot[1]).toBeNull();
    expect(s.gaps[1]).toEqual({ gap: 1.9, on: ['Shooting'] });
    expect(s.gaps[0].gap).toBeNull();
  });
  it('writes one line per report', () => {
    expect(s.notes[0]).toBe('Starting point · goals set');
    expect(s.notes.at(-1)).toBe('Shooting short of goal');
  });
});
