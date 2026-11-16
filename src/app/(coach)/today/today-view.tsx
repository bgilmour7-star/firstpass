'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DrillDrawer, OpenDrill, useOpenDrill } from '@/components/drill-drawer';
import type { Favorite } from '@/lib/app/store';
import { Rink, RinkLegend } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { levelCount, levelOf } from '@/lib/drills/schema';
import { addMinutes, blockLevels, blockMinutes, clock, groupLabels, levelMinutes, rotationToday, todayUnits, unusedZones, zoneFor, ZONES, type Block, type Practice, type Team, type Unit } from '@/lib/plans/schema';
import { currentIndex, practicePhase, upNextIndex, whenLabel, type Phase } from '@/lib/today/phase';
import { Icon, ShareControl } from '../plans/[id]/parts';
import type { RinkDiagramProps } from '../../../../design-system/index';

// Next practice (decision 0032), in three states set by the clock:
// - Before: the plan as a sheet to prepare from. Each drill with its diagram; on a computer one drill
//   is open beside the list with its diagram, key, stations, cue and set-up.
// - During (from 15 minutes before the start): rink-side on a phone. What's on now, time left, the
//   diagram and cue, then what's up next. The whole practice folds away below.
// - After: the check-in first, then what you ran.

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

type Span = { b: Block; s: number; e: number };

export function TodayView({
  practice,
  team,
  drills,
  favorites,
  today,
  known,
  share,
}: {
  practice: Practice;
  team: Team;
  drills: Drill[];
  favorites: Record<string, Favorite>;
  today: string;
  known: string[];
  share: { token: string; expiresAt: string } | null;
}) {
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  const knownSet = useMemo(() => new Set(known), [known]);
  // Tap a drill for its full details in a sheet, without losing your place in the practice (decision 0015).
  const [viewing, setViewing] = useState<string | null>(null);
  const [favs, setFavs] = useState(favorites);
  const closeDrill = useCallback(() => setViewing(null), []);
  const isToday = practice.date === today;
  const key = `firstpass.offset.${practice.id}`;
  const [now, setNow] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0); // minutes the practice started late
  useEffect(() => {
    try {
      setOffset(Number(localStorage.getItem(key)) || 0);
    } catch {}
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [key]);
  const saveOffset = (m: number) => {
    setOffset(m);
    try {
      localStorage.setItem(key, String(m));
    } catch {}
  };

  const units = todayUnits(team, practice.attendance);
  const gc = units.length;
  const skaters = units.reduce((n, u) => n + u.skaters, 0);
  const start = toMin(practice.startTime) + (isToday ? offset : 0);
  let acc = 0;
  const spans: Span[] = practice.blocks.map((b) => {
    const s = start + acc;
    acc += blockMinutes(b, gc);
    return { b, s, e: start + acc };
  });
  const end = start + acc;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : null;
  const phase: Phase = practicePhase(practice.date, today, isToday ? nowMin : null, start, end);
  const fmt = (min: number) => clock(addMinutes('00:00', Math.round(min)));
  const left = (to: number) => {
    const secs = Math.max(0, Math.round((to - (nowMin ?? to)) * 60));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  // Before: the drill open beside the list on a computer (the first drill to start with).
  const firstDrill = practice.blocks.find((b) => b.kind !== 'activity')?.id ?? practice.blocks[0]?.id ?? null;
  const [selected, setSelected] = useState<string | null>(firstDrill);
  const sel = spans.find((x) => x.b.id === selected) ?? spans.find((x) => x.b.id === firstDrill);

  const day = new Date(practice.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  const eyebrow = phase === 'before' ? `Next practice · ${whenLabel(practice.date, today)}` : phase === 'during' ? (nowMin != null && nowMin < start ? 'Starting soon' : 'Practice now') : 'Practice done';
  const who = [
    `${fmt(start)}–${fmt(end)}`,
    practice.ice === 'half' ? 'Half ice' : 'Full ice',
    `${skaters} skaters in ${gc} group${gc === 1 ? '' : 's'}`,
    `${team.coachesOnIce} coach${team.coachesOnIce === 1 ? '' : 'es'} on the ice`,
    ...(isToday && offset !== 0 ? [`started ${offset} min late`] : []),
  ].join(' · ');

  const action = 'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border-100 bg-surface-100 px-3.5 text-sm font-medium hover:bg-surface-200';
  const header = (
    <header className={`flex flex-col gap-3 ${phase === 'before' ? 'lg:flex-row lg:items-end lg:justify-between' : ''}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold text-rink-100">{eyebrow}</p>
        <h1 className="font-display text-[28px] font-extrabold leading-8">{day}</h1>
        <p className="text-sm text-ink-200">{who}</p>
      </div>
      {phase === 'before' && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/plans/${practice.id}/print`} className={action}>
            {Icon.print(16)} Print
          </Link>
          <ShareControl practiceId={practice.id} initial={share} labelled />
          <Link href={`/plans/${practice.id}`} className={action}>
            {Icon.edit(16)} Edit the plan
          </Link>
        </div>
      )}
    </header>
  );

  const clockControls = isToday && phase !== 'after' && (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => now && saveOffset(Math.round(now.getHours() * 60 + now.getMinutes() - toMin(practice.startTime)))}
        className="min-h-11 rounded-full border border-border-100 px-4 text-sm hover:bg-surface-200"
      >
        Start the clock now
      </button>
      {offset !== 0 && (
        <button type="button" onClick={() => saveOffset(0)} className="min-h-11 rounded-full px-4 text-sm text-ink-200 hover:bg-surface-200">
          Back to {clock(practice.startTime)}
        </button>
      )}
    </div>
  );

  const open = viewing ? byId.get(viewing) : undefined;
  // On practice day the state isn't known until the clock is read, so the body waits a tick
  // rather than flashing the Before sheet at the rink.
  const waiting = isToday && now === null;

  let body: React.ReactNode = null;
  if (waiting) body = null;
  else if (phase === 'before')
    body = (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <ol className="flex flex-col gap-2" aria-label="The practice">
          {spans.map((x) => (
            <SheetRow
              key={x.b.id}
              span={x}
              byId={byId}
              known={knownSet}
              gc={gc}
              fmt={fmt}
              selected={x.b.id === sel?.b.id}
              onSelect={() => {
                // A computer opens it beside the list; a phone opens the drill's details.
                const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
                const id = drillOf(x.b);
                if (!wide && id && byId.get(id)) setViewing(id);
                else setSelected(x.b.id);
              }}
            />
          ))}
        </ol>
        {sel && (
          <aside aria-label="Drill details" className="hidden flex-col gap-3 rounded-xl border border-border-100 p-4 lg:sticky lg:top-6 lg:flex">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-xl font-bold">{title(sel.b, byId)}</h2>
              <p className="font-mono text-sm text-ink-200">
                {fmt(sel.s)} · {blockMinutes(sel.b, gc)} min
              </p>
            </div>
            <Detail block={sel.b} byId={byId} units={units} startMin={sel.s} nowMin={sel.s} fmt={fmt} prepare />
            {drillOf(sel.b) && byId.get(drillOf(sel.b)!) && (
              <button type="button" onClick={() => setViewing(drillOf(sel.b)!)} className="w-fit text-sm font-medium text-rink-100 hover:underline">
                All the details
              </button>
            )}
          </aside>
        )}
      </div>
    );
  else if (phase === 'during' && nowMin != null) {
    const cur = currentIndex(spans, nowMin);
    const x = spans[cur];
    const started = nowMin >= start;
    const up = upNextIndex(practice.blocks.map((b) => (b.kind === 'activity' ? { kind: b.kind, activity: b.activity, title: b.title } : { kind: b.kind })), cur);
    const nx = up >= 0 ? spans[up] : null;
    const pct = started && x ? Math.min(100, Math.max(0, ((nowMin - x.s) / (x.e - x.s)) * 100)) : 0;
    body = (
      <div className="flex flex-col gap-4">
        {x && (
          <section aria-label="Now" className="flex flex-col gap-3 rounded-xl border-2 border-rink-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-semibold text-rink-100">{started ? `Now · ${fmt(x.s)}–${fmt(x.e)}` : `First up · ${fmt(x.s)}`}</p>
                <h2 className="font-display text-[26px] font-extrabold leading-8">{title(x.b, byId)}</h2>
              </div>
              <p className="shrink-0 text-right">
                <span className="block font-mono text-[28px] font-semibold leading-8" role="timer">
                  {started ? left(x.e) : left(start)}
                </span>
                <span className="text-xs text-ink-200">{started ? 'left' : 'to the start'}</span>
              </p>
            </div>
            {started && (
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-300" aria-hidden="true">
                <div className="h-full rounded-full bg-rink-100" style={{ width: `${pct}%` }} />
              </div>
            )}
            {started && x.b.kind === 'rotation' && nowMin < x.e - x.b.minutes && (
              <p className="w-fit rounded-full bg-ink-100 px-3 py-1 font-mono text-sm text-surface-100">Whistle in {left(x.s + x.b.minutes * (Math.floor((nowMin - x.s) / x.b.minutes) + 1))}</p>
            )}
            <Detail block={x.b} byId={byId} units={units} startMin={x.s} nowMin={Math.max(nowMin, x.s)} fmt={fmt} />
          </section>
        )}
        {nx && (
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-200 px-4 py-3">
            <p className="text-xs font-semibold text-ink-200">Up next</p>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <b className="font-display text-lg">{title(nx.b, byId)}</b>
              <span className="font-mono text-sm text-ink-200">
                {fmt(nx.s)} · {blockMinutes(nx.b, gc)} min
              </span>
            </p>
          </div>
        )}
        {clockControls}
        <details className="group rounded-lg border border-border-100">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Whole practice
            <span aria-hidden="true" className="text-ink-200 transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <ol className="flex flex-col px-2 pb-2">
            {spans.map((y, i) => (
              <CompactRow key={y.b.id} span={y} byId={byId} gc={gc} fmt={fmt} done={nowMin >= y.e} now={i === cur && started} />
            ))}
          </ol>
        </details>
        <Link href={`/plans/${practice.id}`} className="w-fit min-h-11 content-center text-sm text-ink-200 hover:text-ink-100">
          Edit the plan
        </Link>
      </div>
    );
  } else
    body = (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-xl bg-surface-200 p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-bold">How did it go?</h2>
            <p className="text-sm text-ink-200">Check in on the practice. About 20 seconds, and it shapes the next plan.</p>
          </div>
          <Link href={`/plans/${practice.id}/check-in`} className="w-fit min-h-11 content-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
            Check in
          </Link>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">What you ran</h2>
          <ol className="flex flex-col">
            {spans.map((y) => (
              <CompactRow key={y.b.id} span={y} byId={byId} gc={gc} fmt={fmt} done={false} now={false} />
            ))}
          </ol>
          <Link href={`/plans/${practice.id}`} className="w-fit min-h-11 content-center text-sm text-ink-200 hover:text-ink-100">
            Open the plan
          </Link>
        </section>
      </div>
    );

  return (
    <OpenDrill.Provider value={setViewing}>
      <div className={`mx-auto flex w-full flex-col gap-5 ${phase === 'before' ? 'max-w-6xl' : 'max-w-xl'}`}>
        {header}
        {phase === 'before' && clockControls}
        {body}
        {open && (
          <DrillDrawer
            groupNames={groupLabels(team)}
            drill={open}
            from="/today"
            backLabel="Back to the practice"
            favorite={favs[open.id] ?? null}
            onFavorite={(f) =>
              setFavs((m) => {
                const n = { ...m };
                if (f) n[open.id] = f;
                else delete n[open.id];
                return n;
              })
            }
            onClose={closeDrill}
          />
        )}
      </div>
    </OpenDrill.Provider>
  );
}

/** The drill a block shows: its own, a rotation's, or an older rotation's first station drill. */
function drillOf(b: Block): string | null {
  if (b.kind === 'activity') return null;
  if (b.drillId) return b.drillId;
  if (b.kind === 'rotation') return b.stations.find((s) => s.drillId)?.drillId ?? null;
  return null;
}

/** Before: a drill with its diagram, name, one line and minutes; water, free skate and the huddle as thin rows. */
function SheetRow({ span, byId, known, gc, fmt, selected, onSelect }: { span: Span; byId: Map<string, Drill>; known: Set<string>; gc: number; fmt: (m: number) => string; selected: boolean; onSelect: () => void }) {
  const { b, s } = span;
  const mins = blockMinutes(b, gc);
  if (b.kind === 'activity')
    return (
      <li className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-1 text-sm text-ink-200">
        <span className="font-mono">{fmt(s)}</span>
        <span className="truncate">{b.title}</span>
        <span className="font-mono text-xs">{mins} min</span>
      </li>
    );
  const id = drillOf(b);
  const d = id ? byId.get(id) : undefined;
  const isNew = b.kind === 'rotation' && !b.drillId ? b.stations.some((x) => x.drillId && !known.has(x.drillId)) : !!id && !known.has(id);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`grid w-full grid-cols-[44px_96px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2 pr-3 text-left sm:grid-cols-[52px_132px_minmax(0,1fr)] sm:gap-4 ${selected ? 'lg:border-2 lg:border-rink-100 lg:p-[7px] lg:pr-[11px]' : ''} border-border-100 hover:bg-surface-200`}
      >
        <span className="self-start pt-1 font-mono text-sm">{fmt(s)}</span>
        <span className="grid aspect-[102/87] place-items-center overflow-hidden rounded-lg border border-border-100 bg-surface-100">
          {d ? <Rink spec={d.diagram as RinkDiagramProps} title={d.funName} detail="thumb" className="w-full" /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <b className="font-display text-lg leading-6">{title(b, byId)}</b>
          {d && <span className="line-clamp-2 text-sm text-ink-200 sm:line-clamp-1">{d.description}</span>}
          <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className="font-mono text-ink-200">{mins} min</span>
            {b.kind === 'stations' && <span className="text-ink-200">Stations</span>}
            {b.kind === 'rotation' && <span className="text-ink-200">Rotation</span>}
            {isNew && <span className="font-medium text-warn-text">New today: worth a look</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

/** During's whole practice and After's list: time, name, minutes. */
function CompactRow({ span, byId, gc, fmt, done, now }: { span: Span; byId: Map<string, Drill>; gc: number; fmt: (m: number) => string; done: boolean; now: boolean }) {
  const { b, s } = span;
  const id = drillOf(b);
  return (
    <li aria-current={now ? 'step' : undefined} className={`grid min-h-11 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 ${now ? 'bg-surface-200 font-semibold' : ''} ${done ? 'text-ink-200' : ''}`}>
      <span className="font-mono text-sm">{fmt(s)}</span>
      {id && byId.get(id) ? <DrillName id={id} name={title(b, byId)} small /> : <span className={b.kind === 'activity' ? 'text-sm text-ink-200' : 'font-display font-bold'}>{title(b, byId)}</span>}
      <span className="font-mono text-xs text-ink-200">{done ? 'Done' : `${blockMinutes(b, gc)} min`}</span>
    </li>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 self-center text-ink-200">
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

/** A station or zone's drill name: tap for its details. */
function DrillName({ id, name, small }: { id: string; name: string; small?: boolean }) {
  const openDrill = useOpenDrill();
  return (
    <button type="button" onClick={() => openDrill(id)} className={`inline-flex min-w-0 items-baseline gap-1 text-left font-display font-bold hover:underline ${small ? 'min-h-11 items-center text-[15px]' : 'text-base'}`}>
      {name}
      <Chevron />
    </button>
  );
}

function title(b: Block, byId: Map<string, Drill>) {
  if (b.kind === 'activity') return b.title;
  if (b.kind === 'rotation') return (b.drillId && byId.get(b.drillId)?.funName) || 'Rotation';
  return byId.get(b.drillId)?.funName ?? 'Drill';
}

/** A block's diagram, groups and cues. `prepare` (Before) adds the diagram's key and the set-up. */
function Detail({ block, byId, units, startMin, nowMin, fmt, prepare }: { block: Block; byId: Map<string, Drill>; units: Unit[]; startMin: number; nowMin: number; fmt: (m: number) => string; prepare?: boolean }) {
  if (block.kind === 'activity') return block.note ? <p className="pt-2 text-[15px]">{block.note}</p> : null;
  if (block.kind === 'drill' || block.kind === 'stations') {
    const d = byId.get(block.drillId);
    if (!d) return null;
    let spec = d.diagram as RinkDiagramProps;
    let groups: React.ReactNode = null;
    if (block.kind === 'drill' && levelCount(d) > 1) {
      // The whole group does the levels in order. Show the one that's on now, and when to switch.
      const lv = blockLevels(d, block);
      const mins = levelMinutes(block.minutes, lv.length);
      const starts = mins.map((_, i) => startMin + mins.slice(0, i).reduce((x, y) => x + y, 0));
      const now = Math.max(0, starts.findLastIndex((t) => nowMin >= t));
      spec = levelOf(d, lv[now]).diagram as RinkDiagramProps;
      groups = (
        <ol className="flex flex-col text-[15px]">
          {lv.map((n, i) => {
            const l = levelOf(d, n);
            return (
              <li key={n} className={`border-t border-border-100 py-1 ${i === now ? '' : 'text-ink-200'}`}>
                <span className="font-mono">{fmt(starts[i])}</span> · <b className={i === now ? '' : 'font-medium'}>Level {l.n}: {l.name}</b>
                {l.adds ? <span className="text-ink-200"> ({l.adds})</span> : null}
              </li>
            );
          })}
        </ol>
      );
    }
    if (block.kind === 'stations') {
      const who = (z: string) => units.filter((u, i) => zoneFor(d, u, block.zones, i) === z).map((u) => u.label).join(', ');
      if (d.diagram.stations?.layout === 'halfice') spec = { ...spec, unused: unusedZones(d, units, block.zones), stations: { ...d.diagram.stations, layout: 'halfice', groups: ZONES.map((z) => who(z) || '—') } };
      groups = (
        <ul className="flex flex-col text-[15px]">
          {(d.stations ?? [])
            .filter((s) => who(s.station))
            .map((s) => (
              <li key={s.station} className="border-t border-border-100 py-1">
                <b className="font-mono">{s.station}</b> · <b>{who(s.station)}</b> · {s.version}
              </li>
            ))}
        </ul>
      );
    }
    return (
      <div className="flex flex-col gap-2 pt-3">
        <Rink spec={spec} title={d.funName} />
        {prepare && <RinkLegend spec={spec} />}
        {groups}
        <p className="text-[15px]">{prepare ? d.description : d.steps.join(' ')}</p>
        {d.cues.map((c) => (
          <p key={c} className="font-display text-lg font-bold">
            {prepare && <span className="font-body text-sm font-semibold text-ink-200">Say: </span>}“{c}”
          </p>
        ))}
        {prepare && d.gear && !/^none\.?$/i.test(d.gear.trim()) && (
          <p className="text-sm">
            <b>Set up:</b> {d.gear}
          </p>
        )}
      </div>
    );
  }
  const { active, off } = rotationToday(block, units.length);
  const r = Math.min(active.length - 1, Math.max(0, Math.floor((nowMin - startMin) / block.minutes)));
  const rot = block.drillId ? byId.get(block.drillId) : undefined;
  if (rot)
    return (
      <div className="flex flex-col gap-3 pt-3">
        <p className="text-sm text-ink-200">
          Turn {r + 1} of {active.length}
          {r + 1 < active.length && ` · next whistle at ${fmt(startMin + block.minutes * (r + 1))}`} · everyone does every zone
        </p>
        <Rink spec={{ ...rot.diagram, unused: ZONES.filter((z) => !active.some((s) => s.station === z) || off.includes(z)) } as RinkDiagramProps} title={rot.funName} />
        <ul className="flex flex-col gap-2">
          {(rot.zones ?? [])
            .filter((z) => !off.includes(z.station))
            .map((z) => (
              <li key={z.station} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-border-100 pt-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{z.station}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <b className="font-display text-base">{z.name}</b>
                  <span className="text-sm">{z.how}</span>
                  <span className="text-sm font-semibold">“{z.cue}”</span>
                </div>
              </li>
            ))}
        </ul>
      </div>
    );
  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-sm text-ink-200">
        Turn {r + 1} of {active.length}
        {r + 1 < active.length && ` · next whistle at ${fmt(startMin + block.minutes * (r + 1))}`} · everyone does every zone
      </p>
      <ul className="flex flex-col gap-3">
        {active.map((s) => {
          const d = s.drillId ? byId.get(s.drillId) : undefined;
          return (
            <li key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-border-100 pt-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{s.station}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {d ? <DrillName id={d.id} name={d.funName} /> : <b className="font-display text-base">No drill</b>}
                  {s.coach && <span className="text-xs text-ink-200">{s.coach}</span>}
                </span>
                {d && <Rink spec={d.diagram} title={d.funName} detail="thumb" className="max-w-[260px]" />}
                {d && <span className="text-sm font-semibold">“{d.cues[0]}”</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
