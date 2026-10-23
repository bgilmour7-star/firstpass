import { describe, expect, it } from 'vitest';
import { summarizeUsage, type UsageRows } from './usage';
import type { Block } from '../plans/schema';

const NOW = new Date('2026-10-20T19:00:00Z'); // noon in Vancouver
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const dayAgo = (days: number) => ago(days).slice(0, 10);
const drill = (id: string) => ({ id: `b-${id}`, kind: 'drill', drillId: id, minutes: 8 }) as unknown as Block;
const rows = (r: Partial<UsageRows>): UsageRows => ({ teams: [], practices: [], activity: [], marks: [], actions: [], ...r });

describe('summarizeUsage', () => {
  it('counts active teams and coaches now and before, and the teams that came back', () => {
    const u = summarizeUsage(
      rows({
        teams: [{ id: 'A', createdAt: ago(40) }, { id: 'B', createdAt: ago(3) }, { id: 'C', createdAt: ago(40) }],
        activity: [
          { userId: 'u1', teamId: 'A', at: ago(1), kind: 'open' },
          { userId: 'u1', teamId: 'A', at: ago(2), kind: 'edit' },
          { userId: 'u2', teamId: 'B', at: ago(2), kind: 'open_installed' },
          { userId: 'u1', teamId: 'A', at: ago(9), kind: 'checkin' },
          { userId: 'u3', teamId: 'C', at: ago(10), kind: 'open' },
        ],
      }),
      { days: 7, now: NOW },
    );
    expect(u.activeTeams).toEqual({ now: 2, before: 2 });
    expect(u.returningTeams).toBe(1);
    expect(u.activeCoaches).toEqual({ now: 2, before: 2 });
    expect(u.installedCoaches).toBe(1);
    expect(u.teams).toEqual({ total: 3, new: 1 });
  });

  it('works out the check-in rate from practices on the ice, not ones still to come', () => {
    const p = (id: string, date: string, checkedIn: boolean) => ({ id, teamId: 'A', date, createdAt: ago(12), blocks: [], checkedIn });
    const u = summarizeUsage(rows({ practices: [p('1', dayAgo(1), true), p('2', dayAgo(3), false), p('3', dayAgo(-2), false), p('4', dayAgo(9), true)] }), { days: 7, now: NOW });
    expect(u.held).toBe(2);
    expect(u.checkedIn).toBe(1);
    expect(u.checkinRate).toEqual({ now: 0.5, before: 1 });
  });

  it('counts plans by when they were made', () => {
    const p = (id: string, made: number) => ({ id, teamId: 'A', date: dayAgo(-3), createdAt: ago(made), blocks: [], checkedIn: false });
    expect(summarizeUsage(rows({ practices: [p('1', 1), p('2', 2), p('3', 8)] }), { days: 7, now: NOW }).planned).toEqual({ now: 2, before: 1 });
  });

  it('ranks drills by practices they ran in, with hits and flops', () => {
    const p = (id: string, ids: string[]) => ({ id, teamId: 'A', date: dayAgo(1), createdAt: ago(5), blocks: ids.map(drill), checkedIn: true });
    const u = summarizeUsage(
      rows({
        practices: [p('1', ['ski', 'puck', 'ski']), p('2', ['puck'])],
        marks: [
          { drillId: 'puck', rating: 'hit', at: ago(1) },
          { drillId: 'ski', rating: 'flop', at: ago(1) },
          { drillId: 'ski', rating: 'flop', at: ago(20) },
        ],
      }),
      { days: 7, now: NOW },
    );
    expect(u.drills).toEqual([
      { drillId: 'puck', used: 2, hits: 1, flops: 0 },
      { drillId: 'ski', used: 1, hits: 0, flops: 1 },
    ]);
  });

  it('has one row per day of coaches in the app, each coach once', () => {
    const u = summarizeUsage(
      rows({
        activity: [
          { userId: 'u1', teamId: 'A', at: ago(0), kind: 'open' },
          { userId: 'u1', teamId: 'A', at: ago(0), kind: 'edit' },
          { userId: 'u2', teamId: 'A', at: ago(0), kind: 'open' },
        ],
        actions: [{ kind: 'share', at: ago(1) }, { kind: 'share', at: ago(9) }, { kind: 'kept', at: ago(2) }],
      }),
      { days: 7, now: NOW },
    );
    expect(u.daily).toHaveLength(7);
    expect(u.daily.at(-1)).toEqual({ day: '2026-10-20', coaches: 2 });
    expect(u.actions).toEqual({ share: 1, kept: 1, favorite: 0, request: 0 });
  });
});
