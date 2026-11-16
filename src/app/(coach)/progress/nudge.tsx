import Link from 'next/link';
import type { Team } from '@/lib/plans/schema';
import { progressState } from '@/lib/progress/load';
import { monthName } from '@/lib/progress/report';

// The in-app nudge for progress scoring (decision 0030): on Today and after a check-in, while this
// month's round is open and this coach hasn't finished. Nothing otherwise.
export async function ProgressNudge({ team, userId, after = false }: { team: Team; userId: string; after?: boolean }) {
  const s = await progressState(team, userId).catch(() => null);
  if (!s || s.kind !== 'ready' || !s.current || !s.open || !s.scoring || s.mine?.finishedAt) return null;
  const month = monthName(s.current.month);
  const done = s.status.filter((x) => x.finished).length;
  const of = Math.max(s.coaches.length, done);
  const started = Boolean(s.mine);
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-border-100 bg-surface-200 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-[15px]">{after ? `While it’s fresh: ${month} progress scoring` : `${month} progress scoring is open`}</b>
        <span className="text-[13px] text-ink-200">
          {started ? `You’re ${s.mine!.done.length} of 6 in.` : 'About two minutes.'} {done} of {of} {of === 1 ? 'coach' : 'coaches'} done.
        </span>
      </span>
      <Link href="/progress/score" className="grid min-h-11 place-items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
        {started ? 'Finish scoring' : 'Score now'}
      </Link>
    </section>
  );
}
