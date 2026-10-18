'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GROUPS } from '@/lib/drills/schema';
import { OVERALL, OVERALL_LABEL, REASONS, REASON_LABEL, STEAM, STEAM_LABEL, type Checkin, type CheckinInput, type Mark, type RateUnit } from '@/lib/plans/checkin';
import { saveCheckin } from '../../actions';

type Other = { initial: string; name: string; overall: Checkin['overall']; steam: Checkin['steam']; ready: string[]; marks: Mark[] };

// The check-in, Strava style: one overall answer first, then only what stood out.
// A co-coach's answer shows as their initial on the button they chose.
export function CheckinForm({
  practiceId,
  day,
  header,
  stats,
  units,
  initial,
  others,
}: {
  practiceId: string;
  day: string;
  header: React.ReactNode;
  stats: { minutes: number; drills: number; skaters: number };
  units: RateUnit[];
  initial: Checkin | null;
  others: Other[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [noteOpen, setNoteOpen] = useState(Boolean(initial?.note));
  const [c, setC] = useState<CheckinInput>({
    overall: initial?.overall ?? null,
    steam: initial?.steam ?? null,
    // Pre-fill "from about": the first drill anyone marked Flopped is the usual answer.
    steamFrom: initial?.steamFrom ?? null,
    ready: initial?.ready ?? [],
    note: initial?.note ?? '',
    marks: initial?.marks ?? [],
  });
  const mark = (key: string) => c.marks.find((m) => m.key === key);
  const setMark = (u: RateUnit, rating: Mark['rating']) =>
    setC((x) => {
      const cur = x.marks.find((m) => m.key === u.key);
      const rest = x.marks.filter((m) => m.key !== u.key);
      return { ...x, marks: cur?.rating === rating ? rest : [...rest, { key: u.key, drillId: u.drillId, rating, reasons: [] }] };
    });
  const toggleReason = (key: string, r: Mark['reasons'][number]) =>
    setC((x) => ({ ...x, marks: x.marks.map((m) => (m.key === key ? { ...m, reasons: m.reasons.includes(r) ? m.reasons.filter((y) => y !== r) : [...m.reasons, r] } : m)) }));
  const by = (pick: (o: Other) => boolean) => others.filter(pick).map((o) => o.initial);
  const firstFlop = units.find((u) => c.marks.some((m) => m.key === u.key && m.rating === 'flop')) ?? units.find((u) => others.some((o) => o.marks.some((m) => m.key === u.key && m.rating === 'flop')));
  const steamFrom = c.steamFrom ?? firstFlop?.key ?? units[Math.floor(units.length / 2)]?.key ?? null;
  const lost = c.steam === 'bored' || c.steam === 'tired';

  // Group the rotation zones under their rotation's name.
  const rows = useMemo(() => {
    const out: ({ head: string; time: string } | RateUnit)[] = [];
    let group = '';
    for (const u of units) {
      if (u.zone && u.group !== group) out.push({ head: u.group ?? 'Rotation', time: u.time });
      group = u.zone ? (u.group ?? '') : '';
      out.push(u);
    }
    return out;
  }, [units]);

  function save() {
    setError('');
    start(async () => {
      const r = await saveCheckin(practiceId, { ...c, steamFrom: lost ? steamFrom : null });
      if (r.ok) router.push(`/plans/${practiceId}/check-in?saved=1`);
      else setError(r.error);
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col pb-28">
      <div className="flex flex-col gap-1 pb-4">
        {header}
        <h1 className="font-display text-[26px] font-extrabold leading-8">How was {day}?</h1>
        <dl className="mt-2 grid grid-cols-3 gap-3">
          <Stat label="Ice time" value={stats.minutes} unit="min" />
          <Stat label="Drills" value={stats.drills} />
          <Stat label="Skaters" value={stats.skaters} />
        </dl>
      </div>

      <section className="border-t border-border-100 py-4">
        <h2 className="sr-only">How did it go overall?</h2>
        <div role="group" aria-label="How did it go overall" className="grid grid-cols-3 gap-2">
          {OVERALL.map((o) => (
            <Choice key={o} on={c.overall === o} marks={by((x) => x.overall === o)} onClick={() => setC((x) => ({ ...x, overall: x.overall === o ? null : o }))} className="min-h-16 flex-col text-[15px]">
              <span className="font-semibold">{OVERALL_LABEL[o][0]}</span>
              <span className={`text-[11px] ${c.overall === o ? 'text-surface-300' : 'text-ink-200'}`}>{OVERALL_LABEL[o][1]}</span>
            </Choice>
          ))}
        </div>
      </section>

      <section className="border-t border-border-100 py-4">
        <h2 className="mb-2.5 font-display text-lg font-bold">Did they lose steam?</h2>
        <div role="group" aria-label="Did they lose steam" className="grid grid-cols-3 gap-1.5">
          {STEAM.map((s) => (
            <Choice key={s} on={c.steam === s} marks={by((x) => x.steam === s)} onClick={() => setC((x) => ({ ...x, steam: x.steam === s ? null : s }))}>
              {STEAM_LABEL[s]}
            </Choice>
          ))}
        </div>
        {lost && units.length > 0 && (
          <label className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-200">
            From about
            <select value={steamFrom ?? ''} onChange={(e) => setC((x) => ({ ...x, steamFrom: e.target.value }))} className="min-h-10 rounded-md border border-border-100 bg-surface-100 px-2 text-[14px] text-ink-100">
              {units.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.zone ? `${u.zone} · ` : ''}
                  {u.name}, {u.time}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="border-t border-border-100 py-4">
        <h2 className="mb-1 font-display text-lg font-bold">
          Any standouts? <span className="ml-1 font-body text-[13px] font-normal text-ink-200">Everything else counts as OK.</span>
        </h2>
        {units.length === 0 ? (
          <p className="text-sm text-ink-200">This plan had no drills to rate.</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((r, i) =>
              'head' in r ? (
                <li key={`h${i}`} className="border-t border-border-100 pt-2.5 font-display text-[15px] font-semibold first:border-t-0">
                  {r.head}
                  <span className="block font-mono text-[11px] font-medium text-ink-200">{r.time} · each zone</span>
                </li>
              ) : (
                <li key={r.key} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-2 ${r.zone ? '' : 'border-t border-border-100 first:border-t-0'}`}>
                  {r.zone ? (
                    <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium">
                      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink-100 font-mono text-[11px] text-surface-100">{r.zone}</span>
                      <span className="truncate">{r.name}</span>
                    </span>
                  ) : (
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[15px] font-semibold">{r.name}</span>
                      <span className="block font-mono text-[11px] text-ink-200">{r.time}</span>
                    </span>
                  )}
                  <span className="flex gap-1.5" role="group" aria-label={r.name}>
                    {(['hit', 'flop'] as const).map((k) => (
                      <Choice key={k} pill on={mark(r.key)?.rating === k} marks={by((o) => o.marks.some((m) => m.key === r.key && m.rating === k))} onClick={() => setMark(r, k)}>
                        {k === 'hit' ? 'Big hit' : 'Flopped'}
                      </Choice>
                    ))}
                  </span>
                  {mark(r.key)?.rating === 'flop' && (
                    <span className="col-span-2 flex flex-wrap gap-1.5 pb-1" role="group" aria-label={`Why ${r.name} flopped`}>
                      {REASONS.map((x) => {
                        const on = mark(r.key)!.reasons.includes(x);
                        return (
                          <button
                            key={x}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleReason(r.key, x)}
                            className={`min-h-11 rounded-full border px-3 text-[13px] ${on ? 'border-solid border-ink-200 bg-surface-300 font-semibold' : 'border-dashed border-border-100'}`}
                          >
                            {REASON_LABEL[x]}
                          </button>
                        );
                      })}
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="border-t border-border-100 py-4">
        <h2 className="mb-2.5 font-display text-lg font-bold">
          Ready for harder? <span className="ml-1 font-body text-[13px] font-normal text-ink-200">Tap any that are.</span>
        </h2>
        <div role="group" aria-label="Groups ready for harder" className="flex flex-wrap gap-1.5">
          {GROUPS.slice()
            .reverse()
            .map((g) => (
              <Choice key={g} pill on={c.ready.includes(g)} marks={by((o) => o.ready.includes(g))} onClick={() => setC((x) => ({ ...x, ready: x.ready.includes(g) ? x.ready.filter((y) => y !== g) : [...x.ready, g] }))}>
                {g}
              </Choice>
            ))}
        </div>
      </section>

      {noteOpen && (
        <section className="border-t border-border-100 py-4">
          <label htmlFor="checkin-note" className="mb-2 block font-display text-base font-bold">
            Note
          </label>
          <textarea
            id="checkin-note"
            rows={3}
            maxLength={500}
            value={c.note}
            onChange={(e) => setC((x) => ({ ...x, note: e.target.value }))}
            placeholder="Anything else? No kids’ names, please."
            className="w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px]"
          />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-100 bg-surface-100 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-md flex-col gap-1 px-4 py-3">
          {error && (
            <p role="alert" className="text-sm text-flag-100">
              {error}
            </p>
          )}
          <button type="button" onClick={save} disabled={pending} className="min-h-12 rounded-full bg-rink-100 text-base font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
            {pending ? 'Saving…' : initial ? 'Save changes' : 'Save'}
          </button>
          {!noteOpen && (
            <button type="button" onClick={() => setNoteOpen(true)} className="mx-auto min-h-8 px-3 text-sm font-medium text-rink-100">
              Add a note
            </button>
          )}
          {others.length > 0 && <p className="text-center text-xs text-ink-200">Initials show what {others.map((o) => o.name).join(' and ')} chose.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-200">{label}</dt>
      <dd className="font-mono text-xl font-semibold tabular-nums">
        {value}
        {unit && <small className="ml-0.5 font-body text-[13px] font-medium text-ink-200">{unit}</small>}
      </dd>
    </div>
  );
}

// One answer button. Selected is the same dark fill for every answer: colour is kept for the summaries.
function Choice({ on, marks, onClick, pill, className = '', children }: { on: boolean; marks: string[]; onClick: () => void; pill?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative flex min-h-11 items-center justify-center gap-0.5 border text-[14px] ${pill ? 'min-w-[76px] rounded-full px-3' : 'rounded-md'} ${on ? 'border-ink-100 bg-ink-100 font-semibold text-surface-100' : 'border-border-100 bg-surface-100 hover:bg-surface-200'} ${className}`}
    >
      {children}
      {marks.length > 0 && (
        <span className="absolute -right-1.5 -top-2 flex" aria-label={`Also chosen by ${marks.join(', ')}`}>
          {marks.slice(0, 2).map((m, i) => (
            <span key={i} className={`grid h-5 w-5 place-items-center rounded-full border-2 border-surface-100 bg-surface-300 text-[10px] font-bold text-ink-100 ${i ? '-ml-1.5' : ''}`}>
              {m}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
