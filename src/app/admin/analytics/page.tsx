import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { getSiteStore } from '@/lib/site/store';
import { change, summarize, vanDay, type Summary } from '@/lib/site/summary';
import type { PageEvent, WaitlistEntry } from '@/lib/site/schema';
import { StatusSelect } from './status-select';
import { InTheApp, SectionTitle, Speed } from './app-sections';
import { getAppStore } from '@/lib/app/store';
import { EMPTY_USAGE_ROWS, summarizeUsage, type UsageRows } from '@/lib/site/usage';
import { summarizeSpeed, type Vital } from '@/lib/site/vitals';

export const dynamic = 'force-dynamic';

// Admin → Analytics (decision 0019; canvas "Admin · Analytics"). The landing page's visits,
// counted without cookies, and the waitlist Brett works through. Brett only.

const PERIODS = [7, 30] as const;
const DAY = 86_400_000;
const SOURCE_LABEL: Record<string, string> = { share: 'Shared plans', 'shared-ice': 'Shared ice', invite: 'Invites', direct: 'Direct', 'google.com': 'Google' };
const TAGGED = new Set(['share', 'shared-ice', 'invite']);

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (n: number | null) => (n == null ? '–' : `${(Math.round(n * 1000) / 10).toLocaleString('en-CA')}%`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAnalytics();
  const { days: raw } = await searchParams;
  const days = PERIODS.find((p) => String(p) === raw) ?? 30;
  const store = await getSiteStore();
  let events: PageEvent[] = [];
  let waitlist: WaitlistEntry[] = [];
  let missing = false;
  try {
    [events, waitlist] = await Promise.all([store.events(new Date(Date.now() - 2 * days * DAY).toISOString()), store.waitlist()]);
  } catch (e) {
    if (e instanceof Error && e.message === 'waitlist-migration-missing') missing = true;
    else throw e;
  }
  const s = summarize(events, waitlist, { days });

  // In the app and Speed (decision 0025). Their tables come from a later migration.
  const since = new Date(Date.now() - 2 * days * DAY).toISOString();
  let rows: UsageRows = EMPTY_USAGE_ROWS;
  let vitals: Vital[] = [];
  let usageMissing = false;
  try {
    [rows, vitals] = await Promise.all([store.usage(since), store.vitals(since)]);
  } catch (e) {
    if (e instanceof Error && e.message === 'usage-migration-missing') usageMissing = true;
    else throw e;
  }
  const usage = summarizeUsage(rows, { days });
  const speed = summarizeSpeed(vitals, { days });
  const names = new Map((await (await getAppStore()).libraryDrills().catch(() => [])).map((d) => [d.id, d.funName]));

  return (
    <div className="flex flex-col gap-9 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold leading-[1.1]">Analytics</h1>
          <p className="text-sm text-ink-200">
            {shortDay(s.from)} – {shortDay(s.to)} ·{' '}
            {[
              ['#site', 'Landing page'],
              ['#app', 'In the app'],
              ['#speed', 'Speed'],
              ['#waitlist', 'Waitlist'],
            ].map(([href, label], i) => (
              <span key={href}>
                {i > 0 && ' · '}
                <a href={href} className="underline decoration-border-100 underline-offset-4 hover:text-ink-100">
                  {label}
                </a>
              </span>
            ))}
          </p>
        </div>
        <nav aria-label="Period" className="inline-flex gap-1 rounded-full bg-surface-300 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/analytics?days=${p}`}
              aria-current={p === days ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-[18px] text-sm ${p === days ? 'bg-surface-100 font-semibold shadow-[0_1px_2px_rgba(14,27,30,0.12)]' : 'text-ink-200 hover:text-ink-100'}`}
            >
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      {missing && (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          The waitlist tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261026000000_waitlist_and_analytics.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}

      <div id="site" className="-mb-3 scroll-mt-6">
        <SectionTitle id="site-title" first title="Landing page" sub="Visits to firstpass.coach and the waitlist form, counted without cookies." />
      </div>
      <Headline s={s} />
      <VisitsChart s={s} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-14 gap-y-10">
        <Funnel s={s} />
        <Sources s={s} />
      </div>

      <Who s={s} />
      <InTheApp u={usage} days={days} names={names} missing={usageMissing} />
      <Speed s={speed} missing={usageMissing} />
      <Waitlist list={waitlist} />
    </div>
  );
}

function Headline({ s }: { s: Summary }) {
  const prev = `vs previous ${s.days} days`;
  const tiles = [
    { label: 'Visits', value: s.visits.now.toLocaleString('en-CA'), delta: change(s.visits.now, s.visits.before, 'percent'), note: prev },
    { label: 'Unique visitors', value: s.uniques.now.toLocaleString('en-CA'), delta: change(s.uniques.now, s.uniques.before, 'percent'), note: 'counted per day' },
    { label: 'Waitlist sign-ups', value: String(s.signups.now), delta: change(s.signups.now, s.signups.before, 'count'), note: prev },
    {
      label: 'Visitors who joined',
      value: pct(s.conversion.now),
      delta: s.conversion.now != null && s.conversion.before != null ? change(s.conversion.now, s.conversion.before, 'points') : null,
      note: 'sign-ups ÷ unique visitors',
    },
  ];
  return (
    <section aria-label="Headline numbers" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-6 border-b border-border-100 pb-8">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-200">{t.label}</span>
          <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">{t.value}</span>
          <span className="text-[13px]">
            {t.delta && <span className={`font-semibold ${t.delta.startsWith('↑') ? 'text-good-100' : 'text-ink-100'}`}>{t.delta} </span>}
            <span className="text-ink-200">{t.note}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

function niceMax(n: number) {
  const steps = [10, 20, 40, 50, 80, 100, 200, 400, 500, 1000, 2000, 5000];
  return steps.find((x) => x >= n) ?? Math.ceil(n / 1000) * 1000;
}

function VisitsChart({ s }: { s: Summary }) {
  const W = 800, H = 200, L = 36, R = 12, T = 12, B = 28;
  const n = s.daily.length;
  const max = niceMax(Math.max(...s.daily.map((d) => d.visits), 1));
  const x = (i: number) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : (W - L - R) / 2);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = s.daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.visits).toFixed(1)}`).join(' ');
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const ticks = [...new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1])];
  const peakIdx = s.peak ? s.daily.findIndex((d) => d.day === s.peak!.day) : -1;
  const maxSign = Math.max(...s.daily.map((d) => d.signups), 1);
  const slot = (W - L - R) / Math.max(n - 1, 1);
  const describe = s.peak ? `Peak of ${s.peak.visits} on ${shortDay(s.peak.day)}.` : 'No visits yet.';

  return (
    <section aria-labelledby="visits-title" className="flex flex-col gap-2.5">
      <h2 id="visits-title" className="text-lg font-semibold">
        Visits per day
      </h2>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Visits per day, ${shortDay(s.from)} to ${shortDay(s.to)}. ${describe}`} className="block overflow-visible">
        <g stroke="var(--border-100)" strokeWidth="1">
          {grid.map((g) => (
            <path key={g} d={`M${L} ${y(g)}H${W - R}`} />
          ))}
        </g>
        <g fill="var(--ink-200)" fontFamily="var(--font-mono)" fontSize="11" textAnchor="end">
          {grid.map((g) => (
            <text key={g} x={L - 8} y={y(g) + 4}>
              {g}
            </text>
          ))}
        </g>
        <g fill="var(--ink-200)" fontSize="11">
          {ticks.map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {shortDay(s.daily[i].day)}
            </text>
          ))}
        </g>
        <path d={line} fill="none" stroke="var(--rink-100)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {peakIdx >= 0 && (
          <>
            <circle cx={x(peakIdx)} cy={y(s.peak!.visits)} r="5" fill="var(--rink-100)" stroke="var(--surface-100)" strokeWidth="2" />
            <text x={x(peakIdx) + (peakIdx > n / 2 ? -12 : 12)} y={y(s.peak!.visits) + 4} textAnchor={peakIdx > n / 2 ? 'end' : 'start'} fontSize="12" fill="var(--ink-100)">
              {shortDay(s.peak!.day)} · {s.peak!.visits} visits
            </text>
          </>
        )}
        {/* Hover targets wider than the line, one per day, with the day's numbers. */}
        {s.daily.map((d, i) => (
          <rect key={d.day} x={x(i) - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent">
            <title>{`${shortDay(d.day)}: ${d.visits} visits, ${d.signups} sign-ups`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-200">Sign-ups per day</span>
        <svg viewBox={`0 0 ${W} 50`} width="100%" role="img" aria-label={`Sign-ups per day: ${s.signups.now} in all.`} className="block overflow-visible">
          <path d={`M${L} 46H${W - R}`} stroke="var(--border-100)" strokeWidth="1" />
          {s.daily.map((d, i) =>
            d.signups ? (
              <rect key={d.day} x={x(i) - 4} y={46 - (40 * d.signups) / maxSign} width="8" height={(40 * d.signups) / maxSign} rx="2" fill="var(--ink-100)">
                <title>{`${shortDay(d.day)}: ${d.signups} sign-up${d.signups === 1 ? '' : 's'}`}</title>
              </rect>
            ) : null,
          )}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2.5 text-rink-100">Show as a table</summary>
        <table className="mt-2 w-full max-w-md border-collapse font-mono text-[13px] tabular-nums">
          <thead>
            <tr className="text-left font-body text-ink-200">
              <th className="pb-1.5 font-medium">Day</th>
              <th className="pb-1.5 text-right font-medium">Visits</th>
              <th className="pb-1.5 text-right font-medium">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {s.daily.map((d) => (
              <tr key={d.day} className="border-t border-border-100">
                <td className="py-1">{shortDay(d.day)}</td>
                <td className="py-1 text-right">{d.visits}</td>
                <td className="py-1 text-right">{d.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Funnel({ s }: { s: Summary }) {
  const top = s.funnel[0].visitors || 1;
  const [visited, reached, started, joined] = s.funnel.map((f) => f.visitors);
  const note =
    visited > 0 && reached > 0
      ? `${Math.round((1 - Math.min(started, reached) / reached) * 100)}% who reach the form don’t start it. ${started ? `${Math.round((Math.min(joined, started) / started) * 100)}% of those who start it finish.` : ''}`
      : 'Nobody has reached the form yet.';
  return (
    <section aria-labelledby="funnel-title" className="flex flex-col gap-3.5">
      <h2 id="funnel-title" className="text-lg font-semibold">
        From visit to waitlist
      </h2>
      <div className="grid grid-cols-[150px_1fr_56px] items-center gap-x-3.5 gap-y-3 text-sm">
        {s.funnel.map((f) => (
          <div key={f.label} className="contents">
            <span>{f.label}</span>
            <span className="h-3.5 rounded bg-rink-100" style={{ width: `${Math.max((f.visitors / top) * 100, f.visitors ? 1.5 : 0)}%` }} />
            <span className="text-right font-mono">{f.visitors}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-200">{note}</p>
    </section>
  );
}

function Sources({ s }: { s: Summary }) {
  const th = 'border-b border-border-100 pb-2 font-medium';
  const td = 'border-b border-border-100 py-2.5';
  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-3.5">
      <h2 id="sources-title" className="text-lg font-semibold">
        Where they came from
      </h2>
      {s.sources.length === 0 ? (
        <p className="text-sm text-ink-200">No visits in this period yet. Links you hand out carry a tag (?from=share, ?from=invite, ?from=shared-ice) so you can see which ones bring coaches in.</p>
      ) : (
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-ink-200">
              <th scope="col" className={th}>
                Source
              </th>
              <th scope="col" className={`${th} text-right`}>
                Visitors
              </th>
              <th scope="col" className={`${th} text-right`}>
                Sign-ups
              </th>
              <th scope="col" className={`${th} text-right`}>
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {s.sources.map((r) => (
              <tr key={r.source}>
                <td className={td}>
                  {SOURCE_LABEL[r.source] ?? r.source} {TAGGED.has(r.source) && <span className="font-mono text-xs text-ink-200">{r.source}</span>}
                </td>
                <td className={`${td} text-right font-mono`}>{r.visitors}</td>
                <td className={`${td} text-right font-mono`}>{r.signups}</td>
                <td className={`${td} text-right font-mono`}>{r.visitors ? pct(r.signups / r.visitors) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Who({ s }: { s: Summary }) {
  const col = (title: string, rows: { label: string; value: string }[]) => (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-[13px] text-ink-200">{title}</span>
      {rows.length === 0 ? (
        <span className="text-ink-200">None yet</span>
      ) : (
        rows.map((r) => (
          <span key={r.label} className="flex justify-between gap-3">
            <span>{r.label}</span>
            <span className="font-mono">{r.value}</span>
          </span>
        ))
      )}
    </div>
  );
  return (
    <section aria-labelledby="who-title" className="flex flex-col gap-4 border-t border-border-100 pt-8">
      <h2 id="who-title" className="text-lg font-semibold">
        Who’s signing up
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-10 gap-y-7">
        {col(
          'Kind',
          s.signups.now
            ? [
                { label: 'Coaches', value: String(s.signups.coaches) },
                { label: 'Associations', value: String(s.signups.associations) },
              ]
            : [],
        )}
        {col('Coaches by age group', s.ageGroups.map((a) => ({ label: a.label, value: String(a.count) })))}
        {col('Visitors’ devices', s.devices.map((d) => ({ label: d.label, value: pct(d.share) })))}
        {col('Visitors’ regions', s.regions.map((r) => ({ label: r.label, value: pct(r.share) })))}
      </div>
    </section>
  );
}

function Waitlist({ list }: { list: WaitlistEntry[] }) {
  const counts = (['new', 'emailed', 'call_booked', 'onboarded', 'not_a_fit'] as const).map((k) => [k, list.filter((w) => w.status === k).length] as const);
  const words = (k: string, n: number) => ({ new: 'new', emailed: 'emailed', call_booked: n === 1 ? 'call booked' : 'calls booked', onboarded: 'onboarded', not_a_fit: 'not a fit' })[k];
  const th = 'border-b border-border-100 pb-2 pr-3 font-medium';
  const td = 'border-b border-border-100 py-2.5 pr-3';
  return (
    <section id="waitlist" aria-labelledby="wl-title" className="flex scroll-mt-6 flex-col gap-3.5 border-t border-border-100 pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wl-title" className="text-lg font-semibold">
          Waitlist <span className="font-mono text-sm font-normal text-ink-200">{list.length}</span>
        </h2>
        <span className="text-sm text-ink-200">
          {counts
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${words(k, n)}`)
            .join(' · ') || 'Nobody yet'}
        </span>
      </div>
      <p className="text-sm text-ink-200">Email each person to book a call. Onboarded lets that email create an account; everyone else is shown the waitlist when they try to sign up.</p>
      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-ink-200">
                {['Joined', 'Email', 'Kind', 'Team or association', 'Age / teams', 'Source', 'Status'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td className={`${td} font-mono text-ink-200`}>{shortDay(vanDay(w.createdAt))}</td>
                  <td className={td}>
                    <a href={`mailto:${w.email}`} className="underline-offset-2 hover:underline">
                      {w.email}
                    </a>
                  </td>
                  <td className={`${td} ${w.kind === 'association' ? 'font-semibold' : ''}`}>{w.kind === 'association' ? 'Association' : 'Coach'}</td>
                  <td className={`${td} ${w.orgName ? '' : 'text-ink-200'}`}>{w.orgName ?? 'Not given'}</td>
                  <td className={td}>{w.kind === 'association' ? `${w.teamCount ?? '?'} teams` : (w.ageGroup ?? '–')}</td>
                  <td className={`${td} font-mono text-[13px]`}>{w.source ?? 'direct'}</td>
                  <td className="border-b border-border-100 py-1.5">
                    <StatusSelect id={w.id} email={w.email} status={w.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
