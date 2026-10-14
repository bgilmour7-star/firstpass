import type { Metadata } from 'next';
import { getAppStore } from '@/lib/app/store';
import { addMinutes, clock, practiceFocus, todayUnits, withStationDrills } from '@/lib/plans/schema';
import { PlanView } from '@/components/plan-view';
import { Mark } from '@/components/app-header';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Practice plan', robots: { index: false, follow: false }, referrer: 'no-referrer' };

// The parent link: no sign-in, team-level only, no coach or child names.
export default async function ParentView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = /^[A-Za-z0-9_-]{32,64}$/.test(token) ? await (await getAppStore()).sharedPractice(token) : null;
  if (!shared) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
        <h1 className="text-2xl font-bold">This link has ended</h1>
        <p className="text-sm text-ink-200">Practice links stop working after 30 days or when the coach turns them off. Ask your coach for the latest one.</p>
      </main>
    );
  }
  const { team, groups, practice, drills } = shared;
  const byId = new Map(drills.map((d) => [d.id, d]));
  // Without the team's groups (an older link function), assume the usual three.
  const units = todayUnits({ groups: groups ?? [{ group: 'Sharks', skaters: 1 }, { group: 'Bears', skaters: 1 }, { group: 'Eagles', skaters: 1 }] }, practice.attendance);
  const focus = practiceFocus(practice.blocks, byId, units.length).filter((f) => f.level === 2).map((f) => f.attribute.toLowerCase());
  const date = new Date(practice.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-2 font-display text-lg font-bold">
        <Mark /> Firstpass
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-8">{team}</h1>
        <p className="text-ink-200">
          {date} · {clock(practice.startTime)}–{clock(addMinutes(practice.startTime, practice.minutes))}
        </p>
        {focus.length > 0 && <p className="text-[15px]">Today the kids work mostly on {focus.join(' and ')}.</p>}
      </div>
      <PlanView blocks={withStationDrills(practice.blocks, byId)} startTime={practice.startTime} units={units} drills={byId} mode="parent" />
      <p className="text-xs text-ink-200">Shared by your coach. This link stops working after 30 days.</p>
    </main>
  );
}
