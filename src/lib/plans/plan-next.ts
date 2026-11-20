import 'server-only';
import type { AppStore } from '../app/store';
import type { Practice, Team } from './schema';
import { startPlan } from './start-plan';
import { dueDayBefore, nextToPlan, type NextTarget } from './next-plan-rule';
import { TEAM_TIME_ZONE } from '../calendar/ics';

// Every practice arrives planned (decision 0046). The next practice is planned by the same copy-and-suggest as
// "Plan it": right after a check-in when the team lets Firstpass update the plan, or the day before an ice time
// whenever anyone on the team opens the app. Runs in the coach's own session, never with the service key.

const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

export function nowLocal(at = new Date()) {
  return {
    date: at.toLocaleDateString('en-CA', { timeZone: TEAM_TIME_ZONE }),
    time: at.toLocaleTimeString('en-GB', { timeZone: TEAM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** What would be planned next, if anything. */
export async function nextTarget(store: AppStore, team: Team, today = nowLocal().date): Promise<NextTarget | null> {
  const [plans, ice] = await Promise.all([store.listPractices(team.id), store.iceTimes(team.id).catch(() => [])]);
  return nextToPlan(plans, ice, today);
}

/** Plan the next practice now. Returns the new plan, or null when one is already planned. */
export async function planNext(store: AppStore, team: Team, coach: { id: string; name: string }, target?: NextTarget | null): Promise<Practice | null> {
  const t = target === undefined ? await nextTarget(store, team) : target;
  if (!t) return null;
  const { p, last } = await startPlan(store, team, coach.id, { date: t.date, startTime: t.startTime, minutes: t.minutes, ice: t.shared ? 'half' : undefined });
  if (t.iceId) await store.setIceTime(t.iceId, { practiceId: p.id });
  try {
    const summary = last ? `Firstpass planned it from ${shortDay(last.date)}’s practice` : 'Firstpass planned it';
    await store.addEdit({ practiceId: p.id, teamId: p.teamId, userId: coach.id, editor: coach.name, summary, base: null });
  } catch (e) {
    console.error('[plans] edit log:', e);
  }
  return p;
}

/** The day-before rule, for pages anyone on the team opens. Never throws: a page must still load. */
export async function planIfDue(store: AppStore, team: Team, coach: { id: string; name: string }): Promise<void> {
  try {
    const now = nowLocal();
    const t = await nextTarget(store, team, now.date);
    if (dueDayBefore(t, now)) await planNext(store, team, coach, t);
  } catch (e) {
    console.error('[plans] day-before plan:', e);
  }
}
