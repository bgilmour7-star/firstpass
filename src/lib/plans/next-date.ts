// "Plan a practice" picks the date itself (decision 0017), in this order:
// 1. the next practice ice time from the team's calendar that has no plan yet (same as its "Plan it");
// 2. a week after the latest plan, at its start time (another week on while that's not in the future);
// 3. the coming Saturday at 9:30. The plan then says where its date came from, with Change.
export type DateWhy = 'ice' | 'week' | 'sat';
export type NextDate = { iceId: string } | { date: string; startTime: string; why: DateWhy };

type Ice = { id: string; date: string; startTime: string; kind: string; cancelled: boolean; ignored: boolean; practiceId: string | null };
type Plan = { id: string; date: string; startTime: string };

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function nextPracticeDate(plans: Plan[], ice: Ice[], today: string): NextDate {
  const planned = new Set(plans.map((p) => p.id));
  const free = ice
    .filter((x) => x.date >= today && x.kind === 'practice' && !x.cancelled && !x.ignored && !(x.practiceId && planned.has(x.practiceId)))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  if (free) return { iceId: free.id };
  const last = [...plans].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))[0];
  if (last) {
    let date = addDays(last.date, 7);
    while (date <= today) date = addDays(date, 7);
    return { date, startTime: last.startTime, why: 'week' };
  }
  const dow = new Date(today + 'T12:00:00Z').getUTCDay();
  return { date: addDays(today, ((6 - dow + 7) % 7) || 7), startTime: '09:30', why: 'sat' };
}

export const DATE_WHY: Record<DateWhy, string> = {
  ice: 'your next ice time',
  week: 'a week after your last one',
  sat: 'the coming Saturday',
};
