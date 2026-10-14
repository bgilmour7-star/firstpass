import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { clock, drillIds, newDrillIds, todayUnits, totalMinutes } from '@/lib/plans/schema';
import { createPractice } from './actions';

export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const STATUS = { draft: 'Draft', ready: 'Ready', done: 'Done' } as const;

export default async function Plans({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { team } = await requireTeam('/plans');
  const { error } = await searchParams;
  const store = await getAppStore();
  const [plans, drills] = await Promise.all([store.listPractices(team.id), store.libraryDrills()]);
  const names = new Map(drills.map((d) => [d.id, d.funName]));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const upcoming = plans.filter((p) => p.date >= today).reverse();
  const past = plans.filter((p) => p.date < today);
  const lastTime = plans[0]?.startTime ?? '17:45';

  const row = (p: (typeof plans)[number]) => {
    const fresh = newDrillIds(p, plans);
    const ids = [...new Set(p.blocks.flatMap(drillIds))];
    const over = totalMinutes(p.blocks, todayUnits(team, p.attendance).length) - p.minutes;
    return (
      <li key={p.id}>
        <Link href={`/plans/${p.id}`} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border-100 p-3 hover:border-ink-200">
          <span className="flex flex-col">
            <b className="font-display">{day(p.date)}</b>
            <span className="font-mono text-xs text-ink-200">{clock(p.startTime)} · {p.minutes} min</span>
          </span>
          <span className="min-w-0 truncate text-sm text-ink-200">
            {ids.length ? ids.map((i) => names.get(i) ?? 'Drill not live').join(' · ') : 'No drills yet'}
          </span>
          <span className="flex items-center gap-2">
            {fresh.size > 0 && <span className="rounded-full border border-whistle-100 px-2 py-0.5 text-xs font-semibold text-whistle-100">{fresh.size} new</span>}
            {over > 0 && <span className="text-xs font-semibold text-flag-100">{over} min over</span>}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${p.status === 'ready' ? 'border-rink-100 text-rink-100' : p.status === 'done' ? 'border-border-100 text-ink-200' : 'border-dashed border-border-100 text-ink-200'}`}>
              {STATUS[p.status]}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-sm text-ink-200">{plans.length ? 'A new plan starts as a copy of the one before it.' : 'Your first plan starts from a simple template.'}</p>
        </div>
        <form action={createPractice} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-200">Date</span>
            <input type="date" name="date" required defaultValue={today} className="rounded-md border border-border-100 bg-surface-100 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-200">Start</span>
            <input type="time" name="time" required defaultValue={lastTime} step={300} className="rounded-md border border-border-100 bg-surface-100 px-3 py-2" />
          </label>
          <button type="submit" className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
            Plan a practice
          </button>
        </form>
      </div>
      {error && <p className="text-sm text-flag-100">Pick a date and a start time.</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-extrabold">Coming up</h2>
        {upcoming.length ? <ul className="grid gap-2">{upcoming.map(row)}</ul> : <p className="text-sm text-ink-200">Nothing planned yet.</p>}
      </section>
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">Earlier</h2>
          <ul className="grid gap-2">{past.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
