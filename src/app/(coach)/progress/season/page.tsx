import Link from 'next/link';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { progressState } from '@/lib/progress/load';
import { getProgressStore } from '@/lib/progress/store';
import { season, type SeasonGoal } from '@/lib/progress/season';
import { monthName } from '@/lib/progress/report';
import { ProgressTabs } from '../tabs';
import { teamPractices } from '@/lib/app/read';

export const dynamic = 'force-dynamic';

const FULL = 3;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' });

// Progress over the season (decision 0030, part D): every report this coach has scored, side by side.
export default async function SeasonPage() {
  const { coach, team } = await requireTeam('/progress/season');
  const state = await progressState(team, coach.id);
  if (state.kind !== 'ready')
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <h1 className="font-display text-2xl font-bold">Progress isn’t ready yet</h1>
        <Link href="/progress" className="text-sm text-rink-100">
          Back to progress
        </Link>
      </div>
    );
  const app = await getAppStore();
  const [goals, practices, drills] = await Promise.all([(await getProgressStore()).goals(team.id).catch(() => []), teamPractices(team.id).catch(() => []), app.libraryDrills().catch(() => [])]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const s = season(state.rounds, state.scores, coach.id, goals, practices, new Map(drills.map((d) => [d.id, d])), today, team.groups.filter((g) => !g.off).length || 3);
  const n = s.months.length;
  const cols = `minmax(110px,150px) repeat(${Math.max(n, 1)},minmax(44px,1fr))`;
  const link = (m: string) => (m === state.current?.month ? '/progress' : `/progress?month=${m}`);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-9">
        <header className="flex flex-col gap-3">
          <ProgressTabs active="season" />
          {n > 0 && (
            <p className="font-mono text-[13px] text-ink-200">
              {shortDate(s.months[0].opened)} – today · {s.practices} {s.practices === 1 ? 'practice' : 'practices'} · {n} progress {n === 1 ? 'report' : 'reports'}
            </p>
          )}
          <h1 className="font-display text-[32px] font-bold leading-tight">Progress over the season</h1>
          {n < FULL && (
            <p className="rounded-[10px] bg-surface-200 px-4 py-3 text-sm">
              <b className="font-semibold">Builds as you score: {n} of {FULL} months.</b> <span className="text-ink-200">Each month you score adds a column here. Lines need a few months to say much.</span>
            </p>
          )}
        </header>

        {s.goals.length > 0 && (
          <section aria-labelledby="gl" className="flex flex-col gap-4">
            <Heading id="gl" title="Goals, month by month" note="Solid: progress score · dashed: the pace to the goal" />
            <div className="grid gap-6 xl:grid-cols-2">
              {s.goals.map((g) => (
                <GoalChart key={g.goal.id} g={g} />
              ))}
            </div>
            <p className="max-w-3xl text-[13px] text-ink-200">Kids improve with any ice time, so this shows what happened alongside the plans, not proof they caused it.</p>
          </section>
        )}

        {n > 0 && (
          <section aria-labelledby="all" className="flex flex-col">
            <Heading id="all" title="Progress scores, every month" note="Select a month to open its report" />
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `${cols} 72px 72px` }}>
                <span className="border-b border-border-100 py-2 font-mono text-xs text-ink-200">Skill</span>
                {s.months.map((m) => (
                  <Link key={m.roundId} href={link(m.month)} className="grid min-h-11 place-items-center border-b border-border-100 font-mono text-xs text-rink-100 hover:underline">
                    {m.label}
                  </Link>
                ))}
                <span className="border-b border-border-100 py-2 text-center font-mono text-xs text-ink-200">Season</span>
                <span className="border-b border-border-100 py-2 text-center font-mono text-xs text-ink-200">Ice time</span>
                {s.rows.map((r) => (
                  <Row key={r.attribute}>
                    <span className="border-b border-border-100 py-2.5 text-sm font-medium">
                      {r.attribute}
                      {r.goal && <span className="ml-1.5 rounded border border-border-100 px-1.5 py-px text-[11px] font-normal text-ink-200">Goal</span>}
                    </span>
                    {r.scores.map((x, i) => (
                      <span key={i} className={`border-b border-border-100 py-2.5 text-center font-mono text-sm ${i === n - 1 ? 'font-medium' : ''}`}>
                        {x?.toFixed(1) ?? '–'}
                      </span>
                    ))}
                    <span className={`border-b border-border-100 py-2.5 text-center font-mono text-sm ${r.change == null ? 'text-ink-200' : r.change > 0 ? 'text-good-text' : r.change < 0 ? 'text-warn-text' : 'text-ink-200'}`}>
                      {r.change == null ? '–' : r.change > 0 ? `+${r.change.toFixed(1)}` : r.change.toFixed(1)}
                    </span>
                    <span className="border-b border-border-100 py-2.5 text-center font-mono text-sm text-ink-200">{r.share == null ? '–' : `${r.share}%`}</span>
                  </Row>
                ))}
              </div>
            </div>
            <p className="mt-2.5 text-xs text-ink-200">Ice time is each skill’s share of drill minutes since the first report: Main counts in full, Some at half.</p>
          </section>
        )}

        {n > 0 && (
          <section aria-labelledby="fw" className="flex flex-col gap-2">
            <Heading id="fw" title="What practices worked on" note="From the drills, by minutes, each month" />
            <div className="overflow-x-auto">
              <div className="grid min-w-[480px] text-[13px]" style={{ gridTemplateColumns: cols }}>
                <span />
                {s.months.map((m) => (
                  <span key={m.roundId} className="py-2 text-center font-mono text-xs text-ink-200">
                    {m.label}
                  </span>
                ))}
                {s.focus.map((f) => (
                  <Row key={f.attribute}>
                    <span className="border-t border-border-100 py-2">{f.attribute}</span>
                    {f.levels.map((lv, i) => (
                      <span key={i} className="flex items-center justify-center gap-1 border-t border-border-100 py-2" aria-label={lv == null ? 'no practices' : ['not trained', 'some', 'main focus'][lv]}>
                        {lv == null ? (
                          <span className="text-ink-200">–</span>
                        ) : (
                          [0, 1].map((k) => <span key={k} className={`size-[9px] rounded-[2px] border-[1.5px] ${k < lv ? 'border-ink-100 bg-ink-100' : 'border-ink-200'}`} />)
                        )}
                      </span>
                    ))}
                  </Row>
                ))}
              </div>
            </div>
            <p className="text-xs text-ink-200">Two pips: a main focus that month · one: some · empty: not trained · –: no practices.</p>
          </section>
        )}

        {s.gaps.some((g) => g.gap != null) && (
          <section aria-labelledby="ag" className="flex flex-col gap-2">
            <Heading id="ag" title="How closely the coaches agreed" note="Biggest gap between coaches, any skill" />
            <div className="overflow-x-auto">
              <div className="grid min-w-[480px]" style={{ gridTemplateColumns: cols }}>
                <span className="py-2.5 text-sm">Biggest gap</span>
                {s.gaps.map((g, i) => (
                  <span key={i} className={`py-2.5 text-center font-mono text-sm ${g.gap != null && g.gap >= 1 ? 'text-warn-text' : ''}`} title={g.on.join(', ')}>
                    {g.gap?.toFixed(1) ?? '–'}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-ink-200">
              {(() => {
                const on = [...new Set(s.gaps.flatMap((g) => (g.gap != null && g.gap >= 1 ? g.on : [])))];
                return on.length ? `A level or more apart on ${on.join(' and ').toLowerCase()} in some months. Worth talking through the levels together.` : 'Your coaches score within a level of each other. – means only one coach scored that month.';
              })()}
            </p>
          </section>
        )}
      </div>

      <aside id="reports" aria-label="Progress reports" className="flex flex-col rounded-[14px] bg-surface-200 p-6 text-sm lg:w-[320px] lg:shrink-0 lg:self-start">
        <div className="flex flex-col gap-1.5 border-b border-border-100 pb-4">
          <h2 className="text-sm font-semibold">All progress reports</h2>
          <p className="text-[13px] text-ink-200">Each one shows the scores as they were given that month.</p>
        </div>
        {s.months.length === 0 && <p className="py-4 text-[13px] text-ink-200">Reports show here once you’ve scored a month.</p>}
        {[...s.months].reverse().map((m) => {
          const i = s.months.indexOf(m);
          const note = s.notes[i];
          const warn = /behind|short/.test(note);
          const good = /reached/.test(note);
          return (
            <Link key={m.roundId} href={link(m.month)} className="flex min-h-11 justify-between gap-2 border-b border-border-100 py-3.5 hover:bg-surface-300">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{monthName(m.month)}</span>
                <span className="text-xs text-ink-200">
                  {shortDate(m.opened)} · {m.coaches} {m.coaches === 1 ? 'coach' : 'coaches'}
                </span>
              </span>
              <span className={`text-right text-[13px] ${warn ? 'text-warn-text' : good ? 'text-good-text' : 'text-ink-200'}`}>{note}</span>
            </Link>
          );
        })}
      </aside>
    </div>
  );
}

function Heading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-100 pb-2">
      <h2 id={id} className="font-display text-[22px] font-bold">
        {title}
      </h2>
      <span className="text-[13px] text-ink-200">{note}</span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** One goal: score by month on the full 1–5 scale, the pace line dashed grey, the goal level in teal. Orange only where it fell behind. */
function GoalChart({ g }: { g: SeasonGoal }) {
  const W = 380, H = 210, L = 22, R = 372;
  const y = (v: number) => 190 - (v - 1) * 45;
  const pts = g.points;
  const step = pts.length > 1 ? (R - 26 - (L + 20)) / (pts.length - 1) : 0;
  const x = (i: number) => L + 20 + i * step;
  const scored = pts.map((p, i) => ({ ...p, i })).filter((p) => p.score != null);
  const first = pts[0];
  const last = scored[scored.length - 1];
  const behind = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.status === 'behind');
  const label = `${g.goal.attribute} by month: ${scored.map((p) => `${p.label} ${p.score!.toFixed(1)}`).join(', ')}. Goal ${g.target.toFixed(1)}.${behind.length ? ` Behind the month’s target in ${behind.map(({ p }) => p.label).join(', ')}.` : ''}`;
  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] border border-border-100 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl font-bold">{g.goal.attribute}</h3>
        {g.status && <span className={`text-[13px] font-medium ${g.warn ? 'text-warn-text' : 'text-good-text'}`}>{g.status}</span>}
      </div>
      <p>
        <span className="font-mono text-2xl">
          {first ? first.score?.toFixed(1) : '–'} → {last?.score?.toFixed(1) ?? '–'}
        </span>{' '}
        <span className="text-[13px] text-ink-200">· goal {g.target.toFixed(1)} by {new Date(`${g.goal.byDate}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
        <g fontFamily="var(--font-mono)" fontSize="11" fill="var(--ink-200)">
          {[1, 2, 3, 4, 5].map((v) => (
            <text key={v} x="4" y={y(v) + 4}>
              {v}
            </text>
          ))}
        </g>
        <g stroke="var(--border-100)" strokeWidth="1">
          {[1, 2, 3, 4, 5].map((v) => (
            <line key={v} x1={L} y1={y(v)} x2={R} y2={y(v)} />
          ))}
        </g>
        <line x1={L} y1={y(g.target)} x2={R} y2={y(g.target)} stroke="var(--rink-200)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={R + 2} y={y(g.target) - 4} fontSize="11" fill="var(--rink-200)" textAnchor="end">
          goal
        </text>
        {pts.length > 1 && <polyline points={pts.map((p, i) => `${x(i)},${y(p.expected)}`).join(' ')} fill="none" stroke="var(--border-200)" strokeWidth="2" strokeDasharray="6 5" />}
        {scored.length > 1 && <polyline points={scored.map((p) => `${x(p.i)},${y(p.score!)}`).join(' ')} fill="none" stroke="var(--rink-100)" strokeWidth="3" strokeLinejoin="round" />}
        {scored.map((p) => (
          <circle key={p.month} cx={x(p.i)} cy={y(p.score!)} r="5" fill={p.status === 'behind' || p.status === 'short' ? 'var(--whistle-100)' : 'var(--rink-100)'} />
        ))}
        <g fontFamily="var(--font-mono)" fontSize="11" fill="var(--ink-200)" textAnchor="middle">
          {pts.map((p, i) => (
            <text key={p.month} x={x(i)} y="206">
              {p.label}
            </text>
          ))}
        </g>
        {behind.slice(0, 1).map(({ p, i }) => (
          <text key={p.month} x={x(i)} y={Math.min(186, y(p.score ?? 1) + 22)} fontSize="11" fill="var(--warn-text)" textAnchor="middle">
            behind {monthName(p.month)}’s target
          </text>
        ))}
      </svg>
      {g.ice.some((v) => v != null) && (
        <p className="text-[13px] text-ink-200">
          Ice time:{' '}
          {s_ice(g)}
        </p>
      )}
    </div>
  );
}

/** "68% · 52%": months with practices only, each kept whole so a phone never wraps a lone dash. */
function s_ice(g: SeasonGoal) {
  return g.ice
    .flatMap((v, i) => (v == null ? [] : [{ v, i }]))
    .map((x, n) => (
      <span key={x.i} className="whitespace-nowrap font-mono">
        {n > 0 && ' · '}
        {x.v}%
      </span>
    ));
}
