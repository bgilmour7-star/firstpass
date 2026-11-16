import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { drillIds, withStationDrills } from '@/lib/plans/schema';
import { TodayView } from './today-view';
import { InstallCard, OfflineNote } from '@/components/pwa';
import { ProgressNudge } from '../progress/nudge';
import { teamPractices } from '@/lib/app/read';

export const dynamic = 'force-dynamic';

// Next practice (decision 0032): today's practice, the one asked for, or the next one coming up,
// shown Before, During or After by the clock.
export default async function Today({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { coach, team } = await requireTeam('/today');
  const { plan } = await searchParams;
  const store = await getAppStore();
  const all = await teamPractices(team.id);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const chosen =
    (plan && all.find((p) => p.id === plan)) ||
    all.find((p) => p.date === today) ||
    [...all].reverse().find((p) => p.date > today) ||
    null;
  if (!chosen)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 pt-10 text-center">
        <h1 className="text-2xl font-bold">No practice planned</h1>
        <p className="text-sm text-ink-200">Plan the next one and it shows up here on the day.</p>
        <Link href="/plans" className="mx-auto min-h-11 rounded-full bg-rink-100 px-5 py-2.5 text-sm font-medium text-surface-100">
          Go to plans
        </Link>
        <div className="mt-6 text-left empty:hidden">
          <InstallCard />
        </div>
      </div>
    );
  const [drills, favorites, share] = await Promise.all([store.libraryDrills(), store.favorites(team.id), store.activeShare(chosen.id)]);
  const isToday = chosen.date === today;
  // Drills the kids have done before this practice; one they haven't is "New today".
  const known = [...new Set(all.filter((p) => p.date < chosen.date).flatMap((p) => p.blocks.flatMap(drillIds)))];
  // Only the drills this practice uses go to the browser, not the whole library (build plan 10.2).
  const practice = { ...chosen, blocks: withStationDrills(chosen.blocks, new Map(drills.map((d) => [d.id, d]))) };
  const ids = new Set(practice.blocks.flatMap(drillIds));
  const used = drills.filter((d) => ids.has(d.id));
  const knownHere = known.filter((id) => ids.has(id));
  // Install card (decision 0021): above the plan on other days; on practice day the plan comes first.
  return (
    <div className="flex flex-col gap-5">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 empty:hidden">
        <OfflineNote />
        {!isToday && <ProgressNudge team={team} userId={coach.id} />}
        {!isToday && <InstallCard />}
      </div>
      <TodayView practice={practice} team={team} drills={used} favorites={favorites} today={today} known={knownHere} share={share} />
      {isToday && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 empty:hidden">
          <ProgressNudge team={team} userId={coach.id} />
          <InstallCard />
        </div>
      )}
    </div>
  );
}
