import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { ATTRIBUTES } from '@/lib/progress/levels';
import { progressState, startingAnswers } from '@/lib/progress/load';
import { monthName } from '@/lib/progress/report';
import { Scoring } from './scoring';

export const dynamic = 'force-dynamic';

// Progress scoring (decision 0030): about two minutes, once a month, saved as you go.
export default async function ScorePage() {
  const { coach, team } = await requireTeam('/progress/score');
  const state = await progressState(team, coach.id);
  if (state.kind !== 'ready') redirect('/progress');
  if (!state.current || !state.open || !state.scoring || state.mine?.finishedAt) redirect('/progress');
  const { answers, before, first } = startingAnswers(state, coach.id);
  const prev = state.rounds[1];
  if (!state.current.skaters)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 pt-10 text-center">
        <h1 className="font-display text-2xl font-bold">Add your skaters first</h1>
        <p className="text-sm text-ink-200">Progress scoring counts kids at each level, so the team needs its group sizes.</p>
        <Link href="/team" className="mx-auto min-h-11 rounded-full bg-rink-100 px-5 py-2.5 text-sm font-medium text-surface-100">
          Go to team
        </Link>
      </div>
    );
  return (
    <Scoring
      roundId={state.current.id}
      month={monthName(state.current.month)}
      previousMonth={prev ? monthName(prev.month) : null}
      attributes={ATTRIBUTES}
      levels={state.levels.levels}
      initial={answers}
      before={before}
      done={state.mine?.done ?? []}
      noChange={state.mine?.noChange ?? []}
      seconds={state.mine?.seconds ?? 0}
      skaters={state.current.skaters}
      first={first}
    />
  );
}
