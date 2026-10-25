'use client';

import { useState, useTransition } from 'react';
import { removeCalendar, saveCalendar, type CalendarCheck } from './actions';

const input = 'w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';
const when = (date: string, time: string) => {
  const d = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const [h, m] = time.split(':').map(Number);
  return `${d} · ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};

/** The team's calendar link: ice times show up in Plans, ready to plan. */
export function CalendarSettings({ initial, syncedAt, embedded = false }: { initial: string | null; syncedAt: string | null; /** Inside the Team page's drawer: no section heading of its own (decision 0026). */ embedded?: boolean }) {
  const [url, setUrl] = useState(initial ?? '');
  const [saved, setSaved] = useState(initial);
  const [check, setCheck] = useState<CalendarCheck | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className={embedded ? 'flex flex-col gap-3' : 'flex flex-col gap-3 border-t-2 border-ink-100 pt-3'}>
      <div className="flex flex-col gap-0.5">
        {embedded ? <h3 className="text-sm font-semibold">Calendar link</h3> : <h2 className="text-[17px] font-extrabold">Calendar link</h2>}
        <p className="text-sm text-ink-200">
          Paste your schedule&apos;s calendar (iCal) link from TeamSnap, Google Calendar or your association. Practices show up in Plans, ready to plan, and move when the schedule moves. We read dates, times, rinks and event names only.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveCalendar(url);
            setCheck(r);
            if (r.ok) setSaved(url);
          });
        }}
      >
        <label className="sr-only" htmlFor="calendar-url">
          Calendar link
        </label>
        <input id="calendar-url" className={`${input} font-mono text-sm`} placeholder="webcal://… or https://….ics" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} />
        <button type="submit" disabled={pending || !url.trim()} className="min-h-11 shrink-0 rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-50">
          {pending ? 'Reading…' : saved && saved === url ? 'Check again' : 'Save and check'}
        </button>
      </form>
      {check && !check.ok && (
        <p role="alert" className="text-sm text-flag-100">
          {check.error}
        </p>
      )}
      {check?.ok && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-200 p-3 text-sm" aria-live="polite">
          <b>
            Found {check.practices} practice{check.practices === 1 ? '' : 's'}
            {check.games ? ` and ${check.games} game${check.games === 1 ? '' : 's'} (left out)` : ''}.
          </b>
          {check.next.length > 0 && (
            <ul className="flex flex-col">
              {check.next.map((e) => (
                <li key={e.date + e.startTime} className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 border-t border-border-100 py-1">
                  <span className="font-mono text-xs leading-5">{when(e.date, e.startTime)}</span>
                  <span>
                    {e.title}
                    {e.rink && <span className="text-ink-200"> · {e.rink}</span>}
                    {e.sharedWith && <span className="text-ink-200"> · shared with {e.sharedWith}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-200">They&apos;re in Plans now, each with Plan it.</p>
        </div>
      )}
      {saved && !check && (
        <p className="text-xs text-ink-200">
          Connected{syncedAt ? `, last read ${new Date(syncedAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}. It&apos;s read again when you open Plans.
        </p>
      )}
      {saved && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              const r = await removeCalendar();
              if (r.ok) {
                setSaved(null);
                setUrl('');
                setCheck(null);
              }
            })
          }
          className="w-fit text-sm text-flag-100 hover:underline"
        >
          Disconnect the calendar
        </button>
      )}
    </section>
  );
}
