import { drillIds, type Block } from '../plans/schema';
import { vanDay } from './summary';

// Admin → Analytics → In the app (decision 0025): how coaches use Firstpass, from rows the app
// already keeps (plans, edits, check-ins, shares) plus one "opened the app today" row per coach.
// Teams, coaches and drills are counted; nothing here names a child, and coaches only by count.

const DAY = 86_400_000;

export type UsageRows = {
  teams: { id: string; createdAt: string }[];
  /** Plans dated, or made, in the last two periods. */
  practices: { id: string; teamId: string; date: string; createdAt: string; blocks: Block[]; checkedIn: boolean }[];
  /** Something a coach did: opened the app (installed or in the browser), changed a plan, checked in. */
  activity: { userId: string; teamId: string | null; at: string; kind: 'open' | 'open_installed' | 'edit' | 'checkin' }[];
  /** Big hit / flop marks from check-ins. */
  marks: { drillId: string; rating: 'hit' | 'flop'; at: string }[];
  /** Smaller actions worth counting. */
  actions: { kind: 'share' | 'kept' | 'favorite' | 'request'; at: string }[];
};

type Metric = { now: number; before: number };
export type Usage = {
  teams: { total: number; new: number };
  activeTeams: Metric;
  /** Active this period and the one before. */
  returningTeams: number;
  activeCoaches: Metric;
  /** Coaches who opened the app from their home screen. */
  installedCoaches: number;
  planned: Metric;
  /** Practices dated in the period, up to today, and how many got a check-in. */
  held: number;
  checkedIn: number;
  checkinRate: { now: number | null; before: number | null };
  actions: Record<UsageRows['actions'][number]['kind'], number>;
  daily: { day: string; coaches: number }[];
  drills: { drillId: string; used: number; hits: number; flops: number }[];
};

export const EMPTY_USAGE_ROWS: UsageRows = { teams: [], practices: [], activity: [], marks: [], actions: [] };

export function summarizeUsage(rows: UsageRows, opts: { days: number; now?: Date }): Usage {
  const now = opts.now ?? new Date();
  const end = now.getTime();
  const start = end - opts.days * DAY;
  const prevStart = start - opts.days * DAY;
  const ms = (t: string) => new Date(t).getTime();
  const inWin = (t: string) => ms(t) > start && ms(t) <= end;
  const inPrev = (t: string) => ms(t) > prevStart && ms(t) <= start;
  // Practice dates are Vancouver days.
  const today = vanDay(now);
  const firstDay = vanDay(new Date(start + DAY));
  const prevFirstDay = vanDay(new Date(prevStart + DAY));

  const act = rows.activity.filter((a) => inWin(a.at));
  const actBefore = rows.activity.filter((a) => inPrev(a.at));
  const teamsOf = (list: UsageRows['activity'], planned: UsageRows['practices']) => new Set([...list.map((a) => a.teamId), ...planned.map((p) => p.teamId)].filter((x): x is string => !!x));
  const planned = rows.practices.filter((p) => inWin(p.createdAt));
  const plannedBefore = rows.practices.filter((p) => inPrev(p.createdAt));
  const teamsNow = teamsOf(act, planned);
  const teamsBefore = teamsOf(actBefore, plannedBefore);

  const held = rows.practices.filter((p) => p.date >= firstDay && p.date <= today);
  const heldBefore = rows.practices.filter((p) => p.date >= prevFirstDay && p.date < firstDay);
  const rate = (list: UsageRows['practices']) => (list.length ? list.filter((p) => p.checkedIn).length / list.length : null);

  const days: string[] = [];
  for (let t = start + DAY; t <= end + 1; t += DAY) days.push(vanDay(new Date(t)));
  const daily = [...new Set(days)].map((day) => ({ day, coaches: new Set(act.filter((a) => vanDay(a.at) === day).map((a) => a.userId)).size }));

  const drills = new Map<string, { used: number; hits: number; flops: number }>();
  const slot = (id: string) => {
    if (!drills.has(id)) drills.set(id, { used: 0, hits: 0, flops: 0 });
    return drills.get(id)!;
  };
  for (const p of held) for (const id of new Set(p.blocks.flatMap(drillIds))) slot(id).used += 1;
  for (const m of rows.marks.filter((x) => inWin(x.at))) slot(m.drillId)[m.rating === 'hit' ? 'hits' : 'flops'] += 1;

  const actions = { share: 0, kept: 0, favorite: 0, request: 0 };
  for (const a of rows.actions) if (inWin(a.at)) actions[a.kind] += 1;

  return {
    teams: { total: rows.teams.filter((t) => ms(t.createdAt) <= end).length, new: rows.teams.filter((t) => inWin(t.createdAt)).length },
    activeTeams: { now: teamsNow.size, before: teamsBefore.size },
    returningTeams: [...teamsNow].filter((t) => teamsBefore.has(t)).length,
    activeCoaches: { now: new Set(act.map((a) => a.userId)).size, before: new Set(actBefore.map((a) => a.userId)).size },
    installedCoaches: new Set(act.filter((a) => a.kind === 'open_installed').map((a) => a.userId)).size,
    planned: { now: planned.length, before: plannedBefore.length },
    held: held.length,
    checkedIn: held.filter((p) => p.checkedIn).length,
    checkinRate: { now: rate(held), before: rate(heldBefore) },
    actions,
    daily,
    drills: [...drills.entries()]
      .map(([drillId, v]) => ({ drillId, ...v }))
      .sort((a, b) => b.used - a.used || b.hits - a.hits || a.drillId.localeCompare(b.drillId))
      .slice(0, 8),
  };
}
