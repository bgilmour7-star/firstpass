// Progress on Home (decision 0031): the newest report this coach can see, as rows for the chart, one
// sentence that joins goals to the next plan, and the line about the next round. Pure, so tested.

import type { Attribute } from '../progress/levels';
import type { TeamReport } from '../progress/report';
import type { GoalView } from '../progress/goals-view';
import type { Status } from '../progress/pace';

export type ProgressRow = {
  attribute: Attribute;
  now: number | null;
  /** Last round's score, when there was one. */
  before: number | null;
  goal: { target: number; expected: number | null; status: Status | null; byDate: string } | null;
};

export type HomeProgress =
  | { kind: 'first'; canScore: boolean }
  | { kind: 'report'; month: string; prevMonth: string | null; rows: ProgressRow[]; lead: string; detail: string | null; hasGoals: boolean; round: string };

const monthName = (m: string) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long' });
const lower = (a: string) => a.toLowerCase();
const join = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function homeProgress(i: {
  report: TeamReport | null;
  prevMonth: string | null;
  goals: GoalView[];
  /** The current round, to say what's next. */
  round: { month: string; open: boolean; finished: boolean; scoring: boolean } | null;
  /** The next plan: minutes of drill time by Main skill, and its weekday. */
  next: { weekday: string; minutes: number; bySkill: Partial<Record<string, number>> } | null;
}): HomeProgress {
  if (!i.report || !i.report.attributes.some((a) => a.score != null)) return { kind: 'first', canScore: Boolean(i.round?.open && i.round.scoring) };

  const goalOf = new Map(i.goals.map((g) => [g.goal.attribute as string, g]));
  const rows: ProgressRow[] = i.report.attributes.map((a) => {
    const g = goalOf.get(a.attribute);
    return {
      attribute: a.attribute,
      now: a.score,
      before: a.score != null && a.change != null ? Math.round((a.score - a.change) * 10) / 10 : null,
      goal: g ? { target: g.target, expected: g.expected, status: g.status, byDate: g.goal.byDate } : null,
    };
  });

  // Furthest behind first: how far below the line it asks for this month.
  // A goal that ended short still needs ice time; it sorts after the ones behind this month's line.
  const gapOf = (g: GoalView) => (g.status === 'short' ? -1 : (g.expected ?? 0) - (g.now ?? 0));
  const behind = i.goals.filter((g) => g.status === 'behind' || g.status === 'short').sort((a, b) => gapOf(b) - gapOf(a));
  const ahead = i.goals.filter((g) => g.status === 'ahead').map((g) => g.goal.attribute as string);
  const reached = i.goals.filter((g) => g.status === 'reached').map((g) => g.goal.attribute as string);
  const good = [ahead.length ? `${join(ahead.slice(0, 2))} ${ahead.length === 1 ? 'is' : 'are'} ahead.` : '', reached.length ? `${join(reached.slice(0, 2))} reached ${reached.length === 1 ? 'its goal' : 'their goals'}.` : ''].filter(Boolean).join(' ');
  let lead: string;
  let detail: string | null = null;
  if (behind.length) {
    const names = behind.slice(0, 2).map((g) => g.goal.attribute as string);
    lead = `${good ? `${good} ` : ''}${join(names)} need${names.length === 1 ? 's' : ''} more ice time.`;
    const first = names[0];
    if (i.next) detail = `${i.next.weekday}’s plan gives ${lower(first)} ${i.next.bySkill[first] ?? 0} of ${i.next.minutes} minutes.`;
  } else if (i.goals.length) {
    lead = good ? `${good}${i.goals.length > ahead.length + reached.length ? ' The rest are on pace.' : ''}` : 'Every goal is on pace.';
  } else {
    const moved = rows.filter((r) => r.now != null && r.before != null && r.now > r.before).map((r) => lower(r.attribute));
    lead = i.prevMonth ? (moved.length ? `Up in ${join(moved.slice(0, 3))} since ${monthName(i.prevMonth)}.` : `No change since ${monthName(i.prevMonth)}.`) : `Where the team started in ${monthName(i.report.month)}.`;
  }

  const r = i.round;
  const round = !r
    ? ''
    : r.open && r.scoring && !r.finished
      ? `The ${monthName(r.month)} round is open.`
      : r.open
        ? `You’ve scored ${monthName(r.month)}. The report fills in as other coaches finish.`
        : `The next round opens after the first practice in ${monthName(nextMonthOf(r.month))}.`;

  return { kind: 'report', month: i.report.month, prevMonth: i.prevMonth, rows, lead, detail, hasGoals: i.goals.length > 0, round };
}

function nextMonthOf(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
}
