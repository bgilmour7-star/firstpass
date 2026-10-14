import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { withStationDrills } from '@/lib/plans/schema';
import { TodayView } from './today-view';

export const dynamic = 'force-dynamic';

// Rink-side: today's practice (or the one asked for, or the next one coming up).
export default async function Today({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { team } = await requireTeam('/today');
  const { plan } = await searchParams;
  const store = await getAppStore();
  const all = await store.listPractices(team.id);
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
      </div>
    );
  const drills = await store.libraryDrills();
  return <TodayView practice={{ ...chosen, blocks: withStationDrills(chosen.blocks, new Map(drills.map((d) => [d.id, d]))) }} team={team} drills={drills} isToday={chosen.date === today} />;
}
