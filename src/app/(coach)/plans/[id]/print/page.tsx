import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { addMinutes, clock } from '@/lib/plans/schema';
import { PlanView } from '@/components/plan-view';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function Printout({ params }: { params: Promise<{ id: string }> }) {
  const { team } = await requireTeam('/plans');
  const { id } = await params;
  const store = await getAppStore();
  const p = await store.getPractice(id);
  if (!p || p.teamId !== team.id) notFound();
  const drills = new Map((await store.libraryDrills()).map((d) => [d.id, d]));
  const date = new Date(p.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/plans/${p.id}`} className="text-sm text-ink-200 hover:text-ink-100">
          ← Back to the plan
        </Link>
        <span className="ml-auto" />
        <PrintButton />
      </div>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink-100 pb-2">
        <h1 className="text-2xl font-extrabold">
          {team.name} · {date}
        </h1>
        <span className="font-mono text-sm">
          {clock(p.startTime)}–{clock(addMinutes(p.startTime, p.minutes))} · {p.ice === 'half' ? 'Half ice' : 'Full ice'}
        </span>
      </header>
      <p className="text-sm text-ink-200">Groups: {team.groups.map((g) => `${g.group} ${g.skaters}`).join(' · ')}</p>
      <PlanView blocks={p.blocks} startTime={p.startTime} groups={team.groups.map((g) => g.group)} drills={drills} mode="print" />
    </div>
  );
}
