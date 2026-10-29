import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { CALL_TIMES, labelOf } from '@/lib/discovery/schema';
import { FILTERS, describe, displayName, matches, surveySummary, type Count, type FilterId } from '@/lib/discovery/summary';
import { ResponseActions, Themes } from './controls';
import { MigrationMissing, loadDiscovery, shortDay } from './load';

export const dynamic = 'force-dynamic';

// Admin → Survey (decision 0027; canvas A1). Brett only: the answers carry emails and phone numbers.

export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ f?: string; theme?: string }> }) {
  await requireAnalytics('/admin/survey');
  const { f: rawFilter, theme } = await searchParams;
  const filter = (FILTERS.find((x) => x.id === rawFilter)?.id ?? 'all') as FilterId;
  const { people, responses, notes, themes, missing } = await loadDiscovery();
  const s = surveySummary(responses, people, notes);
  const byId = new Map(people.map((p) => [p.id, p]));
  // Hardest part first: answers with one come before those without, newest first within each.
  const shown = responses.filter((r) => matches(r, filter, theme)).sort((a, b) => Number(Boolean(b.hardestPart)) - Number(Boolean(a.hardestPart)) || b.createdAt.localeCompare(a.createdAt));
  const since = responses.length ? shortDay(responses[responses.length - 1].createdAt) : null;
  const href = (f: FilterId, t?: string | null) => {
    const q = new URLSearchParams();
    if (f !== 'all') q.set('f', f);
    if (t) q.set('theme', t);
    const qs = q.toString();
    return `/admin/survey${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="grid gap-x-10 gap-y-8 pb-16 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold leading-[1.1]">Survey results</h1>
          <p className="text-sm text-ink-200">Visible to Brett only{since ? ` · Answers since ${since}` : ''}</p>
          <p className="flex flex-wrap items-center gap-x-1 text-sm">
            <span className="text-ink-200">See the survey:</span>
            <Link href="/s/preview/waitlist" target="_blank" className="inline-flex min-h-11 items-center px-1 font-medium text-rink-100 hover:underline">
              Waitlist
            </Link>
            <span aria-hidden="true" className="text-ink-200">·</span>
            <Link href="/s/preview/coach" target="_blank" className="inline-flex min-h-11 items-center px-1 font-medium text-rink-100 hover:underline">
              Coach
            </Link>
            <span className="text-ink-200">(opens in a new tab, answers aren’t saved)</span>
          </p>
        </div>
        {missing && <MigrationMissing />}

        <ul aria-label="Headline numbers" className="grid grid-cols-2 gap-6 border-y border-border-100 py-[18px] sm:grid-cols-4">
          <Stat n={s.answers} label={`answers, from ${s.signups} sign-up${s.signups === 1 ? '' : 's'}`} />
          <Stat n={s.wantCall} label={`want a call · ${s.notBooked} not booked`} />
          <Stat n={s.cardsToSend} label={`gift card${s.cardsToSend === 1 ? '' : 's'} to send`} warn={s.cardsToSend > 0} />
          <Stat n={s.repliedInstead} label="replied to an email instead" />
        </ul>

        <nav aria-label="Filter answers" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
          {FILTERS.map((x) => {
            const on = x.id === filter;
            return (
              <Link
                key={x.id}
                href={href(x.id, theme)}
                aria-current={on ? 'true' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm ${on ? 'border-[1.5px] border-ink-100 bg-ink-100 font-semibold text-surface-100' : 'border border-border-200 bg-surface-100 font-medium hover:bg-surface-200'}`}
              >
                {x.label} <span className={`font-mono text-xs ${on ? 'opacity-80' : 'text-ink-200'}`}>{s.filterCounts[x.id]}</span>
              </Link>
            );
          })}
        </nav>
        {theme && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Showing answers tagged <b className="font-semibold">{theme}</b>
            <Link href={href(filter)} className="inline-flex min-h-10 items-center text-rink-100 hover:underline">
              Show all themes
            </Link>
          </p>
        )}

        {shown.length === 0 ? (
          <p className="text-sm text-ink-200">{responses.length ? 'No answers match this filter.' : 'No answers yet. The welcome email asks every new waitlist sign-up; coaches are asked 2 days after their first practice.'}</p>
        ) : (
          <ol className="flex flex-col">
            {shown.map((r) => {
              const p = byId.get(r.personId);
              return (
                <li key={r.id} className="grid gap-4 border-t border-border-100 py-[18px] md:grid-cols-[minmax(0,1fr)_220px] md:gap-6">
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="text-[13px] text-ink-200">
                      <span className="font-mono">{shortDay(r.createdAt)}</span> ·{' '}
                      {p ? (
                        <Link href={`/admin/coaches/${p.code}`} className="text-rink-100 hover:underline">
                          {displayName(p)}
                        </Link>
                      ) : (
                        'Unknown'
                      )}
                      {describe(r) ? ` · ${describe(r)}` : ''}
                      {r.audience === 'coach' ? ' · Using Firstpass' : ''}
                    </span>
                    {r.hardestPart ? <p className="text-[15px] leading-[23px]">“{r.hardestPart}”</p> : <p className="text-[15px] text-ink-200">Skipped the hardest part.</p>}
                    {(r.wantsHelp || r.extra.missing) && (
                      <p className="text-sm leading-[21px] text-ink-200">
                        {r.audience === 'coach' ? 'Missing: ' : 'Would help: '}“{r.extra.missing ?? r.wantsHelp}”
                      </p>
                    )}
                    {r.readOnly ? <span className="text-[13px] text-ink-200">From the U11+ screen in Create a team</span> : <Themes kind="response" id={r.id} themes={r.themes} known={themes} />}
                  </div>
                  <div className="flex flex-col items-start gap-2.5 text-sm">
                    <span>
                      <b className="font-semibold">{r.wantsCall ? 'Wants a call' : 'Not right now'}</b>
                      {r.wantsCall && (
                        <>
                          <br />
                          <span className="text-[13px] text-ink-200">
                            {[r.callTimes.map((t) => labelOf(CALL_TIMES, t)).filter(Boolean).join(', ') || 'Any time', r.phone ?? 'email'].join(' · ')}
                          </span>
                        </>
                      )}
                    </span>
                    {!r.readOnly && <ResponseActions id={r.id} wantsCall={r.wantsCall} callStatus={r.callStatus} giftCard={r.giftCard} />}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <aside aria-label="Summary" className="flex flex-col gap-6 self-start rounded-xl bg-surface-200 p-6 xl:sticky xl:top-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-body text-sm font-semibold">Common themes</h2>
            <span className="font-mono text-xs text-ink-200">from {s.themedFrom} answers</span>
          </div>
          {s.themes.length === 0 ? (
            <p className="text-sm text-ink-200">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {s.themes.slice(0, 8).map((t) => (
                <li key={t.label}>
                  <Link href={href(filter, theme === t.label ? null : t.label)} aria-current={theme === t.label ? 'true' : undefined} className={`grid min-h-10 grid-cols-[28px_1fr] items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-300 ${theme === t.label ? 'bg-surface-300 font-semibold' : ''}`}>
                    <b className="font-mono font-medium">{t.n}</b>
                    <span>{t.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[13px] leading-[18px] text-ink-200">Grouped by Claude each morning from survey answers and notes. Tap a theme to see its answers.</p>
        </section>
        <Counts title="How they planned their last practice" rows={s.plannedHow} />
        {s.changedPlan.length > 0 && <Counts title="Coaches: how much of the plan they changed" rows={s.changedPlan} />}
        {s.plannedWhen.length > 0 && <Counts title="When they planned it" rows={s.plannedWhen} />}
        {s.who.length > 0 && <Counts title="Who answered" rows={s.who} />}
        <a href="/admin/survey/csv" download className="inline-flex min-h-11 items-center self-start rounded-full border-[1.5px] border-border-200 bg-surface-100 px-5 text-sm font-medium hover:bg-surface-300">
          Download all answers (CSV)
        </a>
      </aside>
    </div>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <li className="flex flex-col gap-0.5">
      <b className={`font-mono text-[30px] font-medium leading-[34px] ${warn ? 'text-whistle-100' : ''}`}>{n}</b>
      <span className="text-sm text-ink-200">{label}</span>
    </li>
  );
}

function Counts({ title, rows }: { title: string; rows: Count[] }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
      <h2 className="font-body text-sm font-semibold">{title}</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[28px_1fr] gap-2">
            <b className="font-mono font-medium">{r.n}</b>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
