'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pips, Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { levelFor, rotationToday, unusedZones, zoneFor, ZONES, type DrillBlock, type RotationBlock, type StationsBlock, type Unit, type Zone } from '@/lib/plans/schema';
import type { RinkDiagramProps } from '../../../../../design-system/index';
import { Badge } from './parts';

// What each kind of block shows under its title.

export function DrillCard({ drill, isNew }: { drill?: Drill; isNew: boolean }) {
  if (!drill) return <p className="text-sm text-flag-100">This drill isn&apos;t live any more. Swap it for another.</p>;
  const main = drill.focus.filter((f) => f.level === 2);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
      <Link href={`/drills/${drill.id}`} aria-label={`Open ${drill.funName}`} className="max-w-[260px]">
        <Rink spec={drill.diagram} title={drill.funName} detail="thumb" className="rounded-sm border border-border-100" />
      </Link>
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

/** A drill with levels: easiest to hardest, each level's diagram and the groups doing it today. */
export function Ladder({ block, drill, units, onLevel }: { block: DrillBlock; drill: Drill; units: Unit[]; onLevel: (unitKey: string, level: string) => void }) {
  const [edit, setEdit] = useState(false);
  const levels = drill.levels ?? [];
  const at = (lv: string) => units.filter((u) => levelFor(drill, u, block.levels) === lv);
  const merged = units.some((u) => u.groups.length > 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-ink-200" aria-hidden="true">
        <span>Easier</span>
        <span className="h-0 flex-1 border-t border-border-100" />
        <span>Harder</span>
      </div>
      <ol className="-mx-4 grid snap-x auto-cols-[160px] grid-flow-col gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:overflow-visible sm:px-0">
        {levels.map((l) => {
          const here = at(l.level);
          return (
            <li key={l.level} className={`flex min-w-0 snap-start flex-col gap-2 ${here.length ? '' : 'opacity-55'}`}>
              <Rink spec={l.diagram as RinkDiagramProps} title={`${drill.funName} ${l.level}`} detail="thumb" className="max-w-[240px] rounded-sm border border-border-100" />
              <span className="flex flex-col">
                <span className="font-mono text-xs font-medium text-rink-100">{l.level}</span>
                <b className="text-sm leading-5">{l.name}</b>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {here.length ? (
                  here.map((u) => (
                    <span key={u.key} className="inline-flex h-7 items-center rounded-full border border-ink-100 px-2.5 text-[13px] font-semibold">
                      {u.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-ink-200">No group today</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {edit ? (
        <div className="flex flex-wrap items-center gap-2">
          {units.map((u) => (
            <label key={u.key} className="inline-flex items-center gap-2 rounded-full border border-border-100 py-1 pl-3 pr-1 text-sm">
              <b>{u.label}</b>
              <select aria-label={`Level for ${u.label}`} value={levelFor(drill, u, block.levels) ?? ''} onChange={(e) => onLevel(u.key, e.target.value)} className="rounded-full bg-surface-200 px-2 py-1 font-mono text-[13px]">
                {levels.map((l) => (
                  <option key={l.level} value={l.level}>
                    {l.level} {l.name}
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
        <p className="text-xs text-ink-200">
          {merged ? 'A merged group starts at the easier level. ' : 'Same course for everyone; each group at its level. '}
          <button type="button" onClick={() => setEdit(true)} className="text-rink-100 hover:underline">
            Change levels
          </button>
        </p>
      )}
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

/** Everyone does every station. One map of the half, a drill per station; no "who starts where". */
export function RotationCard({
  block,
  byId,
  known,
  groupCount,
  onPick,
  onUseInstead,
  onAddStation,
  onRemoveStation,
}: {
  block: RotationBlock;
  byId: Map<string, Drill>;
  known: Set<string>;
  groupCount: number;
  onPick: (i: number) => void;
  onUseInstead: (z: Zone) => void;
  onAddStation: () => void;
  onRemoveStation: (i: number) => void;
}) {
  const { active, off } = rotationToday(block, groupCount);
  const name = (id: string | null) => (id ? (byId.get(id)?.funName ?? 'Drill not live') : 'No drill yet');
  const letters = block.stations.map((s) => s.station);
  const spec: RinkDiagramProps = {
    scope: 'half',
    side: 'left',
    stations: { layout: 'halfice', labels: ZONES.map((z) => (letters.includes(z) ? name(block.stations.find((s) => s.station === z)!.drillId) : '')) },
    unused: ZONES.filter((z) => !letters.includes(z) || off.includes(z)),
  };
  const lastActive = active[active.length - 1]?.station;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <Rink spec={spec} title={`Rotation: ${active.map((s) => `${name(s.drillId)} at ${s.station}`).join(', ')}`} detail="thumb" className="max-w-[260px] rounded-sm border border-border-100" />
      <div className="flex min-w-0 flex-col">
        {block.stations.map((s, i) => {
          const d = s.drillId ? byId.get(s.drillId) : undefined;
          const isOff = off.includes(s.station);
          return (
            <div key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border-100 py-2 text-sm">
              <Badge zone={s.station} dim={isOff} />
              <span className={`flex min-w-0 flex-col ${isOff ? 'opacity-50' : ''}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <b className={isOff ? 'line-through' : ''}>{name(s.drillId)}</b>
                  {s.drillId && !known.has(s.drillId) && <span className="rounded-full border border-whistle-100 px-1.5 text-[11px] font-semibold text-whistle-100">New</span>}
                </span>
                <span className="text-xs text-ink-200">{isOff ? `Not used today (${groupCount} group${groupCount === 1 ? '' : 's'})` : (d?.plainName ?? '')}</span>
              </span>
              <span className="flex items-center gap-1">
                {isOff && lastActive ? (
                  <button type="button" onClick={() => onUseInstead(lastActive)} className="min-h-9 rounded-full px-2.5 text-[13px] text-rink-100 hover:bg-surface-200">
                    Use instead of {lastActive}
                  </button>
                ) : (
                  <button type="button" onClick={() => onPick(i)} className="min-h-9 rounded-full px-2.5 text-[13px] text-rink-100 hover:bg-surface-200">
                    {s.drillId ? 'Change' : 'Choose a drill'}
                  </button>
                )}
                {block.stations.length > 2 && (
                  <button type="button" aria-label={`Remove station ${s.station}`} onClick={() => onRemoveStation(i)} className="h-9 w-9 rounded-full text-ink-200 hover:bg-surface-200">
                    ×
                  </button>
                )}
              </span>
            </div>
          );
        })}
        <p className="flex flex-wrap items-center gap-x-3 border-t border-border-100 pt-2 text-xs text-ink-200">
          <span>Everyone does every station. Whistle every {block.minutes} min; you pick who starts where.</span>
          {block.stations.length < 3 && (
            <button type="button" onClick={onAddStation} className="text-rink-100 hover:underline">
              + Add a station
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
