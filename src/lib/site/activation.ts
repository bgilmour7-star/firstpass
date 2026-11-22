import type { TeamWeeks } from './store';
import { vanDay } from './summary';

// Admin → Analytics → Activation and retention (decision 0053). Does a new team run a practice in its first
// week, and does it keep coming back? Weeks start Monday, Vancouver time. Teams are rows, never named.

const DAY = 86_400_000;
/** A new team counts as activated when it checks in after a practice within this many days of being made. */
export const ACTIVATION_DAYS = 7;

/** The Monday (YYYY-MM-DD) of the week a Vancouver day falls in. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

export type WeekCell = 'before' | 'quiet' | 'active' | 'checkin';
export type Activation = {
  /** Teams old enough to judge (made at least ACTIVATION_DAYS ago), and how many checked in within that time. */
  activated: { teams: number; yes: number };
  /** Days from a team being made to its first check-in, middle value, over teams that have one. */
  medianDays: number | null;
  neverCheckedIn: number;
  activeThisWeek: number;
  activeLastWeek: number;
  /** Of the teams active last week, how many are active this week so far. */
  cameBack: number;
  weeks: string[];
  teams: { label: string; madeDay: string; cells: WeekCell[]; activeWeeks: number; ageWeeks: number }[];
};

export function summarizeActivation(rows: TeamWeeks[], opts: { weeks?: number; now?: Date } = {}): Activation {
  const now = opts.now ?? new Date();
  const today = vanDay(now);
  const thisWeek = mondayOf(today);
  const lastWeek = addDays(thisWeek, -7);
  // Up to the last 12 weeks, starting no earlier than the week the first team was made.
  const first = rows.length ? mondayOf(vanDay(rows.map((r) => r.createdAt).sort()[0])) : thisWeek;
  const n = opts.weeks ?? 12;
  const weeks = Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (n - 1 - i))).filter((w) => w >= first);

  const old = rows.filter((r) => now.getTime() - Date.parse(r.createdAt) >= ACTIVATION_DAYS * DAY);
  const inTime = (r: TeamWeeks) => r.firstCheckinAt !== null && Date.parse(r.firstCheckinAt) - Date.parse(r.createdAt) <= ACTIVATION_DAYS * DAY;
  const days = rows
    .filter((r) => r.firstCheckinAt)
    .map((r) => Math.max(0, Math.round((Date.parse(r.firstCheckinAt!) - Date.parse(r.createdAt)) / DAY)))
    .sort((a, b) => a - b);
  const median = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null;
  const activeIn = (r: TeamWeeks, w: string) => r.weeks.some((x) => x.week === w);

  return {
    activated: { teams: old.length, yes: old.filter(inTime).length },
    medianDays: median,
    neverCheckedIn: rows.filter((r) => !r.firstCheckinAt).length,
    activeThisWeek: rows.filter((r) => activeIn(r, thisWeek)).length,
    activeLastWeek: rows.filter((r) => activeIn(r, lastWeek)).length,
    cameBack: rows.filter((r) => activeIn(r, lastWeek) && activeIn(r, thisWeek)).length,
    weeks,
    teams: rows.map((r) => {
      const madeDay = vanDay(r.createdAt);
      const madeWeek = mondayOf(madeDay);
      const byWeek = new Map(r.weeks.map((x) => [x.week, x.checkedIn]));
      const cells = weeks.map<WeekCell>((w) => (w < madeWeek ? 'before' : !byWeek.has(w) ? 'quiet' : byWeek.get(w) ? 'checkin' : 'active'));
      const ageWeeks = Math.floor((Date.parse(`${thisWeek}T12:00:00Z`) - Date.parse(`${madeWeek}T12:00:00Z`)) / (7 * DAY)) + 1;
      return { label: r.ageGroup ?? 'Team', madeDay, cells, activeWeeks: r.weeks.length, ageWeeks };
    }),
  };
}
