// Next up on Home (decision 0031): the one most urgent thing for this coach, or nothing. In order:
// check in on your last practice (the plan page's rule), score an open progress round you haven't
// finished, then ice in the next 7 days with no plan. Pure, so tested.

import { practiceOver } from '../plans/checkin';
import type { Practice } from '../plans/schema';

export type NextUp =
  | { kind: 'checkin'; practiceId: string; date: string }
  | { kind: 'score'; roundId: string; month: string }
  | { kind: 'plan'; iceId: string; date: string; startTime: string; minutes: number }
  | null;

type Ice = { id: string; date: string; startTime: string; minutes: number; kind: string; cancelled: boolean; ignored: boolean; practiceId: string | null };

const DAY = 864e5;

export function nextUp(i: {
  userId: string;
  now: Date;
  practices: Pick<Practice, 'id' | 'date' | 'startTime' | 'minutes'>[];
  checkins: { practiceId: string; userId: string }[];
  /** The current progress round, when the team has progress: open, and whether this coach scores and has finished. */
  round: { id: string; month: string; open: boolean; scoring: boolean; finished: boolean } | null;
  ice: Ice[];
}): NextUp {
  const today = i.now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const days = (d: string) => (Date.parse(today) - Date.parse(d)) / DAY;

  // 1. The newest practice that's over, from the last two weeks, that this coach hasn't checked in on.
  const last = [...i.practices].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)).find((p) => practiceOver(p, i.now));
  if (last && days(last.date) <= 14 && !i.checkins.some((c) => c.practiceId === last.id && c.userId === i.userId)) return { kind: 'checkin', practiceId: last.id, date: last.date };

  // 2. An open round this coach scores and hasn't finished.
  if (i.round?.open && i.round.scoring && !i.round.finished) return { kind: 'score', roundId: i.round.id, month: i.round.month };

  // 3. The next practice ice in the coming week with no plan.
  const ice = i.ice
    .filter((x) => x.kind === 'practice' && !x.cancelled && !x.ignored && !x.practiceId && x.date >= today && -days(x.date) <= 7 && !practiceOver(x, i.now))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  if (ice) return { kind: 'plan', iceId: ice.id, date: ice.date, startTime: ice.startTime, minutes: ice.minutes };

  return null;
}
