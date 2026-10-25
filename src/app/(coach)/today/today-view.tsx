'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DrillDrawer, OpenDrill, useOpenDrill } from '@/components/drill-drawer';
import type { Favorite } from '@/lib/app/store';
import { Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { levelCount, levelOf } from '@/lib/drills/schema';
import { addMinutes, blockLevels, blockMinutes, clock, groupLabels, levelMinutes, rotationToday, todayUnits, unusedZones, zoneFor, ZONES, type Block, type Practice, type Team, type Unit } from '@/lib/plans/schema';
import type { RinkDiagramProps } from '../../../../design-system/index';

// The practice timeline on a phone at the rink: done blocks greyed, the current block open with a
// countdown (and the whistle for a rotation), upcoming blocks below. Adapted to who's here today.

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function TodayView({ practice, team, drills, favorites, isToday }: { practice: Practice; team: Team; drills: Drill[]; favorites: Record<string, Favorite>; isToday: boolean }) {
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  // Tap a drill for its full details in a sheet, without losing your place in the practice (decision 0015).
  const [viewing, setViewing] = useState<string | null>(null);
  const [favs, setFavs] = useState(favorites);
  const closeDrill = useCallback(() => setViewing(null), []);
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
  const start = toMin(practice.startTime) + offset;
  let acc = 0;
  const spans = practice.blocks.map((b) => {
    const s = start + acc;
    acc += blockMinutes(b, gc);
    return { b, s, e: start + acc };
  });
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : -1;
  const live = isToday && now !== null;
  const current = live ? spans.findIndex((x) => nowMin >= x.s && nowMin < x.e) : -1;
  const before = live && nowMin < start;
  const after = live && spans.length > 0 && nowMin >= spans[spans.length - 1].e;
  const fmt = (min: number) => clock(addMinutes('00:00', Math.round(min)));
  const left = (end: number) => {
    const secs = Math.max(0, Math.round((end - nowMin) * 60));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  const open = viewing ? byId.get(viewing) : undefined;
  return (
    <OpenDrill.Provider value={setViewing}>
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-8">{isToday ? 'Today' : new Date(practice.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
        <p className="text-sm text-ink-200">
          {fmt(start)}–{fmt(start + acc)} · {practice.ice === 'half' ? 'Half ice' : 'Full ice'}
          {offset !== 0 && ` · started ${offset} min late`}
        </p>
        {isToday && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => now && saveOffset(Math.round(now.getHours() * 60 + now.getMinutes() - toMin(practice.startTime)))}
              className="min-h-9 rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200"
            >
              Start the clock now
            </button>
            {offset !== 0 && (
              <button type="button" onClick={() => saveOffset(0)} className="min-h-9 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200">
                Back to {clock(practice.startTime)}
              </button>
            )}
          </div>
        )}
        {before && <p className="pt-1 font-display text-lg font-bold">Starts in {left(start)}</p>}
        {after && (
          <div className="mt-1 flex flex-wrap items-center gap-3 rounded-md bg-surface-200 px-4 py-3">
            <p className="text-[15px]">
              <b>That&apos;s practice.</b> How did it go?
            </p>
            <Link href={`/plans/${practice.id}/check-in`} className="ml-auto min-h-11 rounded-full bg-rink-100 px-5 py-2.5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
              Check in
            </Link>
          </div>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {spans.map(({ b, s, e }, i) => {
          const done = live && nowMin >= e;
          const isNow = i === current || (before && i === 0) || (!live && i === 0);
          return (
            <li
              key={b.id}
              aria-current={i === current ? 'step' : undefined}
              className={`rounded-md border p-3 ${i === current ? 'border-2 border-rink-100' : 'border-border-100'} ${done ? 'opacity-50' : ''}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="w-12 font-mono text-sm">{fmt(s)}</span>
                {b.kind !== 'activity' && b.drillId && byId.get(b.drillId) ? (
                  <button type="button" onClick={() => setViewing(b.drillId!)} className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left font-display text-lg font-bold hover:underline">
                    <span className="min-w-0">{title(b, byId)}</span>
                    <Chevron />
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 font-display text-lg font-bold">{title(b, byId)}</span>
                )}
                {done && <span className="text-xs font-semibold text-ink-200">Done</span>}
                {i === current && (
                  <span className="rounded-full bg-rink-100 px-2 py-0.5 font-mono text-xs text-surface-100">
                    {b.kind === 'rotation' && nowMin < e - b.minutes ? `Whistle in ${left(s + b.minutes * (Math.floor((nowMin - s) / b.minutes) + 1))}` : `Now · ${left(e)}`}
                  </span>
                )}
                {!done && i !== current && <span className="font-mono text-xs text-ink-200">{blockMinutes(b, gc)} min</span>}
              </div>
              {isNow && <Detail block={b} byId={byId} units={units} startMin={s} nowMin={live ? nowMin : s} fmt={fmt} />}
            </li>
          );
        })}
      </ol>
      <Link href={`/plans/${practice.id}`} className="w-fit text-sm text-ink-200 hover:text-ink-100">
        Edit this plan
      </Link>
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

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 self-center text-ink-200">
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

/** A station or zone's drill name: tap for its details. */
function DrillName({ id, name }: { id: string; name: string }) {
  const openDrill = useOpenDrill();
  return (
    <button type="button" onClick={() => openDrill(id)} className="inline-flex items-baseline gap-1 text-left font-display text-base font-bold hover:underline">
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

function Detail({ block, byId, units, startMin, nowMin, fmt }: { block: Block; byId: Map<string, Drill>; units: Unit[]; startMin: number; nowMin: number; fmt: (m: number) => string }) {
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
        {groups}
        <p className="text-[15px]">{d.steps.join(' ')}</p>
        {d.cues.map((c) => (
          <p key={c} className="font-display text-lg font-bold">
            “{c}”
          </p>
        ))}
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
