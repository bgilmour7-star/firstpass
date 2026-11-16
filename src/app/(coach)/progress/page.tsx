import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { progressState, reportFor, visible } from '@/lib/progress/load';
import { GAP_FLAG, monthName, total, type AttributeReport } from '@/lib/progress/report';

export const dynamic = 'force-dynamic';

// The team progress report (decision 0030). Each month's report is computed from the coaches who
// finished scoring it; a coach sees a month's report once they've scored it themselves.
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ month?: string; scored?: string }> }) {
  const { coach, team } = await requireTeam('/progress');
  const { month, scored } = await searchParams;
  const state = await progressState(team, coach.id);

  if (state.kind === 'none')
    return <Empty title="Progress isn’t ready for your age group yet" body={`Team progress has level descriptions for U7 so far. ${team.ageGroup} is coming.`} />;
  if (state.kind === 'missing') return <Empty title="Progress needs its database update" body="Ask Brett to run the team progress migration." />;
  if (!state.current) return <Empty title="Your first progress scoring opens after this month’s first practice" body="Once a month every coach places the team’s skaters on five levels for each skill. About two minutes. The report shows where the team is and how it’s moving." />;

  const round = state.rounds.find((r) => r.month === month) ?? state.current;
  const isCurrent = round.id === state.current.id;
  const canSee = visible(state.scores, round.id, coach.id);
  const report = canSee ? reportFor(state.rounds, state.scores, round.id) : null;
  const statusDone = isCurrent ? state.status.filter((s) => s.finished).length : 0;
  const scorers = Math.max(state.coaches.length, statusDone);
  const mineStarted = isCurrent && state.mine && !state.mine.finishedAt;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-200">{team.name}</p>
          <h1 className="font-display text-[28px] font-bold leading-tight">{monthName(round.month)} progress report</h1>
        </div>
        {state.rounds.length > 1 && (
          <nav aria-label="Pick a month" className="flex flex-wrap gap-1.5">
            {state.rounds
              .slice()
              .reverse()
              .map((r) => (
                <Link key={r.id} href={r.id === state.current!.id ? '/progress' : `/progress?month=${r.month}`} aria-current={r.id === round.id ? 'page' : undefined} className={`min-h-11 rounded-full px-4 py-2.5 text-sm ${r.id === round.id ? 'bg-ink-100 text-surface-100' : 'border border-border-100 hover:bg-surface-300'}`}>
                  {monthName(r.month).slice(0, 3)}
                </Link>
              ))}
          </nav>
        )}
      </header>

      {scored && canSee && <p className="rounded-[10px] bg-surface-200 px-4 py-3 text-sm"><b>Thanks, that’s your {monthName(round.month)} scoring in.</b> The report updates as other coaches finish theirs.</p>}

      {!canSee ? (
        <section className="flex flex-col gap-3 rounded-[14px] border border-border-100 p-5">
          <h2 className="font-display text-lg font-bold">{isCurrent && state.open ? 'Score the team to see this report' : `You didn’t score ${monthName(round.month)}`}</h2>
          <p className="text-sm text-ink-200">
            {isCurrent && state.open
              ? 'Each coach scores on their own first, so your answers are yours. About two minutes: for each skill, move skaters up a level if they’ve moved.'
              : 'Reports show to the coaches who scored that month.'}
          </p>
          {isCurrent && <p className="font-mono text-xs text-ink-200">{statusDone} of {scorers} {scorers === 1 ? 'coach' : 'coaches'} done</p>}
          {isCurrent && state.open && state.scoring && (
            <Link href="/progress/score" className="min-h-12 self-start rounded-full bg-rink-100 px-6 py-3 text-base font-semibold text-surface-100 hover:bg-rink-200">
              {mineStarted ? 'Finish scoring' : `Score ${monthName(round.month)}`}
            </Link>
          )}
          {isCurrent && state.open && !state.scoring && <p className="text-sm">Your head coach has progress scoring turned off for you on this team.</p>}
        </section>
      ) : (
        report && (
          <>
            <p className="text-sm text-ink-200">
              {report.coaches.length === 1 ? `Scored by ${report.coaches[0].userId === coach.id ? 'you' : report.coaches[0].name}` : `Scored by ${report.coaches.map((c) => (c.userId === coach.id ? 'you' : c.name)).join(', ')}`}
              {isCurrent && scorers > report.coaches.length && ` · ${scorers - report.coaches.length} still to score`}
              {` · ${round.skaters} skaters · levels 1 to 5 for U7`}
            </p>
            <ul className="flex flex-col">
              {report.attributes.map((a) => (
                <Row key={a.attribute} a={a} youId={coach.id} />
              ))}
            </ul>
            <p className="text-xs text-ink-200">Score is the team’s average level. Bars show how many skaters are at each level, averaged across coaches.</p>
          </>
        )
      )}
    </div>
  );
}

function Row({ a, youId }: { a: AttributeReport; youId: string }) {
  const n = total(a.spread);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-border-100 py-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
      <span className="font-display text-base font-bold">{a.attribute}</span>
      <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
        {n > 0 ? (
          <span className="flex h-6 overflow-hidden rounded-md" role="img" aria-label={`Skaters at levels 1 to 5: ${a.spread.join(', ')}`}>
            {a.spread.map((k, i) =>
              k > 0 ? (
                <span key={i} style={{ flexGrow: k }} className={`grid place-items-center font-mono text-[11px] ${['bg-surface-300', 'bg-rink-100/20', 'bg-rink-100/45', 'bg-rink-100/80 text-surface-100', 'bg-rink-200 text-surface-100'][i]} border-r border-surface-100 last:border-r-0`}>
                  {k}
                </span>
              ) : null,
            )}
          </span>
        ) : (
          <span className="text-sm text-ink-200">Not scored</span>
        )}
        {a.coaches.length > 1 && (
          <span className="mt-1.5 block font-mono text-xs text-ink-200">
            {a.coaches.map((c) => `${c.userId === youId ? 'You' : c.name} ${c.average?.toFixed(1) ?? '–'}`).join(' · ')}
            {a.gap != null && a.gap >= GAP_FLAG && <span className="ml-2 font-body font-medium text-warn-text">Coaches see this differently. Worth a word.</span>}
          </span>
        )}
      </span>
      <span className="flex items-baseline gap-2 justify-self-end">
        <b className="font-mono text-2xl font-medium">{a.score?.toFixed(1) ?? '–'}</b>
        {a.change != null && <span className={`font-mono text-xs ${a.change > 0 ? 'text-good-text' : a.change < 0 ? 'text-warn-text' : 'text-ink-200'}`}>{a.change > 0 ? `+${a.change.toFixed(1)}` : a.change < 0 ? a.change.toFixed(1) : 'same'}</span>}
      </span>
    </li>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 pt-10 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-sm text-ink-200">{body}</p>
    </div>
  );
}
