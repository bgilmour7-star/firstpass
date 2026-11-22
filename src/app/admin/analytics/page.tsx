import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { getSiteStore, type AccountSource, type TeamWeeks } from '@/lib/site/store';
import { change, summarize, summarizeAccountSources, summarizeGrowth, type FunnelStep, type SourceRow, type GrowthSummary, type Summary } from '@/lib/site/summary';
import type { PageEvent, WaitlistEntry } from '@/lib/site/schema';
import { ActivationSection, InTheApp, SectionTitle, Speed } from './app-sections';
import { summarizeActivation } from '@/lib/site/activation';
import { ProgressScoring } from './progress-section';
import { EMPTY_PROGRESS_USAGE, summarizeProgress, type ProgressUsageRows } from '@/lib/progress/usage';
import { monthOf } from '@/lib/progress/report';
import { getAppStore } from '@/lib/app/store';
import { EMPTY_USAGE_ROWS, summarizeUsage, type UsageRows } from '@/lib/site/usage';
import { summarizeSpeed, type Vital } from '@/lib/site/vitals';
import type { Growth } from '@/lib/site/store';

export const dynamic = 'force-dynamic';

// Admin → Analytics (decision 0019; canvas "Admin · Analytics"). The landing page's visits,
// counted without cookies, new accounts, and teams and coaches. Brett only. Association leads, with a
// status per person, has its own tab (Leads, /admin/leads).

const PERIODS = [7, 30] as const;
const DAY = 86_400_000;
const SOURCE_LABEL: Record<string, string> = { share: 'Shared plans', 'shared-ice': 'Shared ice', invite: 'Invites', direct: 'Direct', 'google.com': 'Google' };
const TAGGED = new Set(['share', 'shared-ice', 'invite']);

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (n: number | null) => (n == null ? '–' : `${(Math.round(n * 1000) / 10).toLocaleString('en-CA')}%`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; pmonth?: string }> }) {
  await requireAnalytics();
  const { days: raw, pmonth } = await searchParams;
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
  // Teams and coaches come from the app, not the landing page, so they load on their own.
  let growth: Growth = { teams: [], coaches: [], accounts: [] };
  let growthMissing = false;
  try {
    growth = await store.growth();
  } catch (e) {
    if (e instanceof Error && e.message === 'growth-migration-missing') growthMissing = true;
    else throw e;
  }
  const g = summarizeGrowth(growth, { days });

  // Where accounts came from (decision 0052). Its table comes from a later migration.
  let accountRows: AccountSource[] = [];
  let sourcesMissing = false;
  try {
    accountRows = await store.accountSources(new Date(Date.now() - days * DAY).toISOString());
  } catch (e) {
    if (e instanceof Error && e.message === 'account-sources-migration-missing') sourcesMissing = true;
    else throw e;
  }
  const acctSources = summarizeAccountSources(accountRows, { days });

  // Activation and retention (decision 0053): every team, week by week. Its function comes from a later migration.
  let weekRows: TeamWeeks[] = [];
  let weeksMissing = false;
  try {
    weekRows = await store.teamWeeks();
  } catch (e) {
    if (e instanceof Error && e.message === 'team-weeks-migration-missing') weeksMissing = true;
    else throw e;
  }
  const activation = summarizeActivation(weekRows);

  // In the app and Speed (decision 0029). Their tables come from a later migration.
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
  const s = summarize(events, waitlist, { days, app: { teams: rows.teams, practices: rows.practices, accounts: growth.accounts } });
  const speed = summarizeSpeed(vitals, { days });
  // Progress scoring (decision 0030, part E): one month at a time, the newest scored month by default.
  let progressRows: ProgressUsageRows = EMPTY_PROGRESS_USAGE;
  let progressMissing = false;
  const wanted = pmonth && /^\d{4}-\d{2}-01$/.test(pmonth) ? pmonth : null;
  try {
    progressRows = await store.progressUsage(wanted ?? monthOf(new Date()));
    // No month asked for and nothing this month yet: show the newest month that has rounds.
    if (!wanted && !progressRows.rounds.some((r) => r.month === monthOf(new Date())) && progressRows.months[0]) progressRows = await store.progressUsage(progressRows.months[0]);
  } catch (e) {
    if (e instanceof Error && e.message === 'progress-usage-migration-missing') progressMissing = true;
    else throw e;
  }
  const shownMonth = wanted ?? (progressRows.rounds.some((r) => r.month === monthOf(new Date())) ? monthOf(new Date()) : progressRows.months[0]);
  const progress = shownMonth && progressRows.rounds.some((r) => r.month === shownMonth) ? summarizeProgress(progressRows, shownMonth) : null;
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
              ['#activation', 'Activation'],
              ['#progress', 'Progress scoring'],
              ['#speed', 'Speed'],
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
          The landing page tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261026000000_waitlist_and_analytics.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}

      <div id="site" className="-mb-3 scroll-mt-6">
        <SectionTitle id="site-title" first title="Public site" sub="Visits to firstpass.coach (the landing page and the answer pages), counted without cookies. Returning visitors are coaches who were signed in, or signed in that day in the same browser; everyone else is a lead. A lead who makes an account stays a lead: that's the conversion." />
      </div>
      <Headline s={s} />
      <VisitsChart s={s} />

      <Funnel s={s} />
      <AccountSources rows={acctSources.rows} total={acctSources.total} missing={sourcesMissing} />
      <Pages s={s} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-14 gap-y-10">
        <Channels s={s} />
        <Sources s={s} />
      </div>

      <Who s={s} />
      <InTheApp u={usage} days={days} names={names} missing={usageMissing} />
      <ActivationSection a={activation} missing={weeksMissing} />
      <TeamsAndCoaches g={g} days={days} missing={growthMissing} />
      <ProgressScoring u={progress} months={progressRows.months} days={days} missing={progressMissing} now={Date.now()} />
      <Speed s={speed} missing={usageMissing} />
    </div>
  );
}

function Headline({ s }: { s: Summary }) {
  const prev = `vs previous ${s.days} days`;
  const tiles = [
    { label: 'Lead visitors', value: s.leads.now.toLocaleString('en-CA'), delta: change(s.leads.now, s.leads.before, 'percent'), note: prev },
    { label: 'Returning visitors', value: s.returning.now.toLocaleString('en-CA'), delta: change(s.returning.now, s.returning.before, 'percent'), note: 'signed-in coaches' },
    { label: 'Visits', value: s.visits.now.toLocaleString('en-CA'), delta: change(s.visits.now, s.visits.before, 'percent'), note: 'page views, everyone' },
    { label: 'New accounts', value: String(s.accounts.now), delta: change(s.accounts.now, s.accounts.before, 'count'), note: prev },
    {
      label: 'Leads who made an account',
      value: pct(s.funnel[0].count ? s.funnel[3].count / s.funnel[0].count : null),
      delta: null,
      note: 'traced to a visit the same day',
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
  const max = niceMax(Math.max(...s.daily.map((d) => Math.max(d.leads, d.returning)), 1));
  const x = (i: number) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : (W - L - R) / 2);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = (pick: (d: Summary['daily'][number]) => number) => s.daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(pick(d)).toFixed(1)}`).join(' ');
  const peakLeads = s.daily.reduce<{ i: number; n: number } | null>((best, d, i) => (d.leads > 0 && (!best || d.leads > best.n) ? { i, n: d.leads } : best), null);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const ticks = [...new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1])];
  const maxSign = Math.max(...s.daily.map((d) => d.accounts), 1);
  const slot = (W - L - R) / Math.max(n - 1, 1);
  const describe = peakLeads ? `Most leads: ${peakLeads.n} on ${shortDay(s.daily[peakLeads.i].day)}. ${s.leads.now} leads and ${s.returning.now} returning in all.` : 'No lead visitors yet.';

  return (
    <section aria-labelledby="visits-title" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="visits-title" className="text-lg font-semibold">
          Visitors per day
        </h2>
        <span className="flex gap-4 text-[13px] text-ink-200" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-rink-100" /> Leads
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink-200" /> Returning
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Unique visitors per day, leads and returning, ${shortDay(s.from)} to ${shortDay(s.to)}. ${describe}`} className="block overflow-visible">
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
        <path d={path((d) => d.returning)} fill="none" stroke="var(--ink-200)" strokeWidth="1.5" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path((d) => d.leads)} fill="none" stroke="var(--rink-100)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {peakLeads && (
          <>
            <circle cx={x(peakLeads.i)} cy={y(peakLeads.n)} r="5" fill="var(--rink-100)" stroke="var(--surface-100)" strokeWidth="2" />
            <text x={x(peakLeads.i) + (peakLeads.i > n / 2 ? -12 : 12)} y={y(peakLeads.n) + 4} textAnchor={peakLeads.i > n / 2 ? 'end' : 'start'} fontSize="12" fill="var(--ink-100)">
              {shortDay(s.daily[peakLeads.i].day)} · {peakLeads.n} lead{peakLeads.n === 1 ? '' : 's'}
            </text>
          </>
        )}
        {/* Hover targets wider than the line, one per day, with the day's numbers. */}
        {s.daily.map((d, i) => (
          <rect key={d.day} x={x(i) - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent">
            <title>{`${shortDay(d.day)}: ${d.leads} lead${d.leads === 1 ? '' : 's'}, ${d.returning} returning, ${d.visits} visits, ${d.accounts} new account${d.accounts === 1 ? '' : 's'}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-200">New accounts per day</span>
        <svg viewBox={`0 0 ${W} 50`} width="100%" role="img" aria-label={`New accounts per day: ${s.accounts.now} in all.`} className="block overflow-visible">
          <path d={`M${L} 46H${W - R}`} stroke="var(--border-100)" strokeWidth="1" />
          {s.daily.map((d, i) =>
            d.accounts ? (
              <rect key={d.day} x={x(i) - 4} y={46 - (40 * d.accounts) / maxSign} width="8" height={(40 * d.accounts) / maxSign} rx="2" fill="var(--ink-100)">
                <title>{`${shortDay(d.day)}: ${d.accounts} new account${d.accounts === 1 ? '' : 's'}`}</title>
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
              <th className="pb-1.5 text-right font-medium">Leads</th>
              <th className="pb-1.5 text-right font-medium">Returning</th>
              <th className="pb-1.5 text-right font-medium">Visits</th>
              <th className="pb-1.5 text-right font-medium">New accounts</th>
            </tr>
          </thead>
          <tbody>
            {s.daily.map((d) => (
              <tr key={d.day} className="border-t border-border-100">
                <td className="py-1">{shortDay(d.day)}</td>
                <td className="py-1 text-right">{d.leads}</td>
                <td className="py-1 text-right">{d.returning}</td>
                <td className="py-1 text-right">{d.visits}</td>
                <td className="py-1 text-right">{d.accounts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

/** The lead funnel (decision 0051): each step's count, what it kept from the step before, and who dropped off. */
function Funnel({ s }: { s: Summary }) {
  const site = s.funnel.filter((f) => f.where === 'site');
  const app = s.funnel.filter((f) => f.where === 'app');
  // The biggest leak on the site: the step that lost the most leads.
  const worst = site.reduce<FunnelStep | null>((w, f) => (f.dropped && (!w || f.dropped > (w.dropped ?? 0)) ? f : w), null);
  const { accounts, traced, invited } = s.funnelNote;
  const other = Math.max(accounts - traced - invited, 0);
  const part = (title: string, note: string, steps: FunnelStep[]) => {
    const top = steps[0]?.count || 1;
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-ink-200">· {note}</span>
        </h3>
        <ol className="flex flex-col">
          {steps.map((f) => (
            <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-4 gap-y-1 border-b border-border-100 py-2.5 text-sm sm:grid-cols-[220px_minmax(0,1fr)_48px_250px]">
              <span className={f === worst ? 'font-semibold' : ''}>{f.label}</span>
              <span className="order-3 col-span-2 h-3 overflow-hidden rounded bg-surface-200 sm:order-none sm:col-span-1" aria-hidden="true">
                <span className="block h-full rounded bg-rink-100" style={{ width: `${Math.min(100, Math.max((f.count / top) * 100, f.count ? 1.5 : 0))}%` }} />
              </span>
              <span className="text-right font-mono text-base tabular-nums">{f.count}</span>
              <span className={`order-4 col-span-2 text-[13px] sm:order-none sm:col-span-1 sm:text-right ${f === worst ? 'font-semibold text-whistle-100' : 'text-ink-200'}`}>
                {f.dropped === null ? (f.ofFirst === 1 ? 'everyone starts here' : '') : f.ofPrev === null ? '' : f.ofPrev > 1 ? `${f.count - Math.round(f.count / f.ofPrev)} more than the step before` : `kept ${pct(f.ofPrev)} · ${f.dropped} dropped${f === worst ? ', the biggest drop' : ''}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <section aria-labelledby="funnel-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-title" className="text-lg font-semibold">
          Lead funnel
        </h2>
        <p className="text-sm text-ink-200">From a lead’s first visit to a team that ran a practice. Returning coaches are left out.</p>
      </div>
      {site[0]?.count ? part('On the site', 'the same visitor, the same day', site) : <p className="text-sm text-ink-200">No lead visitors in this period yet.</p>}
      {part('In the app', 'counted in the app, not linked to visits', app)}
      <p className="text-sm text-ink-200">
        {accounts === 0
          ? 'No new accounts in this period.'
          : `${accounts} new account${accounts === 1 ? '' : 's'}: ${traced} traced to a lead’s visit that day, ${invited} invited to a team${other ? `, ${other} not traced (another day, another browser or device, or from before sign-ins were counted)` : ''}.`}{' '}
        Test teams count too.
      </p>
    </section>
  );
}

/** New accounts by the channel that brought them, followed to a team and a practice (decision 0052). */
function AccountSources({ rows, total, missing }: { rows: SourceRow[]; total: number; missing: boolean }) {
  const th = 'border-b border-border-100 pb-2 font-medium';
  const td = 'border-b border-border-100 py-2.5 align-top';
  const of = (n: number, d: number) => (
    <>
      {n}
      {d > 0 && <span className="block text-xs text-ink-200">{pct(n / d)}</span>}
    </>
  );
  return (
    <section aria-labelledby="acct-src-title" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 id="acct-src-title" className="text-lg font-semibold">
          Where accounts came from
        </h2>
        <p className="text-sm text-ink-200">Each new account, by the visit that led to it, and whether its coach went on to make a team and run a practice (head coaches only).</p>
      </div>
      {missing ? (
        <p className="text-sm text-ink-200">Not set up yet: its database change hasn’t run.</p>
      ) : total === 0 ? (
        <p className="text-sm text-ink-200">No new accounts in this period.</p>
      ) : (
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-ink-200">
              <th scope="col" className={th}>
                Came from
              </th>
              <th scope="col" className={`${th} pl-4 text-right`}>
                Accounts
              </th>
              <th scope="col" className={`${th} pl-4 text-right`}>
                Made a team
              </th>
              <th scope="col" className={`${th} pl-4 text-right`}>
                Ran a practice
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={td}>
                  {r.label}
                  {r.pages.length > 0 && <span className="block text-xs text-ink-200">Landed on {r.pages.slice(0, 2).join(' · ')}</span>}
                </td>
                <td className={`${td} pl-4 text-right font-mono`}>{r.accounts}</td>
                <td className={`${td} pl-4 text-right font-mono`}>{r.label === 'Invited to a team' ? '–' : of(r.madeTeam, r.accounts)}</td>
                <td className={`${td} pl-4 text-right font-mono`}>{r.label === 'Invited to a team' ? '–' : of(r.ranPractice, r.accounts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-ink-200">An account is traced when it was made the same day as the visit, in the same browser. Accounts from before Nov 22 show as not traced.</p>
    </section>
  );
}

/** Each public page's visitors and taps on Plan your first practice (decision 0041): which answer pages bring coaches in. */
function Pages({ s }: { s: Summary }) {
  const th = 'border-b border-border-100 pb-2 font-medium';
  const td = 'border-b border-border-100 py-2.5';
  return (
    <section aria-labelledby="pages-title" className="flex flex-col gap-3.5">
      <h2 id="pages-title" className="text-lg font-semibold">
        Pages
      </h2>
      {s.pages.length === 0 ? (
        <p className="text-sm text-ink-200">No visits in this period yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-ink-200">
              <th scope="col" className={th}>
                Page
              </th>
              <th scope="col" className={`${th} text-right`}>
                Leads
              </th>
              <th scope="col" className={`${th} pl-4 text-right`}>
                Returning
              </th>
              <th scope="col" className={`${th} pl-4 text-right`} title="Leads who tapped Plan your first practice on this page">
                Leads who tapped
              </th>
            </tr>
          </thead>
          <tbody>
            {s.pages.map((r) => (
              <tr key={r.path}>
                <td className={td}>
                  <a href={r.path} className="underline-offset-2 hover:underline">
                    {r.label}
                  </a>{' '}
                  <span className="font-mono text-xs text-ink-200">{r.path}</span>
                </td>
                <td className={`${td} text-right font-mono`}>{r.leads}</td>
                <td className={`${td} text-right font-mono text-ink-200`}>{r.returning}</td>
                <td className={`${td} text-right font-mono`}>{r.taps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Visitors by kind of source (decision 0041). AI assistants is the AEO check: ChatGPT, Perplexity, Gemini and others. */
function Channels({ s }: { s: Summary }) {
  const total = Math.max(...s.channels.map((c) => c.visitors), 1);
  return (
    <section aria-labelledby="channels-title" className="flex flex-col gap-3.5">
      <h2 id="channels-title" className="text-lg font-semibold">
        How they found us
      </h2>
      {s.channels.length === 0 ? (
        <p className="text-sm text-ink-200">No visits in this period yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <li className="grid grid-cols-[120px_1fr_52px_72px] gap-3 text-[13px] text-ink-200" aria-hidden="true">
            <span />
            <span />
            <span className="text-right">Leads</span>
            <span className="text-right">Returning</span>
          </li>
          {s.channels.map((c) => (
            <li key={c.channel} className="grid grid-cols-[120px_1fr_52px_72px] items-center gap-3 text-sm" aria-label={`${c.channel}: ${c.leads} leads, ${c.returning} returning`}>
              <span>{c.channel}</span>
              <span className="flex h-2.5 overflow-hidden rounded-full bg-surface-200" aria-hidden="true">
                <span className="block h-full bg-rink-100" style={{ width: `${(c.leads / total) * 100}%` }} />
                <span className="block h-full bg-ink-200/40" style={{ width: `${(c.returning / total) * 100}%` }} />
              </span>
              <span className="text-right font-mono tabular-nums">{c.leads}</span>
              <span className="text-right font-mono tabular-nums text-ink-200">{c.returning}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-200">Visitors by where they came from. AI assistants are ChatGPT, Perplexity, Claude, Gemini and Copilot. Search engines often hide the search words, so check Search Console for those.</p>
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
                Association leads
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
        Who’s visiting
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-10 gap-y-7">
        {col('Association leads', s.signups.associations ? [{ label: 'From the landing page', value: String(s.signups.associations) }] : [])}
        {col('Visitors’ devices', s.devices.map((d) => ({ label: d.label, value: pct(d.share) })))}
        {col('Visitors’ regions', s.regions.map((r) => ({ label: r.label, value: pct(r.share) })))}
      </div>
    </section>
  );
}

function TeamsAndCoaches({ g, days, missing }: { g: GrowthSummary; days: number; missing: boolean }) {
  const tiles = [
    { label: 'Coaches joined, in all', m: g.coaches, note: 'each coach counted once' },
    { label: 'Teams created, in all', m: g.teams, note: null },
  ];
  const W = 800, H = 170, L = 36, R = 96, T = 12, B = 28;
  const n = g.daily.length;
  const max = Math.max(4, ...g.daily.map((d) => Math.max(d.coaches, d.teams)));
  const top = max <= 4 ? 4 : max <= 10 ? 10 : niceMax(max);
  const x = (i: number) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : 0);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  // Running totals only step up, so draw them as steps: flat until the day someone joins.
  const steps = (pick: (d: GrowthSummary['daily'][number]) => number) =>
    g.daily.map((d, i) => (i ? `H${x(i).toFixed(1)}V${y(pick(d)).toFixed(1)}` : `M${x(0).toFixed(1)} ${y(pick(d)).toFixed(1)}`)).join('');
  const grid = top <= 10 ? [0, top / 2, top] : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const ticks = [...new Set([0, Math.round((n - 1) / 2), n - 1])];
  const last = g.daily.at(-1) ?? { coaches: 0, teams: 0 };
  const series = [
    { key: 'coaches', label: last.coaches === 1 ? 'Coach' : 'Coaches', value: last.coaches, path: steps((d) => d.coaches), stroke: 'var(--rink-100)', dash: undefined },
    { key: 'teams', label: last.teams === 1 ? 'Team' : 'Teams', value: last.teams, path: steps((d) => d.teams), stroke: 'var(--ink-100)', dash: '5 4' },
  ];
  // Keep the two end labels apart when the totals are close.
  const labelY = series.map((sr) => y(sr.value) + 4);
  if (Math.abs(labelY[0] - labelY[1]) < 14) labelY[labelY[0] <= labelY[1] ? 0 : 1] -= 14 - Math.abs(labelY[0] - labelY[1]);

  return (
    <section aria-labelledby="growth-title" className="flex flex-col gap-4">
      <h3 id="growth-title" className="text-lg font-semibold">
        Teams and coaches
      </h3>
      {missing ? (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          Teams and coaches need one more bit of SQL. Run <code className="font-mono">supabase/migrations/20261030000000_analytics_growth.sql</code> in the Supabase SQL editor, then reload.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-6">
            {tiles.map((t) => {
              return (
                <div key={t.label} className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-200">{t.label}</span>
                  <span className="font-mono text-[40px] font-medium leading-none tracking-[-0.02em]">{t.m.total}</span>
                  <span className="text-[13px]">
                    <span className={`font-semibold ${t.m.inPeriod ? 'text-good-100' : 'text-ink-100'}`}>+{t.m.inPeriod} in the last {days} days </span>
                    {t.note && <span className="text-ink-200">· {t.note}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-200">Running total</span>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label={`Running totals over the last ${days} days: ${last.coaches} coaches and ${last.teams} teams.`}
              className="block overflow-visible"
            >
              <g stroke="var(--border-100)" strokeWidth="1">
                {grid.map((v) => (
                  <path key={v} d={`M${L} ${y(v)}H${W - R}`} />
                ))}
              </g>
              <g fill="var(--ink-200)" fontFamily="var(--font-mono)" fontSize="11" textAnchor="end">
                {grid.map((v) => (
                  <text key={v} x={L - 8} y={y(v) + 4}>
                    {v}
                  </text>
                ))}
              </g>
              <g fill="var(--ink-200)" fontSize="11">
                {n > 0 &&
                  ticks.map((i) => (
                    <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                      {shortDay(g.daily[i].day)}
                    </text>
                  ))}
              </g>
              {n > 0 &&
                series.map((sr, k) => (
                  <g key={sr.key}>
                    <path d={sr.path} fill="none" stroke={sr.stroke} strokeWidth="2" strokeDasharray={sr.dash} strokeLinejoin="round" />
                    <text x={W - R + 10} y={labelY[k]} fontSize="12" fill="var(--ink-100)">
                      <tspan fontFamily="var(--font-mono)" fontWeight="600">{sr.value}</tspan> {sr.label}
                    </text>
                  </g>
                ))}
              {g.daily.map((d, i) => (
                <rect key={d.day} x={x(i) - (W - L - R) / Math.max(n - 1, 1) / 2} y={T} width={(W - L - R) / Math.max(n - 1, 1)} height={H - T - B} fill="transparent">
                  <title>{`${shortDay(d.day)}: ${d.coaches} coaches, ${d.teams} teams`}</title>
                </rect>
              ))}
            </svg>
          </div>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2.5 text-rink-100">Show as a table</summary>
            <table className="mt-2 w-full max-w-md border-collapse font-mono text-[13px] tabular-nums">
              <thead>
                <tr className="text-left font-body text-ink-200">
                  <th className="pb-1.5 font-medium">Day</th>
                  <th className="pb-1.5 text-right font-medium">Coaches</th>
                  <th className="pb-1.5 text-right font-medium">Teams</th>
                </tr>
              </thead>
              <tbody>
                {g.daily.map((d) => (
                  <tr key={d.day} className="border-t border-border-100">
                    <td className="py-1">{shortDay(d.day)}</td>
                    <td className="py-1 text-right">{d.coaches}</td>
                    <td className="py-1 text-right">{d.teams}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
