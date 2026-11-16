import Link from 'next/link';
import { monthName } from '@/lib/progress/report';
import { minSec, type Of, type ProgressUsage } from '@/lib/progress/usage';
import { SectionTitle } from './app-sections';

// Admin → Analytics → Progress scoring (decision 0030, part E): is the monthly report sticking?
// Counts and team names only. Coaches are never named here.

const of = (x: Of) => `${x.n} of ${x.of}`;
const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n * 100)}%`);
const ago = (iso: string | null, now: number) => {
  if (!iso) return 'Never';
  const d = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-200">{label}</span>
      <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">{value}</span>
      <span className="text-[13px] text-ink-200">{note}</span>
    </div>
  );
}

export function ProgressScoring({ u, months, days, missing, now }: { u: ProgressUsage | null; months: string[]; days: number; missing: boolean; now: number }) {
  return (
    <section aria-labelledby="progress-title" id="progress" className="flex scroll-mt-6 flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border-100 pt-8">
        <SectionTitle
          first
          id="progress-title"
          title="Progress scoring"
          sub={u ? `Is the monthly progress report sticking? ${monthName(u.month)} scoring, ${u.teams} ${u.teams === 1 ? 'team' : 'teams'} and ${u.coaches} ${u.coaches === 1 ? 'coach' : 'coaches'} who score. Counts only, no kids’ data.` : 'Is the monthly progress report sticking? Counts only, no kids’ data.'}
        />
        {months.length > 1 && (
          <nav aria-label="Month" className="flex flex-wrap gap-1.5">
            {months.slice(0, 6).map((m) => (
              <Link
                key={m}
                href={`/admin/analytics?days=${days}&pmonth=${m}#progress`}
                aria-current={m === u?.month ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm ${m === u?.month ? 'bg-ink-100 text-surface-100' : 'border border-border-100 hover:bg-surface-300'}`}
              >
                {monthName(m).slice(0, 3)}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {missing && (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          Progress scoring analytics need their database update. Run <code className="font-mono">supabase/migrations/20261119000000_progress_usage.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}
      {!missing && !u && <p className="text-sm text-ink-200">No team has scored a month yet. The first rounds open after each team’s first practice of the month.</p>}
      {u && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-6">
            <Tile label="Coaches who scored again" value={u.again.of ? of(u.again) : '–'} note={u.again.of ? `scored in ${monthName(prevOf(u.month))} and ${monthName(u.month)}` : `nobody scored ${monthName(prevOf(u.month))} to compare with`} />
            <Tile label="Goal suggestions taken" value={u.taken.of ? of(u.taken) : '–'} note="of those a coach acted on: swapped in or kept as is" />
            <Tile label="Teams still planning" value={u.stillPlanning.scoring.of ? of(u.stillPlanning.scoring) : '–'} note={`scoring teams with a plan in the last 14 days; others ${of(u.stillPlanning.others)}. A fair comparison needs about 10 teams each.`} />
            <Tile label="Coaches who scored" value={of(u.scored)} note={`head coaches ${of(u.scored.head)} · assistants ${of(u.scored.assistants)}`} />
          </div>
          <div className="border-t border-border-100" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-6">
            <Tile label="Time to score" value={minSec(u.medianSeconds)} note="median, all six skills" />
            <Tile label="“No change” taps" value={pct(u.noChange)} note="of skills. High is fine: it’s meant to be quick." />
            <Tile label="Teams with a goal" value={u.withGoal.of ? of(u.withGoal) : '–'} note={`${u.withGoal.goals} ${u.withGoal.goals === 1 ? 'goal' : 'goals'} · ${u.withGoal.behind} behind this month’s target`} />
            <Tile label="Biggest gap between coaches" value={u.medianGap == null ? '–' : u.medianGap.toFixed(1)} note="median per team. Lower means the level descriptions work." />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">From the scoring email to the report</h3>
            <ol className="grid grid-cols-2 gap-0.5 text-[13px] sm:grid-cols-4">
              {(
                [
                  [u.funnel.emailed, 'Emailed', 'bg-rink-200 text-surface-100'],
                  [u.funnel.started, 'Started scoring', 'bg-rink-100 text-surface-100'],
                  [u.funnel.finished, 'Finished', 'bg-rink-100/40'],
                  [u.funnel.viewed, 'Opened the report', 'bg-surface-300'],
                ] as const
              ).map(([n, label, tone], i) => (
                <li key={label} className={`flex flex-col rounded-lg px-3.5 py-3 sm:rounded-none ${tone} ${i === 0 ? 'sm:rounded-l-lg' : ''} ${i === 3 ? 'sm:rounded-r-lg' : ''}`}>
                  <span className="font-display text-[22px] font-bold leading-7">{n}</span>
                  {label}
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-ink-200">
              {u.funnel.finishedWithoutEmail > 0 ? `${u.funnel.finishedWithoutEmail} of the ${u.funnel.finished} finished before or without the email (from the check-in or Today). ` : ''}Email opens aren’t counted here: Resend has them.
            </p>
          </div>

          <div className="flex flex-col">
            <h3 className="mb-2 text-lg font-semibold">By team</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-ink-200">
                  <tr className="border-b border-border-100">
                    <th className="py-2 pr-2 font-normal">Team</th>
                    <th className="py-2 pr-2 font-normal">Scored · {monthName(u.month).slice(0, 3)}</th>
                    <th className="py-2 pr-2 font-normal">Scored again</th>
                    <th className="py-2 pr-2 font-normal">Goals</th>
                    <th className="py-2 pr-2 font-normal">Suggestions taken</th>
                    <th className="py-2 font-normal">Last plan</th>
                  </tr>
                </thead>
                <tbody>
                  {u.byTeam.map((t) => {
                    const old = !t.lastPlanAt || now - Date.parse(t.lastPlanAt) > 10 * 86_400_000;
                    return (
                      <tr key={t.id} className="border-b border-border-100">
                        <td className="py-2.5 pr-2">{t.name}</td>
                        <td className="py-2.5 pr-2 font-mono">{of(t.scored)}</td>
                        <td className="py-2.5 pr-2 font-mono">{t.again.of ? of(t.again) : '–'}</td>
                        <td className={`py-2.5 pr-2 ${t.goals ? '' : 'text-ink-200'}`}>{t.goals ? `${t.goals} · ${t.behind ? `${t.behind} behind` : 'on pace'}` : 'None yet'}</td>
                        <td className="py-2.5 pr-2 font-mono">{t.taken.of ? of(t.taken) : '–'}</td>
                        <td className={`py-2.5 ${old ? 'text-warn-text' : ''}`}>{ago(t.lastPlanAt, now)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-[13px] text-ink-200">Coach names stay on each team’s own page in Coaches. Nothing here is shared with associations.</p>
          </div>
        </>
      )}
    </section>
  );
}

function prevOf(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12-01` : `${y}-${String(mo - 1).padStart(2, '0')}-01`;
}
