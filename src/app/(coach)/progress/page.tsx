import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { progressState, reportFor, visible } from '@/lib/progress/load';
import { RemindButton } from './remind';
import { getAppStore } from '@/lib/app/store';
import { getProgressStore } from '@/lib/progress/store';
import { goalsView, type GoalView } from '@/lib/progress/goals-view';
import { nextMonth, STATUS_WORDS } from '@/lib/progress/pace';
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
  // Season goals (decision 0030, part C): on the latest report, with pace and ice time.
  const app = await getAppStore();
  const [goals, practices, drills] = await Promise.all([(await getProgressStore()).goals(team.id).catch(() => []), app.listPractices(team.id).catch(() => []), app.libraryDrills().catch(() => [])]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const gv = goals.length ? goalsView(goals, state.rounds, state.scores, coach.id, practices, new Map(drills.map((d) => [d.id, d])), today) : null;
  const nextPlan = [...practices].filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const showGoals = canSee && isCurrent && (gv || state.isHead);
  const statusDone = isCurrent ? state.status.filter((s) => s.finished).length : 0;
  const scorers = Math.max(state.coaches.length, statusDone);
  const mineStarted = isCurrent && state.mine && !state.mine.finishedAt;
  // Head coach: a reminder for coaches who haven't finished this month (part B emails).
  const waiting = isCurrent && state.open ? state.coaches.filter((c) => c.userId !== coach.id && !state.status.some((x) => x.userId === c.userId && x.finished)).length : 0;
  const remind = state.isHead && waiting > 0 && !coach.local ? <RemindButton roundId={round.id} waiting={waiting} sent={Boolean(round.remindAt)} /> : null;

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
          {remind}
        </section>
      ) : (
        report && (
          <>
            <p className="text-sm text-ink-200">
              {report.coaches.length === 1 ? `Scored by ${report.coaches[0].userId === coach.id ? 'you' : report.coaches[0].name}` : `Scored by ${report.coaches.map((c) => (c.userId === coach.id ? 'you' : c.name)).join(', ')}`}
              {isCurrent && scorers > report.coaches.length && ` · ${scorers - report.coaches.length} still to score`}
              {` · ${round.skaters} skaters · levels 1 to 5 for U7`}
            </p>
            {remind}
            {showGoals && (
              <section id="goals" className="flex scroll-mt-20 flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">Season goals</h2>
                  {state.isHead && (
                    <Link href="/progress/goals" className="min-h-11 content-center text-sm text-rink-100">
                      {gv ? 'Change goals' : 'Set goals'}
                    </Link>
                  )}
                </div>
                {gv ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {gv.goals.map((g) => (
                      <GoalCard key={g.goal.id} g={g} nextPlan={nextPlan ? { id: nextPlan.id, day: new Date(`${nextPlan.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' }) } : null} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-200">Pick up to three skills to work on this season. Plans lean toward the ones that fall behind.</p>
                )}
              </section>
            )}
            <h2 className={showGoals ? 'font-display text-lg font-bold' : 'sr-only'}>All six</h2>
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

const short = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

function GoalCard({ g, nextPlan }: { g: GoalView; nextPlan: { id: string; day: string } | null }) {
  const tone = g.status === 'behind' || g.status === 'short' ? 'text-warn-text' : g.status ? 'text-good-text' : 'text-ink-200';
  return (
    <li className="flex flex-col gap-1.5 rounded-[12px] border border-border-100 p-4">
      <span className="flex items-baseline justify-between gap-2">
        <b className="font-display text-base font-bold">{g.goal.attribute}</b>
        <span className={`text-[13px] font-medium ${tone}`}>{g.status ? STATUS_WORDS[g.status] : 'Not scored yet'}</span>
      </span>
      <span className="font-mono text-sm">
        <span className="text-ink-200">{monthName(g.baselineMonth).slice(0, 3)} {g.from.score.toFixed(1)}</span>
        {g.now != null && g.latestMonth && g.latestMonth !== g.baselineMonth && <> → {monthName(g.latestMonth).slice(0, 3)} {g.now.toFixed(1)}</>}
        <span className="text-rink-100"> → goal {g.target.toFixed(1)}</span>
        <span className="text-ink-200"> by {short(g.goal.byDate)}</span>
      </span>
      {g.next != null && g.next > 0 && g.latestMonth && (
        <span className="text-[13px] text-ink-200">
          {monthName(nextMonth(g.latestMonth))}: about {g.next} more {g.next === 1 ? 'kid' : 'kids'} up a level.
        </span>
      )}
      {g.share != null && (
        <span className="text-[13px] text-ink-200">
          Ice time since it was set <span className="font-mono">{Math.round(g.share * 100)}%</span> · goal asks about <span className="font-mono">{Math.round(g.targetShare * 100)}%</span>
        </span>
      )}
      {g.status === 'behind' && nextPlan && (
        <Link href={`/plans/${nextPlan.id}`} className="mt-1 min-h-11 w-fit content-center text-sm font-medium text-rink-100">
          See {nextPlan.day}’s plan
        </Link>
      )}
    </li>
  );
}
