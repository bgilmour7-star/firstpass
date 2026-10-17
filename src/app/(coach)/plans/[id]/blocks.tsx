'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pips, Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { levelCount, levelOf } from '@/lib/drills/schema';
import { levelsInPlay, levelsToday, rotationToday, unusedZones, zoneFor, ZONES, type DrillBlock, type RotationBlock, type StationsBlock, type Unit, type Zone } from '@/lib/plans/schema';
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

/**
 * A drill with added levels. The coach picks which levels are in play in this block: one for
 * everyone, or several spread over today's groups (easiest group on the easiest level).
 */
export function Ladder({
  block,
  drill,
  units,
  onLevel,
  onUse,
}: {
  block: DrillBlock;
  drill: Drill;
  units: Unit[];
  onLevel: (unitKey: string, level: number) => void;
  onUse: (use: number[]) => void;
}) {
  const [edit, setEdit] = useState(false);
  const all = Array.from({ length: levelCount(drill) }, (_, i) => levelOf(drill, i + 1));
  const play = levelsInPlay(drill, block);
  const today = levelsToday(drill, block, units);
  const at = (n: number) => units.filter((u) => today.get(u.key) === n);
  function toggle(n: number) {
    const next = play.includes(n) ? play.filter((x) => x !== n) : [...play, n].sort((a, b) => a - b);
    if (!next.length) return;
    // Every level in play is the default; store it as "all" so new levels added later show up.
    onUse(next.length === all.length ? [] : next);
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-200">Levels in play</span>
        <div role="group" aria-label="Levels in play" className="flex flex-wrap gap-1.5">
          {all.map((l) => {
            const on = play.includes(l.n);
            return (
              <button
                key={l.n}
                type="button"
                aria-pressed={on}
                disabled={on && play.length === 1}
                title={on && play.length === 1 ? 'At least one level stays in play' : undefined}
                onClick={() => toggle(l.n)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${on ? 'border-rink-100 bg-rink-100 font-semibold text-surface-100' : 'border-border-100 text-ink-200 hover:bg-surface-200'} disabled:cursor-default`}
              >
                <span aria-hidden="true">{on ? '✓' : '+'}</span>
                <span className="font-mono">{l.n}</span>
                <span className="max-w-[16ch] truncate">{l.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ol className="-mx-4 grid snap-x auto-cols-[160px] grid-flow-col gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:overflow-visible sm:px-0">
        {all.map((l) => {
          const on = play.includes(l.n);
          const here = at(l.n);
          return (
            <li key={l.n} className={`flex min-w-0 snap-start flex-col gap-2 ${on ? '' : 'opacity-45'}`}>
              <Rink spec={l.diagram as RinkDiagramProps} title={`${drill.funName} level ${l.n}`} detail="thumb" className="max-w-[240px] rounded-sm border border-border-100" />
              <span className="flex flex-col">
                <span className="font-mono text-xs font-medium text-rink-100">Level {l.n}</span>
                <b className="text-sm leading-5">{l.name}</b>
                {l.adds && <span className="text-xs text-ink-200">Adds: {l.adds}</span>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {!on ? (
                  <span className="text-[13px] text-ink-200">Not in play</span>
                ) : here.length ? (
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
      {play.length === 1 ? (
        <p className="text-xs text-ink-200">Everyone does level {play[0]}.</p>
      ) : edit ? (
        <div className="flex flex-wrap items-center gap-2">
          {units.map((u) => (
            <label key={u.key} className="inline-flex items-center gap-2 rounded-full border border-border-100 py-1 pl-3 pr-1 text-sm">
              <b>{u.label}</b>
              <select aria-label={`Level for ${u.label}`} value={today.get(u.key) ?? play[0]} onChange={(e) => onLevel(u.key, Number(e.target.value))} className="rounded-full bg-surface-200 px-2 py-1 font-mono text-[13px]">
                {play.map((n) => (
                  <option key={n} value={n}>
                    {n} {levelOf(drill, n).name}
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
          Easiest group on the easiest level.{' '}
          <button type="button" onClick={() => setEdit(true)} className="text-rink-100 hover:underline">
            Change who does which
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
