import { headers } from 'next/headers';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { drillIds } from '@/lib/plans/schema';
import { seasonSoFar, weeklySlots } from '@/lib/plans/team-summary';
import { todayLocal } from '@/lib/calendar/sync';
import { TeamSummary, type NextPractice } from './summary';

export const dynamic = 'force-dynamic';

// The Team page (decision 0026, Main and T2-Phone on the canvas): the coach's home. Read-only, one
// section edited at a time in a drawer. Leave or delete the team at the bottom.
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { coach, team } = await requireTeam('/team');
  const { edit } = await searchParams;
  const store = await getAppStore();
  const today = todayLocal();
  const [cal, emails, coaches, joinCode, practices, ice, checkins, drills] = await Promise.all([
    store.calendar(team.id),
    store.checkinEmails(team.id, coach.id),
    store.coaches(team.id),
    store.joinCode(team.id),
    store.listPractices(team.id).catch(() => []),
    store.iceTimes(team.id).catch(() => []),
    store.teamCheckins(team.id).catch(() => []),
    store.libraryDrills().catch(() => []),
  ]);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const isHead = coaches.some((c) => c.userId === coach.id && c.role === 'head_coach');

  // The next practice: the first plan from today on, with one of its drills drawn small.
  const upcoming = practices.filter((p) => p.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const n = upcoming[0];
  const byId = new Map(drills.map((d) => [d.id, d]));
  const drawn = n?.blocks.flatMap(drillIds).map((id) => byId.get(id)).find((d) => d?.groupModel === 'rotation' || d?.groupModel === 'stations') ?? n?.blocks.flatMap(drillIds).map((id) => byId.get(id)).find(Boolean);
  const rink = n ? ice.find((x) => x.practiceId === n.id)?.rink : undefined;
  const next: NextPractice | null = n
    ? { id: n.id, date: n.date, startTime: n.startTime, minutes: n.minutes, ice: n.ice, rink: rink ?? null, drills: new Set(n.blocks.flatMap(drillIds)).size, diagram: drawn ? { spec: drawn.diagram, name: drawn.funName } : null }
    : null;
  // Checked-in counts per coach, out of the practices that have happened.
  const run = practices.filter((p) => p.date < today).length;
  const byCoach = Object.fromEntries(coaches.map((c) => [c.userId, checkins.filter((x) => x.userId === c.userId).length]));

  return (
    <TeamSummary
      team={team}
      me={coach.id}
      local={coach.local}
      email={coach.email}
      isHead={isHead}
      coaches={coaches.map((c) => ({ ...c, checkins: byCoach[c.userId] ?? 0 }))}
      practicesRun={run}
      joinCode={joinCode}
      origin={origin}
      calendar={cal ? { url: cal.url, syncedAt: cal.syncedAt } : null}
      slots={weeklySlots(ice, today)}
      icePractices={ice.filter((x) => x.kind === 'practice' && !x.cancelled && x.date >= today).length}
      emails={emails}
      next={next}
      season={seasonSoFar(practices, checkins, today)}
      initialEdit={edit ?? null}
    />
  );
}
