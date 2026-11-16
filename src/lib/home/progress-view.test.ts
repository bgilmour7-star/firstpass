import { describe, expect, it } from 'vitest';
import { homeProgress } from './progress-view';
import type { TeamReport } from '../progress/report';
import type { GoalView } from '../progress/goals-view';
import { ATTRIBUTES } from '../progress/levels';

// November: Skating 2.3 → 2.7, Shooting 2.0 → 2.1, the rest unchanged (the canvas numbers).
const now: Record<string, [number, number]> = { Skating: [2.7, 0.4], 'Puck control': [2.0, 0], Passing: [1.8, 0], Shooting: [2.1, 0.1], 'Game sense': [2.0, 0], 'Effort & fun': [3.2, 0] };
const report = { roundId: 'nov', month: '2026-11-01', coaches: [], attributes: ATTRIBUTES.map((attribute) => ({ attribute, score: now[attribute][0], change: now[attribute][1], spread: [0, 0, 0, 0, 0], coaches: [], gap: null })) } as unknown as TeamReport;
const goal = (attribute: string, nowScore: number, expected: number, target: number, status: GoalView['status']) => ({ goal: { attribute, byDate: '2027-03-01' }, now: nowScore, expected, target, status }) as unknown as GoalView;
const goals = [goal('Skating', 2.7, 2.5, 3.4, 'ahead'), goal('Shooting', 2.1, 2.3, 3.5, 'behind')];
const next = { weekday: 'Sunday', minutes: 50, bySkill: { Shooting: 18, Skating: 16 } };
const closed = { month: '2026-11-01', open: false, finished: true, scoring: true };

describe('progress on Home (decision 0031)', () => {
  it('says what’s ahead, what needs ice time, and what the next plan gives it', () => {
    const p = homeProgress({ report, prevMonth: '2026-10-01', goals, round: closed, next });
    expect(p.kind).toBe('report');
    if (p.kind !== 'report') return;
    expect(p.lead).toBe('Skating is ahead. Shooting needs more ice time.');
    expect(p.detail).toBe('Sunday’s plan gives shooting 18 of 50 minutes.');
    expect(p.round).toBe('The next round opens after the first practice in December.');
    expect(p.rows.find((r) => r.attribute === 'Skating')).toMatchObject({ now: 2.7, before: 2.3, goal: { target: 3.4, expected: 2.5, status: 'ahead' } });
    expect(p.rows.find((r) => r.attribute === 'Passing')).toMatchObject({ now: 1.8, before: 1.8, goal: null });
  });
  it('names at most two goals behind, furthest behind first', () => {
    const six = [goal('Passing', 1.8, 1.9, 3, 'behind'), goal('Shooting', 2.1, 2.6, 3.5, 'behind'), goal('Game sense', 2.0, 2.2, 3, 'behind')];
    const p = homeProgress({ report, prevMonth: '2026-10-01', goals: six, round: closed, next });
    expect(p.kind === 'report' && p.lead).toBe('Shooting and Game sense need more ice time.');
  });
  it('a goal that ended short still needs ice time; a reached goal says so', () => {
    const ended = [goal('Skating', 3.5, 3.5, 3.5, 'reached'), goal('Shooting', 2.9, 3.0, 3.0, 'short')];
    const p = homeProgress({ report, prevMonth: '2026-10-01', goals: ended, round: closed, next });
    expect(p.kind === 'report' && p.lead).toBe('Skating reached its goal. Shooting needs more ice time.');
    const fine = homeProgress({ report, prevMonth: '2026-10-01', goals: [goal('Skating', 2.7, 2.5, 3.4, 'ahead'), goal('Passing', 1.8, 1.8, 3, 'on-pace')], round: closed, next });
    expect(fine.kind === 'report' && fine.lead).toBe('Skating is ahead. The rest are on pace.');
  });
  it('without goals, says what went up', () => {
    const p = homeProgress({ report, prevMonth: '2026-10-01', goals: [], round: closed, next });
    expect(p.kind === 'report' && [p.lead, p.detail, p.hasGoals]).toEqual(['Up in skating and shooting since October.', null, false]);
  });
  it('before any report: the first-round card, with scoring offered only if it’s open for you', () => {
    expect(homeProgress({ report: null, prevMonth: null, goals: [], round: { ...closed, open: true, finished: false }, next })).toEqual({ kind: 'first', canScore: true });
    expect(homeProgress({ report: null, prevMonth: null, goals: [], round: null, next })).toEqual({ kind: 'first', canScore: false });
  });
  it('says where the round stands', () => {
    const open = homeProgress({ report, prevMonth: '2026-10-01', goals, round: { month: '2026-12-01', open: true, finished: false, scoring: true }, next });
    expect(open.kind === 'report' && open.round).toBe('The December round is open.');
    const done = homeProgress({ report, prevMonth: '2026-10-01', goals, round: { month: '2026-12-01', open: true, finished: true, scoring: true }, next });
    expect(done.kind === 'report' && done.round).toBe('You’ve scored December. The report fills in as other coaches finish.');
  });
});
