// The Next practice page (decision 0032) has three states, set by the clock: Before (plan and
// prepare), During (from 15 minutes before the start, rink-side) and After (check in). Pure, so tested.

export type Phase = 'before' | 'during' | 'after';

/** Minutes before the start when the page turns into the rink-side view. */
export const DURING_LEAD = 15;

/**
 * Which state the page is in. `date` is the practice day and `today` the local day (YYYY-MM-DD);
 * `nowMin`, `startMin` and `endMin` are minutes since midnight. Before the clock is known (first
 * render) a practice today counts as Before.
 */
export function practicePhase(date: string, today: string, nowMin: number | null, startMin: number, endMin: number): Phase {
  if (date > today) return 'before';
  if (date < today) return 'after';
  if (nowMin == null) return 'before';
  if (nowMin >= endMin) return 'after';
  if (nowMin >= startMin - DURING_LEAD) return 'during';
  return 'before';
}

/** "today", "tomorrow" or "in 5 days", for "Next practice · in 5 days". */
export function whenLabel(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** The block running now: the first block before the start, -1 once it's over. */
export function currentIndex(spans: { s: number; e: number }[], nowMin: number): number {
  if (!spans.length) return -1;
  if (nowMin < spans[0].s) return 0;
  return spans.findIndex((x) => nowMin >= x.s && nowMin < x.e);
}

/** The next block after `i` that isn't water or a break, for "Up next". Falls back to the next block of any kind. */
export function upNextIndex<T extends BreakLike>(blocks: T[], i: number): number {
  if (i < 0) return -1;
  const rest = blocks.map((b, j) => ({ b, j })).slice(i + 1);
  const real = rest.find(({ b }) => !isBreak(b));
  return (real ?? rest[0])?.j ?? -1;
}

type BreakLike = { kind: string; activity?: string; title?: string };

/** Water and other short breaks, which Up next skips: a water activity, or one named like a break. */
export function isBreak(b: BreakLike): boolean {
  return b.kind === 'activity' && (b.activity === 'water' || /\b(water|break|rest)\b/i.test(b.title ?? ''));
}
