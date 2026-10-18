import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { drillIds, withStationDrills } from '@/lib/plans/schema';
import { Builder } from './builder';
import { CheckinNudge } from './check-in/nudge';
import { practiceOver } from '@/lib/plans/checkin';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const { coach, team } = await requireTeam('/plans');
  const { id } = await params;
  const { copied } = await searchParams;
  const store = await getAppStore();
  const practice = await store.getPractice(id);
  if (!practice || practice.teamId !== team.id) notFound();
  // Opening the plan clears its "changed since you last looked" dot on the Plans list.
  await store.markViewed(practice.id, coach.id).catch(() => undefined);
  const [all, drills, share] = await Promise.all([store.listPractices(team.id), store.libraryDrills(), store.activeShare(practice.id)]);
  // Drills the kids have done before this practice ("known"), for the New tag and the library drawer.
  const earlier = all.filter((p) => p.id !== practice.id && p.date < practice.date).sort((a, b) => b.date.localeCompare(a.date));
  const known = [...new Set(earlier.flatMap((p) => p.blocks.flatMap(drillIds)))];
  // For the drawer: when each drill last ran, and what ran in the last two practices ("not used lately").
  const lastRun: Record<string, string> = {};
  for (const p of earlier) for (const d of p.blocks.flatMap(drillIds)) lastRun[d] ??= p.date;
  const recent = [...new Set(earlier.slice(0, 2).flatMap((p) => p.blocks.flatMap(drillIds)))];
  const byId = new Map(drills.map((d) => [d.id, d]));
  // The practice just before this one, if it happened in the last two weeks and you haven't checked in on it.
  const prev = earlier.find((p) => practiceOver(p));
  const recentEnough = prev && (Date.parse(practice.date) - Date.parse(prev.date)) / 864e5 <= 14;
  const checkedIn = prev ? (await store.teamCheckins(team.id).catch(() => [])).some((c) => c.practiceId === prev.id && c.userId === coach.id) : true;
  const nudge = prev && recentEnough && !checkedIn ? <CheckinNudge practiceId={prev.id} day={new Date(`${prev.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' })} /> : null;
  return (
    <>
      {nudge}
      <Builder initial={{ ...practice, blocks: withStationDrills(practice.blocks, byId) }} team={team} drills={drills} known={known} lastRun={lastRun} recent={recent} copiedFrom={copied ?? null} initialShare={share} />
    </>
  );
}
