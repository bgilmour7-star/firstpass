import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { clock, drillIds, newDrillIds, todayUnits, totalMinutes } from '@/lib/plans/schema';
import { syncCalendar } from '@/lib/calendar/sync';
import { activityLine, initials } from '@/lib/plans/activity';
import { practiceOver } from '@/lib/plans/checkin';
import type { IceTime } from '@/lib/app/store';
import { ignoreIceTime, planIceTime } from './actions';
import { AddPractice } from './add-practice';
import { DATE_WHY, nextPracticeDate } from '@/lib/plans/next-date';

export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const STATUS = { draft: 'Draft', ready: 'Ready', done: 'Done' } as const;

export default async function Plans({ searchParams }: { searchParams: Promise<{ hidden?: string; all?: string }> }) {
  const { coach, team } = await requireTeam('/plans');
  const { hidden, all } = await searchParams;
  const limit = all ? 200 : 10;
  const store = await getAppStore();
  // Read the team's calendar first (at most once an hour), so moved ice times move their plans.
  const sync = await syncCalendar(store, team.id).catch(() => ({ status: 'error' as const, error: 'Couldn’t read your calendar just now.' }));
  const [plans, drills, ice, activity] = await Promise.all([store.listPractices(team.id), store.libraryDrills(), store.iceTimes(team.id), store.teamActivity(team.id, coach.id).catch(() => ({}) as Awaited<ReturnType<typeof store.teamActivity>>)]);
  const [checkins, coachCount] = await Promise.all([store.teamCheckins(team.id).catch(() => []), store.coachCount(team.id).catch(() => 1)]);
  const names = new Map(drills.map((d) => [d.id, d.funName]));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const upcoming = plans.filter((p) => p.date >= today).reverse();
  const past = plans.filter((p) => p.date < today);
  const planIds = new Set(plans.map((p) => p.id));
  // The Add a practice box is prefilled with a guess; ice times from the calendar have their own Plan it.
  const guess = nextPracticeDate(plans, [], today) as { date: string; startTime: string; why: 'week' | 'sat' };
  const iceFor = new Map(ice.filter((x) => x.practiceId).map((x) => [x.practiceId!, x]));
  // Ice times still to plan: practices, then games and the rest further down; hidden ones on request.
  const toPlan = ice.filter((x) => x.date >= today && !x.cancelled && !(x.practiceId && planIds.has(x.practiceId)) && x.kind !== 'other');
  const shown = toPlan.filter((x) => (hidden ? x.ignored : !x.ignored));
  const hiddenCount = toPlan.filter((x) => x.ignored).length;
  type Coming = { kind: 'plan'; at: string; p: (typeof plans)[number] } | { kind: 'ice'; at: string; x: IceTime };
  const coming: Coming[] = (
    hidden
      ? shown.map((x): Coming => ({ kind: 'ice', at: `${x.date} ${x.startTime}`, x }))
      : [...upcoming.map((p): Coming => ({ kind: 'plan', at: `${p.date} ${p.startTime}`, p })), ...shown.map((x): Coming => ({ kind: 'ice', at: `${x.date} ${x.startTime}`, x }))]
  ).sort((a, b) => a.at.localeCompare(b.at));

  const row = (p: (typeof plans)[number]) => {
    const fresh = newDrillIds(p, plans);
    const ids = [...new Set(p.blocks.flatMap(drillIds))];
    const overrun = totalMinutes(p.blocks, todayUnits(team, p.attendance).length) - p.minutes;
    const it = iceFor.get(p.id);
    const empty = p.blocks.filter((b) => b.kind !== 'activity' && !b.drillId).length;
    const act = activityLine(activity[p.id], coach.id);
    // After the ice time: invite a check-in until you've done yours, then show how many coaches have.
    const over = practiceOver(p);
    const here = checkins.filter((c) => c.practiceId === p.id);
    // Only recent practices ask: a check-in from weeks ago is guesswork.
    const needsMine = over && (Date.parse(today) - Date.parse(p.date)) / 864e5 <= 14 && !here.some((c) => c.userId === coach.id);
    return (
      <li key={p.id}>
        <Link href={needsMine ? `/plans/${p.id}/check-in` : `/plans/${p.id}`} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border-100 p-3 hover:border-ink-200">
          <span className="flex flex-col">
            <b className="font-display">{day(p.date)}</b>
            <span className="whitespace-nowrap font-mono text-xs text-ink-200">{clock(p.startTime)} · {p.minutes} min</span>
          </span>
          <span className="min-w-0 truncate text-sm text-ink-200">
            {ids.length ? ids.map((i) => names.get(i) ?? 'Drill not live').join(' · ') : 'No drills yet'}
            {empty > 0 && <b className="font-semibold text-ink-100"> · {empty} empty block{empty === 1 ? '' : 's'}</b>}
          </span>
          <span className="flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-2">
            {fresh.size > 0 && <span className="rounded-full border border-whistle-100 px-2 py-0.5 text-xs font-semibold text-whistle-100">{fresh.size} new</span>}
            {it?.cancelled && p.date >= today && <span className="text-xs font-semibold text-flag-100">Cancelled in the calendar</span>}
            {it?.movedFrom && !it.cancelled && <span className="text-xs font-semibold text-whistle-100">Moved from {it.movedFrom}</span>}
            {overrun > 0 && !over && <span className="text-xs font-semibold text-flag-100">{overrun} min over</span>}
            {needsMine && <span className="rounded-full bg-rink-100 px-2.5 py-0.5 text-xs font-semibold text-surface-100">Check in</span>}
            {over && !needsMine && here.length > 0 && (
              <span className="text-xs text-ink-200">
                Checked in {here.length} of {Math.max(coachCount, here.length)}
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${p.status === 'ready' ? 'border-rink-100 text-rink-100' : p.status === 'done' ? 'border-border-100 text-ink-200' : 'border-dashed border-border-100 text-ink-200'}`}>
              {STATUS[p.status]}
            </span>
          </span>
          {act && (
            <span className="flex items-center gap-2 text-xs text-ink-200">
              {act.unseen && <span className="h-2 w-2 flex-none rounded-full bg-whistle-100" title="Changed since you last looked" />}
              <span className={`text-right ${act.unseen ? 'text-ink-100' : ''}`}>
                {act.unseen && <span className="sr-only">Changed since you last looked: </span>}
                {act.text}
              </span>
              <span className="flex" aria-label={`Worked on by ${act.editors.map((e) => (e.you ? 'you' : e.label)).join(', ')}`}>
                {act.editors.map((e, i) => (
                  <span
                    key={e.label + i}
                    title={e.you ? 'You' : e.label}
                    className={`grid h-6 w-6 place-items-center rounded-full border-2 border-surface-100 text-[11px] font-semibold ${i ? '-ml-1.5' : ''} ${e.you ? 'bg-ink-100 text-surface-100' : 'bg-surface-300 text-ink-100'}`}
                  >
                    {initials(e.label)}
                  </span>
                ))}
              </span>
            </span>
          )}
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
        <AddPractice date={guess.date} startTime={guess.startTime} hint={`${DATE_WHY[guess.why].charAt(0).toUpperCase()}${DATE_WHY[guess.why].slice(1)}.`} copies={plans.length > 0} />
      </div>

      {sync.status === 'error' && (
        <p className="text-sm text-flag-100">
          {sync.error}{' '}
          <Link href="/team" className="underline">
            Check the calendar link
          </Link>
        </p>
      )}
      {sync.status === 'none' && !ice.length && (
        <p className="rounded-md bg-surface-200 px-4 py-3 text-sm">
          Add your team&apos;s calendar link in{' '}
          <Link href="/team" className="font-medium text-rink-100 hover:underline">
            Team
          </Link>{' '}
          and your ice times show up here, ready to plan.
        </p>
      )}

      {/* One list in date and time order: planned practices and ice times still to plan, side by side. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-extrabold">{hidden ? 'Hidden ice times' : 'Coming up'}</h2>
          {(hiddenCount > 0 || hidden) && (
            <Link href={hidden ? '/plans' : '/plans?hidden=1'} className="text-sm text-rink-100 hover:underline">
              {hidden ? 'Back' : `${hiddenCount} hidden`}
            </Link>
          )}
        </div>
        {coming.length ? (
          <ul className="grid gap-2">{coming.slice(0, limit).map((c) => (c.kind === 'plan' ? row(c.p) : <IceRow key={c.x.id} x={c.x} />))}</ul>
        ) : (
          <p className="text-sm text-ink-200">{hidden ? 'Nothing hidden.' : 'Nothing coming up. Add a practice above.'}</p>
        )}
        {coming.length > limit && (
          <Link href={hidden ? '/plans?hidden=1&all=1' : '/plans?all=1'} className="w-fit text-sm text-rink-100 hover:underline">
            Show {coming.length - limit} more this season
          </Link>
        )}
      </section>
      {!hidden && past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-extrabold">Earlier</h2>
          <ul className="grid gap-2">{past.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

function IceRow({ x }: { x: IceTime }) {
  const game = x.kind === 'game';
  return (
    <li className={`grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3 ${game ? 'border-dashed border-border-100' : 'border-border-100'}`}>
      <span className="flex flex-col">
        <b className="font-display">{day(x.date)}</b>
        <span className="whitespace-nowrap font-mono text-xs text-ink-200">
          {clock(x.startTime)} · {x.minutes} min
        </span>
      </span>
      <span className="flex min-w-0 flex-col text-sm">
        <span className="truncate">
          {game ? <b>Game</b> : x.title}
          {x.sharedWith && <span className="text-ink-200"> · {game ? x.sharedWith : `shared with ${x.sharedWith}`}</span>}
        </span>
        <span className="truncate text-xs text-ink-200">
          {x.rink}
          {x.movedFrom && <span className="font-semibold text-whistle-100"> · Moved from {x.movedFrom}</span>}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <form action={ignoreIceTime.bind(null, x.id, !x.ignored)}>
          <button type="submit" className="min-h-9 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200">
            {x.ignored ? 'Show again' : 'Not ours'}
          </button>
        </form>
        <form action={planIceTime.bind(null, x.id)}>
          <button type="submit" className={`min-h-9 rounded-full px-4 text-sm font-medium ${game ? 'border border-border-100 hover:bg-surface-200' : 'bg-rink-100 text-surface-100 hover:bg-rink-200'}`}>
            {game ? 'Plan anyway' : 'Plan it'}
          </button>
        </form>
      </span>
    </li>
  );
}
