import { FOCUS_ATTRIBUTES } from '../drills/schema';
import type { IceEvent } from '../calendar/ics';
import { drillIds, type Practice, type Team } from './schema';

// The Team page's read-only summary and Create a team's guesses (decision 0026). Pure, so tested.

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const dow = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay();

type Ice = Pick<IceEvent, 'date' | 'startTime' | 'minutes' | 'rink' | 'kind' | 'sharedWith' | 'cancelled'> & { ignored?: boolean };

/** A usual practice time, read from the calendar: "Tuesdays · 5:45 · 60 min · Rink 2". */
export type WeeklySlot = { day: number; label: string; startTime: string; minutes: number; rink: string; sharedWith: string | null; count: number };

/** The team's usual practice times: upcoming practices grouped by weekday and start, most frequent first (at most 4). */
export function weeklySlots(ice: Ice[], today: string): WeeklySlot[] {
  const by = new Map<string, Ice[]>();
  for (const x of ice) {
    if (x.kind !== 'practice' || x.cancelled || x.ignored || x.date < today) continue;
    const key = `${dow(x.date)} ${x.startTime}`;
    by.set(key, [...(by.get(key) ?? []), x]);
  }
  const mode = <T,>(xs: T[]): T => {
    const n = new Map<T, number>();
    xs.forEach((v) => n.set(v, (n.get(v) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  return [...by.values()]
    .map((xs) => ({
      day: dow(xs[0].date),
      label: DAYS[dow(xs[0].date)],
      startTime: xs[0].startTime,
      minutes: mode(xs.map((x) => x.minutes)),
      rink: mode(xs.map((x) => x.rink)),
      sharedWith: xs.find((x) => x.sharedWith)?.sharedWith ?? null,
      count: xs.length,
    }))
    .sort((a, b) => b.count - a.count || a.day - b.day)
    .slice(0, 4)
    .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
}

/** Half or full ice, guessed from the calendar, with the reason shown under the choice. */
export function guessIce(slots: WeeklySlot[], fallback: Team['ice'] = 'half', fallbackWhy = 'Most young teams practise on half ice.'): { ice: Team['ice']; why: string } {
  if (!slots.length) return { ice: fallback, why: fallbackWhy };
  const shared = slots.filter((s) => s.sharedWith || /shared|half/i.test(s.rink));
  if (shared.length === slots.length) {
    const s = shared[0];
    return { ice: 'half', why: s.sharedWith ? `The calendar says you share the ice with ${s.sharedWith}, so we guessed half.` : `The calendar says “${s.rink}”, so we guessed half.` };
  }
  if (shared.length) return { ice: 'varies', why: 'Some practices are shared and some aren’t, so we guessed it changes.' };
  return { ice: fallback, why: fallback === 'full' ? 'Nothing in the calendar says the ice is shared, so we guessed full.' : fallbackWhy };
}

/** The age group a team name gives away ("Nanaimo U9 Rebels" → U9), else null. */
export function ageFromName(name: string): string | null {
  const m = /\bU\s?-?(5|7|9|11|13|15|18)\b/i.exec(name);
  return m ? `U${m[1]}` : null;
}

/** Older than Firstpass plans for: the U11+ discovery screen instead. */
export const isOlder = (age: string) => /^U(1[1-9])/.test(age);

/** Where a new team starts its focus: the first skills for its age (Hockey Canada's order). */
export function guessFocus(age: string): { focus: Team['focus']; why: string } {
  const pick = (age === 'U9' ? ['Passing', 'Skating'] : ['Skating', 'Puck control']) as Team['focus'];
  return { focus: pick.filter((f) => (FOCUS_ATTRIBUTES as readonly string[]).includes(f)), why: age === 'U9' ? 'U9s add passing to their skating.' : `Skating and puck control come first at ${age || 'this age'}.` };
}

export const DEFAULT_GEAR: Team['gear'] = { pucks: 30, bluePucks: 0, cones: 20, nets: 2 };

/** "Season so far" in the Team page's margin: practices run, coaches' check-ins, drills the kids know. */
export function seasonSoFar(practices: Pick<Practice, 'id' | 'date' | 'blocks'>[], checkins: { practiceId: string }[], today: string) {
  const run = practices.filter((p) => p.date < today);
  const ids = new Set(practices.map((p) => p.id));
  return {
    run: run.length,
    total: practices.length,
    checkins: checkins.filter((c) => ids.has(c.practiceId)).length,
    known: new Set(run.flatMap((p) => p.blocks.flatMap(drillIds))).size,
  };
}
