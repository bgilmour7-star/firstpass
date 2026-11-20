// Which practice Firstpass plans by itself, and when (decision 0046). Pure, so it's tested without a store.
import { nextPracticeDate } from './next-date';

type Ice = { id: string; date: string; startTime: string; minutes: number; kind: string; cancelled: boolean; ignored: boolean; practiceId: string | null; sharedWith?: string | null };
type Plan = { id: string; date: string; startTime: string; status: string };

export type NextTarget = { date: string; startTime: string; minutes?: number; iceId?: string; shared?: boolean; guessed: boolean };

/** The next practice with no plan yet, or null when one is already planned. A future draft means "planned". */
export function nextToPlan(plans: Plan[], ice: Ice[], today: string): NextTarget | null {
  if (plans.some((p) => p.date >= today && p.status !== 'done')) return null;
  const n = nextPracticeDate(plans, ice, today);
  if ('iceId' in n) {
    const x = ice.find((i) => i.id === n.iceId)!;
    return { date: x.date, startTime: x.startTime, minutes: Math.min(120, Math.max(20, x.minutes)), iceId: x.id, shared: !!x.sharedWith, guessed: false };
  }
  // A guess needs a practice to guess from: never plan the "coming Saturday" for a team with no plans.
  if (n.why !== 'week') return null;
  return { date: n.date, startTime: n.startTime, guessed: true };
}

const minutesUntil = (t: NextTarget, now: { date: string; time: string }) => {
  const at = Date.parse(`${t.date}T${t.startTime}:00Z`);
  const from = Date.parse(`${now.date}T${now.time}:00Z`);
  return (at - from) / 60000;
};

/** The day-before rule: an ice time from the calendar within 36 hours. Guessed dates wait for a coach. */
export function dueDayBefore(t: NextTarget | null, now: { date: string; time: string }): t is NextTarget {
  if (!t || t.guessed) return false;
  const m = minutesUntil(t, now);
  return m > 0 && m <= 36 * 60;
}
