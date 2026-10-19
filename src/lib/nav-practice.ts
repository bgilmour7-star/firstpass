import { clock, type Practice } from './plans/schema';

// The first item in the left nav goes to rink-side view of the practice that's coming (decision 0016).
// Its label says which: "Today · 9:45" on practice day, otherwise "Next practice · Sat, Oct 24".
// It picks the same practice the page does: today's, else the next one ahead. The calendar icon
// shows that practice's day of the month.
export type NavPractice = { label: string; sub: string; day: number };

export function navPractice(practices: Pick<Practice, 'date' | 'startTime'>[], now = new Date()): NavPractice {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const todays = practices.filter((p) => p.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  if (todays) return { label: 'Today', sub: clock(todays.startTime), day: Number(today.slice(8)) };
  const next = practices.filter((p) => p.date > today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  if (!next) return { label: 'Next practice', sub: 'Nothing planned', day: Number(today.slice(8)) };
  const d = new Date(next.date + 'T12:00:00');
  return { label: 'Next practice', sub: d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }), day: d.getDate() };
}
