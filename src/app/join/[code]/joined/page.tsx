import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { AuthFrame } from '@/components/auth-frame';
import { Rink } from '@/components/ds';
import { editorLabel } from '@/lib/plans/activity';
import { clock, drillIds } from '@/lib/plans/schema';
import { listNames } from '@/lib/email/checkin-email';
import type { RinkDiagramProps } from '../../../../../design-system/index';

export const dynamic = 'force-dynamic';

// "You're on U7 Clippers" (decision 0013): the moment after joining, with the next practice
// one tap away.
export default async function Joined() {
  const { coach, team } = await requireTeam('/plans');
  const store = await getAppStore();
  const [coaches, practices, drills] = await Promise.all([store.coaches(team.id), store.listPractices(team.id), store.libraryDrills()]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const next = practices.filter((p) => p.date >= today && p.blocks.length).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  const others = coaches.filter((c) => c.userId !== coach.id).map((c) => c.firstName ?? editorLabel(c.email));
  const byId = new Map(drills.map((d) => [d.id, d]));
  const shown = next?.blocks.map((b) => drillIds(b)[0]).map((id) => (id ? byId.get(id) : undefined)).find((d) => d?.diagram);
  const count = next ? [...new Set(next.blocks.flatMap(drillIds))].length : 0;
  const day = next ? new Date(next.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' }) : '';

  return (
    <AuthFrame panel={false}>
      <div className="mt-8 flex flex-col gap-2.5">
        <div className="flex items-center">
          {[...others.slice(0, 3), coach.name].map((n, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-100 text-[13px] font-semibold text-surface-100 ${i > 0 ? '-ml-2' : ''} ${i === Math.min(others.length, 3) ? 'bg-rink-100' : 'bg-rink-200'}`}
            >
              {n.charAt(0).toUpperCase()}
            </span>
          ))}
          <span className="ml-2.5 text-sm text-ink-200">{others.length ? `${listNames(others)} and you` : 'You'}</span>
        </div>
        <h1 className="font-display text-[32px] font-extrabold leading-9 tracking-[-0.02em] text-balance">You&apos;re on {team.name}</h1>
        <p className="text-[15px] leading-[22px] text-ink-200">Your account is set up and signed in on this device.</p>
      </div>

      {next && (
        <section className="mt-7 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Next practice</h2>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] font-bold leading-7">
              {new Date(next.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(next.startTime)}
            </span>
            <span className="text-sm text-ink-200">
              {next.ice === 'half' ? 'Half ice' : 'Full ice'} · {next.minutes} min · {count} drill{count === 1 ? '' : 's'} · {next.status === 'draft' ? 'Draft' : next.status === 'ready' ? 'Ready' : 'Done'}
            </span>
          </div>
          {shown && (
            <figure className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-lg border border-border-100">
                <Rink spec={shown.diagram as unknown as RinkDiagramProps} title={shown.funName} />
              </div>
              <figcaption className="text-[13px] text-ink-200">
                {shown.funName}
              </figcaption>
            </figure>
          )}
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        {next ? (
          <>
            <Link href={`/plans/${next.id}`} className="inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 font-semibold text-surface-100 hover:bg-rink-200">
              Open {day}&apos;s plan
            </Link>
            <Link href="/plans" className="inline-flex h-12 items-center justify-center text-[15px] font-medium text-rink-100">
              See all plans
            </Link>
          </>
        ) : (
          <Link href="/plans" className="inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 font-semibold text-surface-100 hover:bg-rink-200">
            See plans
          </Link>
        )}
      </div>
    </AuthFrame>
  );
}
