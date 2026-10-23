import { change } from '@/lib/site/summary';
import type { Usage } from '@/lib/site/usage';
import { METRIC_INFO, formatVital, rate, type MetricName, type Rating, type SpeedSummary } from '@/lib/site/vitals';

// Admin → Analytics, the two sections from decision 0025: how coaches use the app, and how fast
// it is for them. Counts only: teams, coaches and drills, never a name.

const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n * 100)}%`);
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Tile({ label, value, delta, note }: { label: string; value: string; delta?: string | null; note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-200">{label}</span>
      <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">{value}</span>
      <span className="text-[13px]">
        {delta && <span className={`font-semibold ${delta.startsWith('↑') ? 'text-good-100' : 'text-ink-100'}`}>{delta} </span>}
        <span className="text-ink-200">{note}</span>
      </span>
    </div>
  );
}

export function SectionTitle({ id, title, sub, first }: { id: string; title: string; sub: string; first?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${first ? '' : 'border-t border-border-100 pt-8'}`}>
      <h2 id={id} className="font-display text-[24px] font-bold leading-tight">
        {title}
      </h2>
      <p className="text-sm text-ink-200">{sub}</p>
    </div>
  );
}

export function InTheApp({ u, days, names, missing }: { u: Usage; days: number; names: Map<string, string>; missing: boolean }) {
  const prev = `vs previous ${days} days`;
  const rateDelta = u.checkinRate.now != null && u.checkinRate.before != null ? change(u.checkinRate.now, u.checkinRate.before, 'points') : null;
  const facts = [
    `${plural(u.teams.total, 'team')} in all, ${u.teams.new} new`,
    `${plural(u.returningTeams, 'team')} also active the ${days} days before`,
    `${plural(u.installedCoaches, 'coach', 'coaches')} opened the installed app`,
  ];
  return (
    <section aria-labelledby="app-title" className="flex scroll-mt-6 flex-col gap-8" id="app">
      <SectionTitle id="app-title" title="In the app" sub="How coaches use Firstpass: teams, coaches and drills are counted, never named." />
      {missing && (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          The usage tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261028000000_app_usage_and_speed.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-6">
        <Tile label="Active teams" value={String(u.activeTeams.now)} delta={change(u.activeTeams.now, u.activeTeams.before, 'count')} note={prev} />
        <Tile label="Active coaches" value={String(u.activeCoaches.now)} delta={change(u.activeCoaches.now, u.activeCoaches.before, 'count')} note={prev} />
        <Tile label="Plans made" value={String(u.planned.now)} delta={change(u.planned.now, u.planned.before, 'count')} note={prev} />
        <Tile label="Practices checked in" value={pct(u.checkinRate.now)} delta={rateDelta} note={u.held ? `${u.checkedIn} of ${plural(u.held, 'practice')} on the ice` : 'no practices on the ice yet'} />
      </div>
      <p className="-mt-3 text-sm text-ink-200">{facts.join(' · ')}</p>

      <CoachesChart daily={u.daily} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-14 gap-y-10">
        <Drills u={u} names={names} />
        <section aria-labelledby="actions-title" className="flex flex-col gap-3.5">
          <h3 id="actions-title" className="text-lg font-semibold">
            What else coaches did
          </h3>
          <dl className="flex flex-col text-sm">
            {[
              ['Plans shared with parents', u.actions.share],
              ['Suggestions kept', u.actions.kept],
              ['Drills starred for the team', u.actions.favorite],
              ['Drills asked for', u.actions.request],
            ].map(([label, n]) => (
              <div key={label} className="flex justify-between gap-6 border-b border-border-100 py-2.5">
                <dt>{label}</dt>
                <dd className="font-mono">{n}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </section>
  );
}

function CoachesChart({ daily }: { daily: Usage['daily'] }) {
  // Labels are HTML, not SVG text, so they stay readable when the chart shrinks on a phone.
  const W = 800, H = 110;
  const n = daily.length;
  const max = Math.max(...daily.map((d) => d.coaches), 1);
  const slot = W / Math.max(n, 1);
  const bar = Math.max(2, Math.min(18, slot * 0.6));
  const busiest = daily.reduce((b, d) => (d.coaches > b.coaches ? d : b), { day: '', coaches: 0 });
  const mid = daily[Math.floor((n - 1) / 2)];
  return (
    <section aria-labelledby="coaches-title" className="flex flex-col gap-2.5">
      <h3 id="coaches-title" className="text-lg font-semibold">
        Coaches in the app each day
      </h3>
      <div className="flex gap-2">
        <span className="font-mono text-[11px] leading-none text-ink-200">{max}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" role="img" aria-label={busiest.coaches ? `Busiest day ${shortDay(busiest.day)} with ${plural(busiest.coaches, 'coach', 'coaches')}.` : 'No coaches in the app yet.'} className="block h-[110px]">
            <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-border-100" />
            {daily.map((d, i) => (
              <rect key={d.day} x={i * slot + (slot - bar) / 2} y={H - (H - 4) * (d.coaches / max)} width={bar} height={(H - 4) * (d.coaches / max)} rx={2} className="fill-rink-100">
                <title>{`${shortDay(d.day)}: ${plural(d.coaches, 'coach', 'coaches')}`}</title>
              </rect>
            ))}
          </svg>
          {n > 0 && (
            <div className="flex justify-between text-[11px] text-ink-200">
              <span>{shortDay(daily[0].day)}</span>
              {n > 2 && <span>{shortDay(mid.day)}</span>}
              <span>{shortDay(daily[n - 1].day)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Drills({ u, names }: { u: Usage; names: Map<string, string> }) {
  const th = 'border-b border-border-100 pb-2 font-medium';
  const td = 'border-b border-border-100 py-2.5';
  return (
    <section aria-labelledby="drills-title" className="flex flex-col gap-3.5">
      <h3 id="drills-title" className="text-lg font-semibold">
        Drills on the ice
      </h3>
      {u.drills.length === 0 ? (
        <p className="text-sm text-ink-200">No practices on the ice in this period yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-ink-200">
              <th scope="col" className={th}>
                Drill
              </th>
              <th scope="col" className={`${th} text-right`}>
                Practices
              </th>
              <th scope="col" className={`${th} text-right`}>
                Big hits
              </th>
              <th scope="col" className={`${th} text-right`}>
                Flops
              </th>
            </tr>
          </thead>
          <tbody>
            {u.drills.map((d) => (
              <tr key={d.drillId}>
                <td className={td}>{names.get(d.drillId) ?? d.drillId}</td>
                <td className={`${td} text-right font-mono`}>{d.used}</td>
                <td className={`${td} text-right font-mono`}>{d.hits}</td>
                <td className={`${td} text-right font-mono ${d.flops > d.hits ? 'text-flag-100' : ''}`}>{d.flops}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const RATING: Record<Rating, { label: string; dot: string; text: string }> = {
  good: { label: 'Good', dot: 'bg-good-100', text: 'text-good-100' },
  'needs-work': { label: 'Needs work', dot: 'bg-whistle-100', text: 'text-ink-100' },
  poor: { label: 'Slow', dot: 'bg-flag-100', text: 'text-flag-100' },
};

function Rated({ metric, value }: { metric: MetricName; value: number | null }) {
  if (value == null) return <span className="text-ink-200">–</span>;
  const r = RATING[rate(metric, value)];
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-full ${r.dot}`} />
      <span className="font-mono">{formatVital(metric, value)}</span>
      <span className="sr-only">{r.label}</span>
    </span>
  );
}

export function Speed({ s, missing }: { s: SpeedSummary; missing: boolean }) {
  const main = s.overall.filter((o) => o.metric === 'LCP' || o.metric === 'INP' || o.metric === 'CLS');
  const th = 'border-b border-border-100 pb-2 font-medium';
  const td = 'border-b border-border-100 py-2.5';
  return (
    <section aria-labelledby="speed-title" className="flex scroll-mt-6 flex-col gap-8" id="speed">
      <SectionTitle id="speed-title" title="Speed" sub="Measured on real visits to the landing page and the app. Each number is the 75th percentile: three visits in four were this fast or faster." />
      {missing ? null : s.samples === 0 ? (
        <p className="text-sm text-ink-200">No speed numbers yet. They arrive as people use the site, a few minutes after each visit.</p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-6">
            {main.map((o) => {
              const r = o.rating ? RATING[o.rating] : null;
              return (
                <div key={o.metric} className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-200">
                    {METRIC_INFO[o.metric].label} <span className="font-mono text-xs">{o.metric}</span>
                  </span>
                  <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">{formatVital(o.metric, o.p75)}</span>
                  <span className="text-[13px]">
                    {r && <span className={`font-semibold ${r.text}`}>{r.label} </span>}
                    <span className="text-ink-200">{o.n ? `${pct(o.good)} of ${plural(o.n, 'visit')} good` : 'not measured yet'}</span>
                  </span>
                  <span className="text-[13px] text-ink-200">{METRIC_INFO[o.metric].what}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-14 gap-y-10">
            <section aria-labelledby="pages-title" className="flex flex-col gap-3.5">
              <h3 id="pages-title" className="text-lg font-semibold">
                By page
              </h3>
              <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-ink-200">
                    <th scope="col" className={th}>
                      Page
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Visits
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Page shows
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Taps respond
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      Stays still
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.pages.map((p) => (
                    <tr key={p.page}>
                      <td className={td}>{p.page}</td>
                      <td className={`${td} text-right font-mono`}>{p.views}</td>
                      <td className={`${td} text-right`}>
                        <Rated metric="LCP" value={p.lcp} />
                      </td>
                      <td className={`${td} text-right`}>
                        <Rated metric="INP" value={p.inp} />
                      </td>
                      <td className={`${td} text-right`}>
                        <Rated metric="CLS" value={p.cls} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section aria-labelledby="devices-title" className="flex flex-col gap-3.5">
              <h3 id="devices-title" className="text-lg font-semibold">
                Page shows, by device
              </h3>
              <dl className="flex flex-col text-sm">
                {s.devices.map((d) => (
                  <div key={d.label} className="flex justify-between gap-6 border-b border-border-100 py-2.5">
                    <dt>
                      {d.label} <span className="text-ink-200">· {plural(d.n, 'visit')}</span>
                    </dt>
                    <dd>
                      <Rated metric="LCP" value={d.lcp} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-ink-200">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-good-100" /> Good
                </span>{' '}
                ·{' '}
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-whistle-100" /> Needs work
                </span>{' '}
                ·{' '}
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-flag-100" /> Slow
                </span>
                , by Google’s Core Web Vitals lines.
              </p>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
