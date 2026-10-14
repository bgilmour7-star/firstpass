'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pips, Rink } from '@/components/ds';
import { FOCUS_ATTRIBUTES, type Drill } from '@/lib/drills/schema';
import {
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  blockMinutes,
  clock,
  addMinutes,
  newId,
  practiceFocus,
  rotation,
  startTimes,
  totalMinutes,
  type Block,
  type Practice,
  type Team,
} from '@/lib/plans/schema';
import { deletePractice, savePractice, shareWithParents, stopSharing } from '../actions';

type Picker = { mode: 'add'; at: number } | { mode: 'swap'; blockId: string } | { mode: 'station'; blockId: string; station: number };

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

export function Builder({ initial, team, drills, known, copiedFrom, initialShare }: { initial: Practice; team: Team; drills: Drill[]; known: string[]; copiedFrom: string | null; initialShare: { token: string; expiresAt: string } | null }) {
  const [plan, setPlan] = useState<Practice>(initial);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  const knownSet = useMemo(() => new Set(known), [known]);

  // Autosave, debounced: a coach never loses a plan to a forgotten Save button.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      start(async () => {
        const r = await savePractice(plan);
        if (r.ok) setSaveState('saved');
        else {
          setSaveState('error');
          setSaveError(r.error);
        }
      });
    }, 700);
    return () => clearTimeout(t);
  }, [plan]);

  const blocks = plan.blocks;
  const times = startTimes(plan.startTime, blocks);
  const used = totalMinutes(blocks);
  const over = used - plan.minutes;
  const focus = practiceFocus(blocks, byId);
  const groups = team.groups.map((g) => g.group);
  const inPlan = new Set(blocks.flatMap((b) => (b.kind === 'drill' ? [b.drillId] : b.kind === 'stations' ? b.stations.map((s) => s.drillId ?? '') : [])));
  const fresh = [...inPlan].filter((d) => d && !knownSet.has(d));
  const gear = [...new Set([...inPlan].map((d) => byId.get(d)?.gear).filter((g): g is string => !!g && g !== 'None'))];

  const setBlocks = (f: (b: Block[]) => Block[]) => setPlan((p) => ({ ...p, blocks: f(p.blocks) }));
  const update = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const c = [...bs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const remove = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));
  const duplicate = (i: number) => setBlocks((bs) => [...bs.slice(0, i + 1), { ...structuredClone(bs[i]), id: newId() }, ...bs.slice(i + 1)]);
  const insert = (at: number, b: Block) => setBlocks((bs) => [...bs.slice(0, at), b, ...bs.slice(at)]);

  function addActivity(at: number, kind: (typeof ACTIVITY_KINDS)[number]) {
    insert(at, { id: newId(), kind: 'activity', activity: kind, title: ACTIVITY_LABEL[kind], minutes: kind === 'water' ? 3 : 5, note: '' });
  }
  function addStations(at: number) {
    const n = Math.min(3, Math.max(2, team.coachesOnIce));
    insert(at, { id: newId(), kind: 'stations', minutes: 8, stations: (['A', 'B', 'C'] as const).slice(0, n).map((station) => ({ station, drillId: null, coach: '' })) });
  }
  function pick(drillId: string) {
    if (!picker) return;
    const d = byId.get(drillId);
    if (picker.mode === 'add') insert(picker.at, { id: newId(), kind: 'drill', drillId, minutes: d?.minutes ?? 8 });
    if (picker.mode === 'swap') update(picker.blockId, { drillId } as Partial<Block>);
    if (picker.mode === 'station')
      setBlocks((bs) => bs.map((b) => (b.id === picker.blockId && b.kind === 'stations' ? { ...b, stations: b.stations.map((s, i) => (i === picker.station ? { ...s, drillId } : s)) } : b)));
    setPicker(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: the practice itself */}
      <div className="flex flex-col gap-3">
        <Link href="/plans" className="w-fit text-sm text-ink-200 hover:text-ink-100">
          ← All plans
        </Link>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0 flex-[1_1_320px]">
            <h1 className="text-[28px] font-extrabold leading-8">{day(plan.date)}</h1>
            <p className="text-sm text-ink-200">
              {team.name} · {clock(plan.startTime)}–{clock(addMinutes(plan.startTime, plan.minutes))} · {plan.ice === 'half' ? 'Half ice' : 'Full ice'}
              {copiedFrom && <> · Copied from {new Date(copiedFrom + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-live="polite" className={`text-xs ${saveState === 'error' ? 'text-flag-100' : 'text-ink-200'}`}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : `Not saved: ${saveError}`}
            </span>
            <div role="group" aria-label="Plan status" className="inline-flex rounded-full border border-border-100 p-0.5">
              {(['draft', 'ready', 'done'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={plan.status === s}
                  onClick={() => setPlan((p) => ({ ...p, status: s }))}
                  className={`min-h-9 rounded-full px-3 text-sm ${plan.status === s ? 'bg-ink-100 text-surface-100' : 'text-ink-200 hover:bg-surface-200'}`}
                >
                  {s === 'draft' ? 'Draft' : s === 'ready' ? 'Ready' : 'Done'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/plans/${plan.id}/print`} className="inline-flex min-h-9 items-center rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200">
            Printout
          </Link>
          <Link href={`/today?plan=${plan.id}`} className="inline-flex min-h-9 items-center rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200">
            Rink-side view
          </Link>
          <ShareControl practiceId={plan.id} initial={initialShare} />
        </div>
        <details className="text-sm">
          <summary className="w-fit cursor-pointer text-ink-200 hover:text-ink-100">Date, time and ice</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Date">
              <input type="date" className={input} value={plan.date} onChange={(e) => e.target.value && setPlan((p) => ({ ...p, date: e.target.value }))} />
            </Field>
            <Field label="Start">
              <input type="time" step={300} className={input} value={plan.startTime} onChange={(e) => e.target.value && setPlan((p) => ({ ...p, startTime: e.target.value.slice(0, 5) }))} />
            </Field>
            <Field label="Ice time (min)">
              <input type="number" min={20} max={120} step={5} className={`${input} w-24 font-mono`} value={plan.minutes} onChange={(e) => setPlan((p) => ({ ...p, minutes: Math.min(120, Math.max(20, Number(e.target.value) || 60)) }))} />
            </Field>
            <Field label="Ice">
              <select className={input} value={plan.ice} onChange={(e) => setPlan((p) => ({ ...p, ice: e.target.value as Practice['ice'] }))}>
                <option value="half">Half ice</option>
                <option value="full">Full ice</option>
              </select>
            </Field>
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <span>Delete this plan?</span>
                <button type="button" onClick={() => deletePractice(plan.id)} className="min-h-9 rounded-full bg-flag-100 px-3 text-surface-100">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-9 rounded-full px-3 hover:bg-surface-200">
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-9 rounded-full px-3 text-flag-100 hover:bg-surface-200">
                Delete plan
              </button>
            )}
          </div>
        </details>
      </div>

      {over > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-flag-100 px-4 py-3 text-sm">
          <b>
            Runs {over} min over the ice time ({used} of {plan.minutes}).
          </b>
          <span className="text-ink-200">Trim:</span>
          {blocks
            .filter((b) => b.kind !== 'stations' && b.minutes > 3)
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 3)
            .map((b) => {
              const cut = Math.min(over, b.minutes - 3);
              const name = b.kind === 'drill' ? (byId.get(b.drillId)?.funName ?? 'Drill') : b.kind === 'activity' ? b.title : '';
              return (
                <button key={b.id} type="button" onClick={() => update(b.id, { minutes: b.minutes - cut })} className="min-h-9 rounded-full border border-border-100 px-3 hover:bg-surface-200">
                  {name} {b.minutes} → {b.minutes - cut}
                </button>
              );
            })}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* The plan, top to bottom in time order */}
        <ol className="flex min-w-0 flex-col">
          {blocks.map((b, i) => (
            <li key={b.id} className="flex flex-col">
              <Insert onDrill={() => setPicker({ mode: 'add', at: i })} onStations={() => addStations(i)} onActivity={(k) => addActivity(i, k)} />
              <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t-2 border-ink-100 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm font-medium">{clock(times[i])}</span>
                  <span className="font-mono text-xs text-ink-200">{blockMinutes(b)} min</span>
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-[1_1_260px]">
                      {b.kind === 'drill' && <DrillRow drill={byId.get(b.drillId)} isNew={!knownSet.has(b.drillId)} />}
                      {b.kind === 'activity' && (
                        <div className="flex flex-col gap-2">
                          <input aria-label="Block name" className={`${input} w-full max-w-sm font-display text-lg font-bold`} value={b.title} maxLength={60} onChange={(e) => update(b.id, { title: e.target.value })} />
                          <input aria-label="Note" placeholder="Note for coaches (optional)" className={`${input} w-full text-sm`} value={b.note} maxLength={200} onChange={(e) => update(b.id, { note: e.target.value })} />
                        </div>
                      )}
                      {b.kind === 'stations' && (
                        <div>
                          <h2 className="font-display text-lg font-bold">Stations</h2>
                          <p className="text-sm text-ink-200">
                            {b.stations.length} stations, {b.minutes} min each. Groups rotate on the whistle at {times[i] && rotation(groups, b.stations.length).slice(1).map((_, r) => clock(addMinutes(times[i], b.minutes * (r + 1)))).join(' and ')}.
                          </p>
                        </div>
                      )}
                    </div>
                    <Stepper value={b.minutes} min={b.kind === 'stations' ? 2 : 1} max={b.kind === 'stations' ? 20 : 60} label={b.kind === 'stations' ? 'min each' : 'min'} onChange={(m) => update(b.id, { minutes: m })} />
                    <Menu
                      items={[
                        ...(b.kind === 'drill' ? [{ label: 'Swap for another drill', run: () => setPicker({ mode: 'swap', blockId: b.id }) }] : []),
                        { label: 'Move up', run: () => move(i, -1), disabled: i === 0 },
                        { label: 'Move down', run: () => move(i, 1), disabled: i === blocks.length - 1 },
                        { label: 'Duplicate', run: () => duplicate(i) },
                        { label: 'Remove from plan', run: () => remove(b.id), danger: true },
                      ]}
                    />
                  </div>
                  {b.kind === 'stations' && (
                    <Stations
                      block={b}
                      groups={groups}
                      byId={byId}
                      known={knownSet}
                      onPick={(s) => setPicker({ mode: 'station', blockId: b.id, station: s })}
                      onCoach={(s, coach) => update(b.id, { stations: b.stations.map((x, j) => (j === s ? { ...x, coach } : x)) } as Partial<Block>)}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
          <li>
            <Insert end onDrill={() => setPicker({ mode: 'add', at: blocks.length })} onStations={() => addStations(blocks.length)} onActivity={(k) => addActivity(blocks.length, k)} />
          </li>
        </ol>

        {/* This practice: practice-wide information beside the plan (Panel pattern) */}
        <aside className="flex flex-col gap-5 self-start lg:sticky lg:top-20">
          <PanelSec title="Focus" right={`${used} min`}>
            <ul className="flex flex-col gap-1.5">
              {FOCUS_ATTRIBUTES.map((a) => {
                const f = focus.find((x) => x.attribute === a)!;
                return (
                  <li key={a} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-sm">
                    <Pips level={f.level} />
                    <span className={f.level === 2 ? 'font-bold' : f.level === 1 ? '' : 'text-ink-200'}>
                      {a}
                      {f.level === 2 && <span className="font-normal text-ink-200"> · Main</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </PanelSec>
          <PanelSec title="New to the kids" right={`${fresh.length} of ${team.newDrillsPerWeek}`}>
            {fresh.length ? (
              <ul className="text-sm">
                {fresh.map((d) => (
                  <li key={d}>{byId.get(d)?.funName ?? 'Drill not live'}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-200">All familiar. Nice and calm.</p>
            )}
            {fresh.length > team.newDrillsPerWeek && <p className="text-xs text-whistle-100">More than your usual {team.newDrillsPerWeek}. Fine if it&apos;s on purpose.</p>}
          </PanelSec>
          <PanelSec title="Groups" right={`${team.groups.reduce((n, g) => n + g.skaters, 0)} skaters`}>
            <ul className="text-sm">
              {team.groups.map((g) => (
                <li key={g.group} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                  <span className="font-mono">{g.skaters}</span>
                  {g.group}
                </li>
              ))}
            </ul>
          </PanelSec>
          {gear.length > 0 && (
            <PanelSec title="You need" right={`${gear.length}`}>
              <ul className="list-disc pl-5 text-sm">
                {gear.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </PanelSec>
          )}
        </aside>
      </div>

      {picker && (
        <LibraryDrawer
          drills={drills}
          known={knownSet}
          inPlan={inPlan}
          title={picker.mode === 'swap' ? 'Swap for another drill' : picker.mode === 'station' ? `Drill for station ${['A', 'B', 'C'][picker.station]}` : 'Add a drill'}
          stationsOnly={picker.mode === 'station'}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

const input = 'rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-200">{label}</span>
      {children}
    </label>
  );
}

function DrillRow({ drill, isNew, compact }: { drill?: Drill; isNew: boolean; compact?: boolean }) {
  if (!drill) return <p className="text-sm text-flag-100">This drill isn&apos;t live any more. Swap it for another.</p>;
  const main = drill.focus.filter((f) => f.level === 2);
  return (
    <div className={`grid items-start gap-3 ${compact ? 'grid-cols-[120px_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)]'}`}>
      <Link href={`/drills/${drill.id}`} aria-label={`Open ${drill.funName}`}>
        <Rink spec={drill.diagram} title={drill.funName} detail="thumb" className="rounded-sm border border-border-100" />
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/drills/${drill.id}`} className="font-display text-lg font-bold leading-6 hover:underline">
            {drill.funName}
          </Link>
          {isNew && <span className="rounded-full border border-whistle-100 px-2 py-0.5 text-xs font-semibold text-whistle-100">New</span>}
        </span>
        <span className="text-sm text-ink-200">{drill.plainName}</span>
        <span className="flex flex-wrap gap-x-3 text-xs">
          {main.map((f) => (
            <span key={f.attribute} className="inline-flex items-center gap-1.5 font-semibold">
              <Pips level={2} /> {f.attribute}
            </span>
          ))}
        </span>
        {!compact && <span className="text-sm">“{drill.cues[0]}”</span>}
      </div>
    </div>
  );
}

function Stations({
  block,
  groups,
  byId,
  known,
  onPick,
  onCoach,
}: {
  block: Extract<Block, { kind: 'stations' }>;
  groups: string[];
  byId: Map<string, Drill>;
  known: Set<string>;
  onPick: (i: number) => void;
  onCoach: (i: number, coach: string) => void;
}) {
  const rot = rotation(groups, block.stations.length);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {block.stations.map((s, i) => {
          const d = s.drillId ? byId.get(s.drillId) : undefined;
          return (
            <li key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-t border-border-100 py-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{s.station}</span>
              <div className="flex min-w-0 flex-col gap-2">
                {s.drillId ? <DrillRow drill={d} isNew={!known.has(s.drillId)} compact /> : <p className="text-sm text-ink-200">No drill yet.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onPick(i)} className="min-h-9 rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200">
                    {s.drillId ? 'Change drill' : 'Choose a drill'}
                  </button>
                  <input aria-label={`Coach at station ${s.station}`} placeholder="Coach (e.g. Coach Dana)" maxLength={40} className={`${input} min-w-0 flex-1 py-1.5 text-sm`} value={s.coach} onChange={(e) => onCoach(i, e.target.value)} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {rot.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <caption className="pb-1 text-left text-xs font-semibold text-ink-200">Who is where</caption>
            <thead>
              <tr>
                <th className="py-1 text-left font-normal text-ink-200">Rotation</th>
                {block.stations.map((s) => (
                  <th key={s.station} className="py-1 text-left font-mono font-medium">
                    {s.station}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rot.map((row, r) => (
                <tr key={r} className="border-t border-border-100">
                  <td className="py-1 font-mono text-xs text-ink-200">{r + 1}</td>
                  {row.map((g, c) => (
                    <td key={c} className="py-1">
                      {g}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border-100" role="group" aria-label={`Minutes (${label})`}>
      <button type="button" aria-label="One minute less" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        −
      </button>
      <span className="min-w-14 text-center font-mono text-sm">
        {value} <span className="text-ink-200">{label}</span>
      </span>
      <button type="button" aria-label="One minute more" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        +
      </button>
    </div>
  );
}

function Menu({ items }: { items: { label: string; run: () => void; disabled?: boolean; danger?: boolean }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative">
      <summary aria-label="More actions" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-xl hover:bg-surface-200 [&::-webkit-details-marker]:hidden">
        ⋯
      </summary>
      <ul className="absolute right-0 z-30 mt-1 w-52 rounded-md border border-border-100 bg-surface-100 py-1 shadow-lg">
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.run();
                ref.current?.removeAttribute('open');
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-200 disabled:opacity-40 ${it.danger ? 'text-flag-100' : ''}`}
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Insert({ onDrill, onStations, onActivity, end }: { onDrill: () => void; onStations: () => void; onActivity: (k: (typeof ACTIVITY_KINDS)[number]) => void; end?: boolean }) {
  const [open, setOpen] = useState(false);
  const opts: [string, () => void][] = [
    ['Drill', onDrill],
    ['Stations', onStations],
    ['Water', () => onActivity('water')],
    ['Free skate', () => onActivity('free_skate')],
    ['Scrimmage', () => onActivity('scrimmage')],
    ['Huddle', () => onActivity('huddle')],
  ];
  return (
    <div className={`group flex items-center gap-2 ${end ? 'border-t-2 border-ink-100 py-3' : 'py-1'}`}>
      {open ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {opts.map(([l, f]) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                f();
                setOpen(false);
              }}
              className="min-h-9 rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200"
            >
              {l}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-2 text-sm text-ink-200">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-sm font-medium text-rink-100 ${end ? '' : 'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'}`}
        >
          + {end ? 'Add a drill or block' : 'Add here'}
        </button>
      )}
    </div>
  );
}

function PanelSec({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t-2 border-ink-100 pt-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {right && <span className="font-mono text-xs text-ink-200">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function LibraryDrawer({
  drills,
  known,
  inPlan,
  title,
  stationsOnly,
  onPick,
  onClose,
}: {
  drills: Drill[];
  known: Set<string>;
  inPlan: Set<string>;
  title: string;
  stationsOnly: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const list = drills
    .filter((d) => !stationsOnly || d.worksAsStation)
    .filter((d) => !focus || d.focus.some((f) => f.attribute === focus && f.level === 2))
    .filter((d) => !q || `${d.funName} ${d.plainName}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(inPlan.has(a.id)) - Number(inPlan.has(b.id)) || Number(!known.has(a.id)) - Number(!known.has(b.id)) || a.funName.localeCompare(b.funName));
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto bg-surface-100 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-9 rounded-full px-3 text-sm hover:bg-surface-200">
            Close
          </button>
        </div>
        <input autoFocus placeholder="Search drills" className={input} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {[null, ...FOCUS_ATTRIBUTES].map((a) => (
            <button key={a ?? 'all'} type="button" aria-pressed={focus === a} onClick={() => setFocus(a)} className={`min-h-8 whitespace-nowrap rounded-full px-3 text-xs ${focus === a ? 'bg-ink-100 text-surface-100' : 'border border-border-100'}`}>
              {a ?? 'All'}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-200">Known to the kids first. {stationsOnly && 'Only drills that work as a station.'}</p>
        <ul className="flex flex-col gap-2">
          {list.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => onPick(d.id)} className={`grid w-full grid-cols-[110px_minmax(0,1fr)] items-start gap-3 rounded-md border border-border-100 p-2 text-left hover:border-ink-200 ${inPlan.has(d.id) ? 'opacity-50' : ''}`}>
                <Rink spec={d.diagram} title={d.funName} detail="thumb" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-display">{d.funName}</b>
                    {!known.has(d.id) && <span className="rounded-full border border-whistle-100 px-1.5 text-[11px] font-semibold text-whistle-100">New</span>}
                  </span>
                  <span className="text-xs text-ink-200">
                    {d.plainName} · {d.minutes} min
                  </span>
                  <span className="text-xs">{d.focus.filter((f) => f.level === 2).map((f) => f.attribute).join(' · ')}</span>
                  {inPlan.has(d.id) && <span className="text-xs text-ink-200">Already in this plan</span>}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="text-sm text-ink-200">No drills match.</li>}
        </ul>
      </div>
    </div>
  );
}

function ShareControl({ practiceId, initial }: { practiceId: string; initial: { token: string; expiresAt: string } | null }) {
  const [share, setShare] = useState(initial);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = share ? `${typeof window === 'undefined' ? '' : window.location.origin}/p/${share.token}` : '';
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!share)
            start(async () => {
              const r = await shareWithParents(practiceId);
              if (r.ok) setShare({ token: r.token, expiresAt: r.expiresAt });
            });
        }}
        className="inline-flex min-h-9 items-center rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200"
      >
        Share with parents
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 flex w-[min(92vw,380px)] flex-col gap-2 rounded-md border border-border-100 bg-surface-100 p-3 shadow-lg">
          {pending || !share ? (
            <p className="text-sm text-ink-200">Making a link…</p>
          ) : (
            <>
              <p className="text-sm">Anyone with this link sees the plan: no sign-in, no names. It stops working on {new Date(share.expiresAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.</p>
              <input readOnly aria-label="Parent link" value={url} onFocus={(e) => e.currentTarget.select()} className={`${input} w-full font-mono text-xs`} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="min-h-9 rounded-full bg-rink-100 px-3 text-sm font-medium text-surface-100"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await stopSharing(practiceId);
                      setShare(null);
                      setOpen(false);
                    })
                  }
                  className="min-h-9 rounded-full px-3 text-sm text-flag-100 hover:bg-surface-200"
                >
                  Turn off link
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
