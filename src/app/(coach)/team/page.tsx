import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { clock, drillIds, todayUnits } from '@/lib/plans/schema';
import { practiceOver } from '@/lib/plans/checkin';
import { seasonSoFar } from '@/lib/plans/team-summary';
import { todayLocal } from '@/lib/calendar/sync';
import { nextUp } from '@/lib/home/next-up';
import { practiceStrip } from '@/lib/home/strip';
import { progressState } from '@/lib/progress/load';
import { getProgressStore } from '@/lib/progress/store';
import { goalsView } from '@/lib/progress/goals-view';
import { Home, type HomeNext, type NextUpView } from './home';

export const dynamic = 'force-dynamic';

const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
const monthName = (m: string) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long' });

// Home (decision 0031, was the Team page of 0026): the one thing to do next, the next practice as its
// drills, the season so far and the coaches. Nothing to edit: Team settings are at /team/settings and
// your own emails in Account.
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { coach, team } = await requireTeam('/team');
  const { edit } = await searchParams;
  // Old links into a section's drawer (emails, bookmarks) open it in Team settings.
  if (edit) redirect(`/team/settings?edit=${encodeURIComponent(edit)}`);
  const store = await getAppStore();
  const today = todayLocal();
  const now = new Date();
  const [coaches, joinCode, practices, ice, checkins, drills, progress] = await Promise.all([
    store.coaches(team.id),
    store.joinCode(team.id),
    store.listPractices(team.id).catch(() => []),
    store.iceTimes(team.id).catch(() => []),
    store.teamCheckins(team.id).catch(() => []),
    store.libraryDrills().catch(() => []),
    progressState(team, coach.id).catch(() => null),
  ]);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const isHead = coaches.some((c) => c.userId === coach.id && c.role === 'head_coach');
  const byId = new Map(drills.map((d) => [d.id, d]));

  // Next up: one thing, or nothing.
  const ready = progress?.kind === 'ready' ? progress : null;
  const up = nextUp({
    userId: coach.id,
    now,
    practices,
    checkins,
    round: ready?.current ? { id: ready.current.id, month: ready.current.month, open: ready.open, scoring: ready.scoring, finished: Boolean(ready.mine?.finishedAt) } : null,
    ice,
  });
  const nextUpView: NextUpView | null =
    up?.kind === 'checkin'
      ? { key: `checkin:${up.practiceId}`, title: `How did ${weekday(up.date)} go?`, line: `Check in on ${weekday(up.date)}’s practice. About 20 seconds, and it shapes the next plan.`, action: 'Check in', href: `/plans/${up.practiceId}/check-in` }
      : up?.kind === 'score'
        ? { key: `score:${up.roundId}`, title: `The ${monthName(up.month)} round is open.`, line: 'Score the six skills for the team. About 5 minutes.', action: `Score ${monthName(up.month)}`, href: '/progress/score' }
        : up?.kind === 'plan'
          ? { key: `plan:${up.iceId}`, title: `${weekday(up.date)} has ice and no plan.`, line: `${dayLong(up.date)} · ${clock(up.startTime)} · ${up.minutes} min`, action: 'Make a plan', iceId: up.iceId }
          : null;

  // The next practice (decision 0031): the earliest of the first plan that isn't over and the first
  // practice ice with no plan, so ice coming before the next plan is never skipped.
  const upcoming = practices.filter((p) => p.date >= today && !practiceOver(p, now)).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const n = upcoming[0];
  const iceNext = ice
    .filter((x) => x.kind === 'practice' && !x.cancelled && !x.ignored && !x.practiceId && x.date >= today && !practiceOver(x, now))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  let next: HomeNext;
  if (iceNext && (!n || iceNext.date + iceNext.startTime < n.date + n.startTime)) {
    next = { kind: 'ice', iceId: iceNext.id, date: iceNext.date, startTime: iceNext.startTime, line: `${iceNext.minutes} min · No plan yet` };
  } else if (n) {
    // Drills the kids have done before this practice; a drill they haven't is "New today".
    const known = new Set(practices.filter((p) => p.date < n.date).flatMap((p) => p.blocks.flatMap(drillIds)));
    // Goals that are behind (decision 0030): a drill whose Main focus serves one is marked.
    const goals = ready ? await (await getProgressStore()).goals(team.id).catch(() => []) : [];
    const behind = ready && goals.length ? new Set(goalsView(goals, ready.rounds, ready.scores, coach.id, practices, byId, today).goals.filter((g) => g.status === 'behind').map((g) => g.goal.attribute as string)) : new Set<string>();
    // Times and rotation minutes as the plan page counts them: the groups there that day.
    const strip = practiceStrip(n, byId, todayUnits(team, n.attendance).length, known, behind);
    const fresh = strip.filter((s) => s.isNew).length;
    next = { kind: 'plan', id: n.id, date: n.date, startTime: n.startTime, line: [n.ice === 'half' ? 'Half ice' : 'Full ice', `${n.minutes} min`, `${strip.length} drill${strip.length === 1 ? '' : 's'}${fresh ? `, ${fresh} new` : ''}`].join(' · '), strip };
  } else {
    next = { kind: 'none' };
  }
  // The same ice as Next up's "make a plan": the Next practice row already says it.
  const nextUpShown = up?.kind === 'plan' && next.kind === 'ice' && next.iceId === up.iceId ? null : nextUpView;

  const run = practices.filter((p) => p.date < today).length;
  const byCoach = Object.fromEntries(coaches.map((c) => [c.userId, checkins.filter((x) => x.userId === c.userId).length]));

  return (
    <Home
      team={team}
      me={coach.id}
      isHead={isHead}
      coaches={coaches.map((c) => ({ ...c, checkins: byCoach[c.userId] ?? 0 }))}
      practicesRun={run}
      joinCode={joinCode}
      origin={origin}
      nextUp={nextUpShown}
      next={next}
      season={seasonSoFar(practices, checkins, today)}
    />
  );
}

function dayLong(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}
