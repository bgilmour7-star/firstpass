'use client';

import { useState } from 'react';
import { Pips, Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { levelCount, levelOf } from '@/lib/drills/schema';
import { blockLevels, levelMinutes, rotationToday, unusedZones, zoneFor, ZONES, type DrillBlock, type RotationBlock, type StationsBlock, type Unit, type Zone } from '@/lib/plans/schema';
import type { RinkDiagramProps } from '../../../../../design-system/index';
import { Badge } from './parts';
import { useOpenDrill } from '@/components/drill-drawer';

// What each kind of block shows under its title.

export function DrillCard({ drill, isNew }: { drill?: Drill; isNew: boolean }) {
  if (!drill) return <p className="text-sm text-flag-100">This drill isn&apos;t live any more. Swap it for another.</p>;
  const main = drill.focus.filter((f) => f.level === 2);
  return <DrillCardBody drill={drill} isNew={isNew} main={main} />;
}

function DrillCardBody({ drill, isNew, main }: { drill: Drill; isNew: boolean; main: Drill['focus'] }) {
  const openDrill = useOpenDrill();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
      <button type="button" onClick={() => openDrill(drill.id)} aria-label={`Open ${drill.funName}`} className="max-w-[260px] cursor-zoom-in">
        <Rink spec={drill.diagram} title={drill.funName} detail="thumb" className="rounded-sm border border-border-100" />
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        {isNew && <span className="w-fit rounded-full border border-whistle-100 px-2 py-0.5 text-xs font-semibold text-whistle-100">New</span>}
        <span className="flex flex-wrap gap-x-3 text-xs">
          {main.map((f) => (
            <span key={f.attribute} className="inline-flex items-center gap-1.5 font-semibold">
              <Pips level={2} /> {f.attribute}
            </span>
          ))}
        </span>
        <span className="text-sm">“{drill.cues[0]}”</span>
      </div>
    </div>
  );
}

/**
 * A drill with added levels. Each level is a switch: the whole group does the levels that are on,
 * in order, easiest first, splitting the block's minutes (decision 0006). Levels that are on show
 * their diagram; the others are compact stubs. On a phone the levels that are on come first.
 */
export function LevelPicker({ block, drill, onLevels, suggested }: { block: DrillBlock; drill: Drill; onLevels: (levels: number[]) => void; /** A level the check-in suggests adding (decision 0022). */ suggested?: number }) {
  const on = blockLevels(drill, block);
  const mins = levelMinutes(block.minutes, on.length);
  const all = Array.from({ length: levelCount(drill) }, (_, i) => levelOf(drill, i + 1));
  const what = (l: (typeof all)[number]) => (l.n === 1 ? 'As written.' : `Adds: ${l.adds}`);
  const toggle = (n: number) => {
    const next = on.includes(n) ? on.filter((x) => x !== n) : [...on, n].sort((x, y) => x - y);
    if (next.length) onLevels(next);
  };
  const tick = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5l2.6 2.6L11 4.5" />
    </svg>
  );
  return (
    <div role="group" aria-label={`Levels of ${drill.funName}`} className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-stretch sm:gap-4">
      {all.map((l) => {
        const i = on.indexOf(l.n);
        if (i >= 0) {
          const last = on.length === 1;
          return (
            <button
              key={l.n}
              type="button"
              role="checkbox"
              aria-checked="true"
              aria-disabled={last || undefined}
              aria-label={`Level ${l.n}, ${l.name}: on, ${mins[i]} minutes${last ? '. At least one level stays on' : ''}`}
              onClick={() => toggle(l.n)}
              className={`relative order-first flex flex-col gap-2 rounded-md border-2 border-rink-100 bg-surface-100 p-1.5 text-left sm:order-none sm:w-[212px] ${last ? 'col-span-2 cursor-default' : ''}`}
            >
              <Rink spec={l.diagram as RinkDiagramProps} title={`${drill.funName} level ${l.n}`} detail="thumb" className="w-full rounded-sm" />
              <span aria-hidden="true" className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-rink-100 text-surface-100">
                {tick}
              </span>
              <span className="flex items-baseline gap-2 px-1">
                <span className="font-mono text-[13px] font-medium text-rink-100">{l.n}</span>
                <b className="text-[15px] font-semibold leading-5">{l.name}</b>
              </span>
              <span className="pl-[25px] pr-1 text-[13px] leading-[18px] text-ink-200 sm:min-h-[54px]">{what(l)}</span>
              <span className="mt-auto pb-1 pl-[25px] font-mono text-[12px] text-ink-100">
                {on.length > 1 ? `${i === 0 ? 'First' : 'Then'} · ` : ''}
                {mins[i]} min
              </span>
            </button>
          );
        }
        return (
          <button
            key={l.n}
            type="button"
            role="checkbox"
            aria-checked="false"
            aria-label={`Level ${l.n}, ${l.name}: off${suggested === l.n ? ', suggested' : ''}`}
            onClick={() => toggle(l.n)}
            className={`relative flex min-h-[88px] flex-col gap-1 rounded-md border-[1.5px] border-dashed bg-surface-200 p-3 text-left hover:border-rink-100 sm:w-[148px] sm:gap-2 ${suggested === l.n ? 'border-whistle-100' : 'border-ink-200'}`}
          >
            {suggested === l.n && (
              <span aria-hidden="true" className="absolute -top-2.5 left-2 rounded-full bg-whistle-100 px-2 text-[11px] font-semibold leading-5 text-surface-100">
                Suggested
              </span>
            )}
            <span aria-hidden="true" className="absolute right-3 top-3 h-6 w-6 rounded-md border-2 border-ink-200" />
            <span className="font-mono text-[13px] font-medium text-rink-100">Level {l.n}</span>
            <b className="pr-6 text-[15px] font-semibold leading-5">{l.name}</b>
            <span className="hidden text-[13px] leading-[18px] text-ink-200 sm:block">{what(l)}</span>
            <span className="mt-auto hidden text-sm font-medium text-rink-100 sm:block">+ Add this level</span>
          </button>
        );
      })}
    </div>
  );
}

/** One drill, one diagram: each group at its own station; stations nobody needs today are greyed out. */
export function StationsCard({ block, drill, units, onZone }: { block: StationsBlock; drill: Drill; units: Unit[]; onZone: (unitKey: string, z: Zone) => void }) {
  const [edit, setEdit] = useState(false);
  const who = new Map<Zone, Unit[]>();
  units.forEach((u, i) => {
    const z = zoneFor(drill, u, block.zones, i);
    who.set(z, [...(who.get(z) ?? []), u]);
  });
  const unused = unusedZones(drill, units, block.zones);
  const version = (z: Zone) => drill.stations?.find((s) => s.station === z)?.version ?? '';
  const halfIce = drill.diagram.stations?.layout === 'halfice';
  const spec = {
    ...drill.diagram,
    ...(halfIce ? { unused, stations: { ...drill.diagram.stations, groups: ZONES.map((z) => (who.get(z) ?? []).map((u) => u.label).join(', ') || '—') } } : {}),
  } as RinkDiagramProps;
  const merged = units.find((u) => u.groups.length > 1);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <Rink spec={spec} title={`${drill.funName}: ${units.length} groups today`} detail="thumb" className="max-w-[260px] rounded-sm border border-border-100" />
      <div className="flex min-w-0 flex-col">
        {ZONES.filter((z) => drill.stations?.some((s) => s.station === z)).map((z) => {
          const here = who.get(z) ?? [];
          return (
            <div key={z} className={`grid grid-cols-[28px_minmax(0,140px)_minmax(0,1fr)] items-baseline gap-2.5 border-t border-border-100 py-2 text-sm ${here.length ? '' : 'opacity-50'}`}>
              <Badge zone={z} dim={!here.length} />
              <b className="truncate">{here.map((u) => u.label).join(', ') || '—'}</b>
              <span>{here.length ? version(z) : 'Not used today'}</span>
            </div>
          );
        })}
        {edit ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {units.map((u, i) => (
              <label key={u.key} className="inline-flex items-center gap-2 rounded-full border border-border-100 py-1 pl-3 pr-1 text-sm">
                <b>{u.label}</b>
                <select aria-label={`Station for ${u.label}`} value={zoneFor(drill, u, block.zones, i)} onChange={(e) => onZone(u.key, e.target.value as Zone)} className="rounded-full bg-surface-200 px-2 py-1 font-mono text-[13px]">
                  {(drill.stations ?? []).map((s) => (
                    <option key={s.station} value={s.station}>
                      {s.station} · {s.version}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" onClick={() => setEdit(false)} className="min-h-9 rounded-full px-3 text-sm text-rink-100 hover:bg-surface-200">
              Done
            </button>
          </div>
        ) : (
          <p className="pt-2 text-xs text-ink-200">
            {merged ? `${merged.label} play the ${merged.groups[0]} station. ` : 'All at once, each group at its own station. '}
            <button type="button" onClick={() => setEdit(true)} className="text-rink-100 hover:underline">
              Change
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A rotation is one rotation drill: its zones, one map of the half, everyone does every zone.
 * No "who starts where": the coach decides on the ice. Older rotations built from single drills
 * still show, with a nudge to swap for a rotation drill.
 */
export function RotationCard({
  block,
  drill,
  byId,
  known,
  groupCount,
  onChoose,
  onUseInstead,
}: {
  block: RotationBlock;
  drill?: Drill;
  byId: Map<string, Drill>;
  known: Set<string>;
  groupCount: number;
  onChoose: () => void;
  onUseInstead: (z: Zone) => void;
}) {
  const { active, off } = rotationToday(block, groupCount);
  const letters = block.stations.map((s) => s.station);
  const lastActive = active[active.length - 1]?.station;
  const old = !block.drillId && block.stations.some((s) => s.drillId);
  if (!drill && !old)
    return (
      <button type="button" onClick={onChoose} className="flex w-fit items-center gap-2 rounded-full border border-dashed border-rink-100 px-4 py-2 text-sm font-medium text-rink-100 hover:bg-surface-200">
        Choose a rotation: zones and activities ready to go
      </button>
    );
  const zoneName = (z: Zone) => (drill ? (drill.zones?.find((x) => x.station === z)?.name ?? '') : (byId.get(block.stations.find((s) => s.station === z)?.drillId ?? '')?.funName ?? 'No drill'));
  const spec: RinkDiagramProps = drill
    ? ({ ...drill.diagram, unused: ZONES.filter((z) => !letters.includes(z) || off.includes(z)) } as RinkDiagramProps)
    : { scope: 'half', side: 'left', stations: { layout: 'halfice', labels: ZONES.map((z) => (letters.includes(z) ? zoneName(z) : '')) }, unused: ZONES.filter((z) => !letters.includes(z) || off.includes(z)) };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <Rink spec={spec} title={`${drill?.funName ?? 'Rotation'}: ${active.map((s) => `${zoneName(s.station)} at ${s.station}`).join(', ')}`} detail="thumb" className="max-w-[260px] rounded-sm border border-border-100" />
      <div className="flex min-w-0 flex-col">
        {block.stations.map((s) => {
          const isOff = off.includes(s.station);
          const z = drill?.zones?.find((x) => x.station === s.station);
          const single = !drill && s.drillId ? byId.get(s.drillId) : undefined;
          return (
            <div key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border-100 py-2 text-sm">
              <Badge zone={s.station} dim={isOff} />
              <span className={`flex min-w-0 flex-col ${isOff ? 'opacity-50' : ''}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <b className={isOff ? 'line-through' : ''}>{zoneName(s.station)}</b>
                  {single && !known.has(single.id) && <span className="rounded-full border border-whistle-100 px-1.5 text-[11px] font-semibold text-whistle-100">New</span>}
                </span>
                <span className="text-xs text-ink-200">{isOff ? `Not used today (${groupCount} group${groupCount === 1 ? '' : 's'})` : (z?.how ?? single?.plainName ?? '')}</span>
              </span>
              {isOff && lastActive && (
                <button type="button" onClick={() => onUseInstead(lastActive)} className="min-h-9 rounded-full px-2.5 text-[13px] text-rink-100 hover:bg-surface-200">
                  Use instead of {lastActive}
                </button>
              )}
            </div>
          );
        })}
        <p className="border-t border-border-100 pt-2 text-xs text-ink-200">Everyone does every zone. Whistle every {block.minutes} min; you pick who starts where.</p>
        {old && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 rounded-md bg-surface-200 px-3 py-2 text-xs">
            Built from single drills, before rotation drills.
            <button type="button" onClick={onChoose} className="font-medium text-rink-100 hover:underline">
              Swap for a rotation drill
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
