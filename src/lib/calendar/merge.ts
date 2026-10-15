import type { IceEvent } from './ics';

// Merging a fresh read of the calendar into what we already have. Pure, so it can be tested:
// the coach's choices (ignored, the plan made from it) survive; a moved ice time remembers where
// it was and its plan moves with it; an ice time that disappears from the calendar is cancelled.

export type Known = IceEvent & { id: string; ignored: boolean; practiceId: string | null; movedFrom: string | null };
export type Row = IceEvent & { ignored: boolean; practiceId: string | null; movedFrom: string | null };
export type PlanMove = { practiceId: string; date: string; startTime: string; minutes: number };

const label = (date: string, time: string) => {
  const d = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const [h, m] = time.split(':').map(Number);
  return `${d}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};

export function mergeIceTimes(fresh: IceEvent[], known: Known[], today: string): { rows: Row[]; moves: PlanMove[] } {
  const byUid = new Map(known.map((k) => [k.uid, k]));
  const rows: Row[] = [];
  const moves: PlanMove[] = [];
  const seen = new Set<string>();
  for (const e of fresh) {
    seen.add(e.uid);
    const prev = byUid.get(e.uid);
    const moved = !!prev && (prev.date !== e.date || prev.startTime !== e.startTime);
    rows.push({ ...e, ignored: prev?.ignored ?? false, practiceId: prev?.practiceId ?? null, movedFrom: moved ? label(prev.date, prev.startTime) : (prev?.movedFrom ?? null) });
    if (prev?.practiceId && (moved || prev.minutes !== e.minutes)) moves.push({ practiceId: prev.practiceId, date: e.date, startTime: e.startTime, minutes: e.minutes });
  }
  // Gone from the calendar: an upcoming ice time was cancelled. Past ones are left as they were.
  for (const k of known) if (!seen.has(k.uid) && k.date >= today && !k.cancelled) rows.push({ ...k, cancelled: true });
  return { rows, moves };
}
