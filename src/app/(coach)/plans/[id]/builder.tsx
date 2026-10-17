'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pips } from '@/components/ds';
import { FOCUS_ATTRIBUTES, type Drill } from '@/lib/drills/schema';
import {
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  addMinutes,
  attendanceLabel,
  blockForDrill,
  blockMinutes,
  changeBlock,
  clock,
  drillIds,
  isOldRotation,
  isAdapted,
  levelsToday,
  newActivity,
  newId,
  practiceFocus,
  rotationToday,
  startTimes,
  todayUnits,
  totalMinutes,
  unusedZones,
  ZONES,
  type ActivityKind,
  type Attendance,
  type Block,
  type ChangeTarget,
  type Practice,
  type Team,
  type Zone,
} from '@/lib/plans/schema';
import { deletePractice, savePractice } from '../actions';
import { DrillCard, Ladder, RotationCard, StationsCard } from './blocks';
import { AttendanceDialog, BLOCK_TYPES, Icon, input, LibraryDrawer, Menu, PanelSec, ShareControl, Stepper, useDismiss, type DrawerFilter } from './parts';

// The plan builder (decision 0004). A sticky plan bar keeps the key actions in reach on long plans
// (a bottom bar on phones); blocks can be added at any gap and changed to another kind in place;
// "Who's here today" adapts every block to the groups on the ice.

type Picker = { mode: 'add'; at: number; filter: DrawerFilter } | { mode: 'fill'; blockId: string; filter: DrawerFilter };
type AddChoice = 'drill' | 'stations' | 'rotation' | ActivityKind | { drillId: string };

const day = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
const STATUS = [
  ['draft', 'Draft', 'bg-ink-200/50'],
  ['ready', 'Ready', 'bg-rink-100'],
  ['done', 'Done', 'bg-good-100'],
] as const;

export function Builder({
  initial,
  team,
  drills,
  known,
  copiedFrom,
  initialShare,
}: {
  initial: Practice;
  team: Team;
  drills: Drill[];
  known: string[];
  copiedFrom: string | null;
  initialShare: { token: string; expiresAt: string } | null;
}) {
  const [plan, setPlan] = useState<Practice>(initial);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState('');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [attOpen, setAttOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [leaveShort, setLeaveShort] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
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
  const units = todayUnits(team, plan.attendance);
  const gc = units.length;
  const adapted = isAdapted(team, plan.attendance);
  const times = startTimes(plan.startTime, blocks, gc);
  const used = totalMinutes(blocks, gc);
  const endTime = addMinutes(plan.startTime, used);
  const focus = practiceFocus(blocks, byId, gc);
  const inPlan = new Set(blocks.flatMap(drillIds));
  const fresh = [...inPlan].filter((d) => !knownSet.has(d));
  const gear = [...new Set([...inPlan].map((d) => byId.get(d)?.gear).filter((g): g is string => !!g && g !== 'None'))];
  const name = (b: Block) => (b.kind === 'activity' ? b.title : b.kind === 'rotation' ? ((b.drillId && byId.get(b.drillId)?.funName) ?? 'Rotation') : (byId.get(b.drillId)?.funName ?? 'Drill'));

  const setBlocks = (f: (b: Block[]) => Block[]) => setPlan((p) => ({ ...p, blocks: f(p.blocks) }));
  const update = (id: string, f: (b: Block) => Block) => setBlocks((bs) => bs.map((b) => (b.id === id ? f(b) : b)));
  const moveTo = (from: number, to: number) =>
    setBlocks((bs) => {
      if (to < 0 || to >= bs.length || from === to) return bs;
      const c = [...bs];
      const [x] = c.splice(from, 1);
      c.splice(to, 0, x);
      return c;
    });
  const insert = (at: number, b: Block) => setBlocks((bs) => [...bs.slice(0, at), b, ...bs.slice(at)]);

  function add(at: number, choice: AddChoice) {
    setAdding(null);
    if (typeof choice === 'object') {
      const d = byId.get(choice.drillId);
      if (d) insert(at, blockForDrill(d));
    } else if (choice === 'drill' || choice === 'stations' || choice === 'rotation') setPicker({ mode: 'add', at, filter: choice === 'drill' ? 'all' : choice });
    else insert(at, newActivity(choice));
  }

  function pick(drillId: string) {
    if (!picker) return;
    const d = byId.get(drillId);
    if (!d) return;
    if (picker.mode === 'add') insert(picker.at, blockForDrill(d));
    if (picker.mode === 'fill')
      update(picker.blockId, (b) => {
        // A rotation keeps its minutes per station; an activity takes the drill's own minutes.
        const keep = b.kind === 'activity' ? d.minutes : b.kind === 'rotation' ? (d.groupModel === 'rotation' ? b.minutes : d.minutes) : d.groupModel === 'rotation' ? d.minutes : b.minutes;
        return { ...blockForDrill(d, keep), id: b.id };
      });
    setPicker(null);
  }

  const setAttendance = (a: Attendance | null) => {
    setPlan((p) => ({ ...p, attendance: a && isAdapted(team, a) ? a : null }));
    setAttOpen(false);
  };

  // "What changes" in the attendance dialog, before the coach applies it.
  const preview = useCallback(
    (a: Attendance): string[] => {
      const u2 = todayUnits(team, a);
      const lines: string[] = [];
      for (const b of blocks) {
        if (b.kind === 'rotation') {
          const n = rotationToday(b, u2.length).active.length;
          if (n !== rotationToday(b, gc).active.length) lines.push(`The rotation runs ${n} station${n === 1 ? '' : 's'} of ${b.minutes} min.`);
        }
        const d = b.kind === 'drill' || b.kind === 'stations' ? byId.get(b.drillId) : undefined;
        if (b.kind === 'drill' && d?.levels.length) {
          const lv = levelsToday(d, b, u2);
          u2.filter((u) => u.groups.length > 1).forEach((u) => lines.push(`In ${d.funName}, ${u.label} do level ${lv.get(u.key)}.`));
        }
        if (b.kind === 'stations' && d) {
          const off = unusedZones(d, u2, b.zones);
          const on = ZONES.filter((z) => !off.includes(z) && d.stations?.some((s) => s.station === z));
          if (off.join() !== unusedZones(d, units, b.zones).join()) lines.push(`${d.funName} uses station${on.length === 1 ? '' : 's'} ${on.join(' and ')}.`);
        }
      }
      const delta = totalMinutes(blocks, u2.length) - used;
      if (delta < 0) lines.push(`${-delta} minutes come free.`);
      if (delta > 0) lines.push(`The plan gets ${delta} min longer.`);
      if (u2.length !== gc) lines.push(`Drills you add today are set up for ${u2.length} group${u2.length === 1 ? '' : 's'} too.`);
      return lines;
    },
    [blocks, byId, gc, team, units, used],
  );

  const changeTargets = (b: Block): { label: string; run: () => void; current?: boolean }[] =>
    (
      [
        ['drill', 'Drill'],
        ['stations', 'Stations'],
        ['rotation', 'Rotation'],
        ['water', 'Water'],
        ['free_skate', 'Free skate'],
        ['huddle', 'Huddle'],
        ['scrimmage', 'Small games'],
      ] as [ChangeTarget, string][]
    ).map(([to, label]) => ({
      label,
      current: b.kind === to || (b.kind === 'activity' && b.activity === to),
      run: () => {
        const next = changeBlock(b, to, gc);
        update(b.id, () => next);
        if ((next.kind === 'drill' || next.kind === 'stations' || next.kind === 'rotation') && !next.drillId)
          setPicker({ mode: 'fill', blockId: b.id, filter: next.kind === 'drill' ? 'all' : next.kind });
      },
    }));

  const statusSeg = (
    <div role="radiogroup" aria-label="Plan status" className="inline-flex rounded-full bg-surface-300 p-[3px]">
      {STATUS.map(([s, label, dot]) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={plan.status === s}
          onClick={() => setPlan((p) => ({ ...p, status: s }))}
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm ${plan.status === s ? 'bg-surface-100 font-semibold text-ink-100 shadow-sm' : 'text-ink-200 hover:text-ink-100'}`}
        >
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
  const saved = (
    <span aria-live="polite" className={saveState === 'error' ? 'text-flag-100' : saveState === 'saved' ? 'text-good-100' : ''}>
      {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : `Not saved: ${saveError}`}
    </span>
  );
  const attChip = (
    <button
      type="button"
      onClick={() => setAttOpen(true)}
      className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-medium hover:bg-surface-200 ${adapted ? 'border-rink-100' : 'border-border-100'}`}
    >
      <span>
        {attendanceLabel(units)}
        {adapted && <span className="lg:hidden xl:inline"> today</span>}
      </span> <span className="text-ink-200">▾</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Plan bar: sticky on desktop, the practice on the left, its status in the middle, actions on the right */}
      <div className="sticky top-14 z-10 -mx-4 hidden border-b border-border-100 bg-surface-100/95 px-4 py-3 shadow-[0_6px_16px_-14px_rgba(14,27,30,0.5)] backdrop-blur lg:block print:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={() => setDetailsOpen(true)} className="flex min-w-0 flex-col items-start text-left" aria-label="Date, time and ice">
              <span className="font-display text-xl font-extrabold leading-6">{day(plan.date)}</span>
              <span className="truncate text-[13px] text-ink-200">
                {clock(plan.startTime)}–{clock(addMinutes(plan.startTime, plan.minutes))} · {plan.ice === 'half' ? 'Half ice' : 'Full ice'} · {saved}
              </span>
            </button>
            {attChip}
          </div>
          {statusSeg}
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/today?plan=${plan.id}`}
              aria-label="Rink-side" title="Rink-side"
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-100 px-3.5 text-sm font-medium hover:bg-surface-200"
            >
              {Icon.rinkside(16)}
              <span className="hidden 2xl:inline">Rink-side</span>
            </Link>
            <Link
              href={`/plans/${plan.id}/print`}
              aria-label="Print" title="Print"
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-100 px-3.5 text-sm font-medium hover:bg-surface-200"
            >
              {Icon.print(16)}
              <span className="hidden 2xl:inline">Print</span>
            </Link>
            <ShareControl practiceId={plan.id} initial={initialShare} />
            <button
              type="button"
              onClick={() => {
                setAdding(blocks.length);
                requestAnimationFrame(() => document.getElementById('gap-end')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
              }}
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full bg-rink-100 px-4 text-sm font-medium text-surface-100 hover:bg-rink-200"
            >
              {Icon.plus(16)} Add block
            </button>
          </div>
        </div>
      </div>

      {/* Phone: the practice at the top, actions in the bottom bar */}
      <div className="flex flex-col gap-2 lg:hidden">
        <div className="flex items-center gap-2">
          <Link href="/plans" aria-label="All plans" className="text-ink-200">
            ‹
          </Link>
          <button type="button" onClick={() => setDetailsOpen(true)} className="font-display text-lg font-extrabold">
            {day(plan.date)}
          </button>
          <span className={`ml-auto font-mono text-xs ${used === plan.minutes ? 'text-good-100' : used > plan.minutes ? 'text-flag-100' : 'text-whistle-100'}`}>
            {used} of {plan.minutes}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-200">
          {attChip}
          <span>
            {clock(plan.startTime)} · {plan.ice === 'half' ? 'Half ice' : 'Full ice'} · {saved}
          </span>
        </div>
        {copiedFrom && <p className="text-xs text-ink-200">Copied from {day(copiedFrom)}. Change what you need.</p>}
      </div>
      {copiedFrom && <p className="-mt-2 hidden text-sm text-ink-200 lg:block">Copied from {day(copiedFrom)}. Change what you need.</p>}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ol className="flex min-w-0 flex-col">
          {blocks.map((b, i) => (
            <li
              key={b.id}
              draggable={armed === b.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDrag({ from: i, over: i });
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (drag.over !== i) setDrag({ ...drag, over: i });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) moveTo(drag.from, drag.over);
                setDrag(null);
                setArmed(null);
              }}
              onDragEnd={() => {
                setDrag(null);
                setArmed(null);
              }}
              className={`flex flex-col ${drag?.from === i ? 'opacity-40' : ''} ${drag && drag.over === i && drag.from !== i ? (drag.from < i ? 'border-b-4 border-rink-100' : 'border-t-4 border-rink-100') : ''}`}
            >
              {<Gap at={i} time={times[i]} after={i > 0 ? name(blocks[i - 1]) : ''} open={adding === i} onOpen={setAdding} onChoose={add} known={known} byId={byId} />}
              <section className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t-2 border-ink-100 py-3.5">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <span className="font-mono text-sm font-medium">{clock(times[i])}</span>
                  <span className="font-mono text-xs text-ink-200">{blockMinutes(b, gc)} min</span>
                  <button
                    type="button"
                    aria-label={`Drag to move ${name(b)}`}
                    onMouseDown={() => setArmed(b.id)}
                    onMouseUp={() => setArmed(null)}
                    className="mt-2 hidden w-fit cursor-grab text-ink-200/60 hover:text-ink-200 lg:block"
                  >
                    {Icon.grip(16)}
                  </button>
                </div>
                <BlockBody
                  block={b}
                  index={i}
                  count={blocks.length}
                  units={units}
                  gc={gc}
                  byId={byId}
                  known={knownSet}
                  update={(f) => update(b.id, f)}
                  menu={[
                    {
                      label: 'Change to',
                      sub: changeTargets(b),
                      note: 'Keeps the time slot and minutes',
                    },
                    ...(b.kind !== 'activity' && (b.drillId || isOldRotation(b))
                      ? [
                          {
                            label: b.kind === 'rotation' ? 'Swap for another rotation' : 'Swap for another drill',
                            run: () => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'drill' ? 'all' : b.kind }),
                          },
                        ]
                      : []),
                    {
                      label: 'Duplicate',
                      run: () => insert(i + 1, { ...structuredClone(b), id: newId() }),
                    },
                    {
                      label: 'Move up',
                      run: () => moveTo(i, i - 1),
                      disabled: i === 0,
                    },
                    {
                      label: 'Move down',
                      run: () => moveTo(i, i + 1),
                      disabled: i === blocks.length - 1,
                    },
                    {
                      label: 'Remove from plan',
                      run: () => setBlocks((bs) => bs.filter((x) => x.id !== b.id)),
                      danger: true,
                    },
                  ]}
                  onChooseDrill={() => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'stations' || b.kind === 'rotation' ? b.kind : 'all' })}

                />
              </section>
            </li>
          ))}
          <li id="gap-end" className="border-t-2 border-ink-100 pt-1">
            <Gap
              at={blocks.length}
              time={endTime}
              after={blocks.length ? name(blocks[blocks.length - 1]) : ''}
              open={adding === blocks.length}
              onOpen={setAdding}
              onChoose={add}
              known={known}
              byId={byId}
              end
            />
          </li>
        </ol>

        <aside className="flex flex-col gap-5 self-start lg:sticky lg:top-[136px]">
          <TimeCard
            used={used}
            total={plan.minutes}
            adapted={adapted}
            gc={gc}
            blocks={blocks}
            name={name}
            endTime={endTime}
            dismissed={leaveShort === used}
            onDismiss={() => setLeaveShort(used)}
            onSet={(id, m) => update(id, (b) => ({ ...b, minutes: m }) as Block)}
            onAddDrill={() => {
              const last = blocks[blocks.length - 1];
              const at = last?.kind === 'activity' && last.activity === 'huddle' ? blocks.length - 1 : blocks.length;
              setPicker({ mode: 'add', at, filter: 'all' });
            }}
            addAt={(() => {
              const last = blocks[blocks.length - 1];
              return last?.kind === 'activity' && last.activity === 'huddle' ? times[blocks.length - 1] : endTime;
            })()}
          />
          <PanelSec title="Who's here today" right={`${units.reduce((n, u) => n + u.skaters, 0)} skaters`}>
            <ul className="text-sm">
              {units.map((u) => (
                <li key={u.key} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                  <span className="font-mono">{u.skaters}</span>
                  {u.label}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setAttOpen(true)} className="w-fit text-[13px] text-rink-100 hover:underline">
              Change for today
            </button>
          </PanelSec>
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

      {/* Phone bottom bar */}
      <nav
        aria-label="Plan actions"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border-100 bg-surface-100 px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 lg:hidden print:hidden"
      >
        <button type="button" onClick={() => setAdding(blocks.length)} className="flex flex-1 flex-col items-center gap-0.5 text-[11px] font-semibold text-rink-100">
          <span className="flex h-[30px] w-11 items-center justify-center rounded-full bg-rink-100 text-surface-100">{Icon.plus(20)}</span>
          Add
        </button>
        <Link href={`/plans/${plan.id}/print`} className="flex flex-1 flex-col items-center gap-0.5 text-[11px]">
          {Icon.print(20)}
          Print
        </Link>
        <div className="flex-1">
          <ShareControl practiceId={plan.id} initial={initialShare} compact />
        </div>
        <PhoneStatus status={plan.status} onChange={(s) => setPlan((p) => ({ ...p, status: s }))} />
      </nav>

      {adding !== null && (
        <AddSheet
          at={adding}
          time={adding < blocks.length ? times[adding] : endTime}
          after={adding > 0 ? name(blocks[adding - 1]) : ''}
          onChoose={add}
          onClose={() => setAdding(null)}
          known={known}
          byId={byId}
        />
      )}
      {picker && (
        <LibraryDrawer
          drills={drills}
          known={knownSet}
          inPlan={inPlan}
          title={picker.filter === 'rotation' ? 'Choose a rotation' : picker.filter === 'stations' ? 'Choose a station drill' : picker.mode === 'fill' ? 'Choose a drill' : 'Add a drill'}
          filter={picker.filter}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}
      {attOpen && <AttendanceDialog team={team} value={plan.attendance} preview={preview} onApply={setAttendance} onClose={() => setAttOpen(false)} />}
      {detailsOpen && <DetailsDialog plan={plan} setPlan={setPlan} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}

function BlockBody({
  block: b,
  index,
  count,
  units,
  gc,
  byId,
  known,
  update,
  menu,
  onChooseDrill,
}: {
  block: Block;
  index: number;
  count: number;
  units: ReturnType<typeof todayUnits>;
  gc: number;
  byId: Map<string, Drill>;
  known: Set<string>;
  update: (f: (b: Block) => Block) => void;
  menu: Parameters<typeof Menu>[0]['items'];
  onChooseDrill: () => void;
}) {
  void index;
  void count;
  const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
  const fewer = gc < 3;
  let tag = 'ACTIVITY';
  let tone = 'text-ink-200';
  if (b.kind === 'drill') {
    const inPlay = b.use.length && d?.levels.length ? b.use.length : (d?.levels.length ?? 0) + 1;
    tag = `DRILL${d?.levels.length ? ` · ${inPlay === 1 ? `LEVEL ${b.use[0] ?? 1}` : `${inPlay} LEVELS`}` : ''}${fewer && d?.levels.length && inPlay > 1 ? ` · ${gc} GROUP${gc === 1 ? '' : 'S'} TODAY` : ''}`;
    tone = 'text-rink-100';
  }
  if (b.kind === 'stations') {
    tag = fewer ? `STATIONS · ${gc} GROUP${gc === 1 ? '' : 'S'} TODAY` : 'STATIONS · ONE PER GROUP';
    tone = 'text-[var(--role-defense-100)]';
  }
  if (b.kind === 'rotation') {
    const { active, off } = rotationToday(b, gc);
    tag = b.stations.length ? `ROTATION · ${active.length} STATION${active.length === 1 ? '' : 'S'}${off.length ? ' TODAY' : ''}` : 'ROTATION';
    tone = 'text-rink-200';
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
          <span className={`font-mono text-[11px] font-medium tracking-wide ${tone}`}>{tag}</span>
          {b.kind === 'activity' ? (
            <>
              <input
                aria-label="Block name"
                className="-mx-1 w-full max-w-sm rounded px-1 font-display text-[19px] font-bold leading-6 hover:bg-surface-200 focus:bg-surface-200"
                value={b.title}
                maxLength={60}
                onChange={(e) => update((x) => ({ ...x, title: e.target.value }) as Block)}
              />
              <input
                aria-label="Note"
                placeholder="Note for coaches (optional)"
                className="-mx-1 w-full max-w-md rounded px-1 text-sm text-ink-200 hover:bg-surface-200 focus:bg-surface-200"
                value={b.note}
                maxLength={200}
                onChange={(e) => update((x) => ({ ...x, note: e.target.value }) as Block)}
              />
            </>
          ) : b.kind === 'rotation' && !d && isOldRotation(b) ? (
            <h2 className="font-display text-[19px] font-bold leading-6">Rotation</h2>
          ) : d ? (
            <>
              <Link href={`/drills/${d.id}`} className="w-fit font-display text-[19px] font-bold leading-6 hover:underline">
                {d.funName}
              </Link>
              <span className="text-[13px] text-ink-200">{d.plainName}</span>
            </>
          ) : (
            <button type="button" onClick={onChooseDrill} className="w-fit font-display text-[19px] font-bold leading-6 text-rink-100 hover:underline">
              {b.drillId ? 'This drill isn’t live any more. Swap it' : b.kind === 'rotation' ? 'Choose a rotation' : 'Choose a drill'}
            </button>
          )}
        </div>
        <Stepper
          value={b.minutes}
          min={b.kind === 'rotation' ? 2 : 1}
          max={b.kind === 'rotation' ? 20 : 60}
          label={b.kind === 'rotation' ? 'min each' : 'min'}
          onChange={(m) => update((x) => ({ ...x, minutes: m }) as Block)}
        />
        <Menu items={menu} />
      </div>
      {b.kind === 'drill' &&
        d &&
        (d.levels.length ? (
          <Ladder
            block={b}
            drill={d}
            units={units}
            onLevel={(k, lv) => update((x) => (x.kind === 'drill' ? { ...x, levels: { ...x.levels, [k]: lv } } : x))}
            onUse={(use) => update((x) => (x.kind === 'drill' ? { ...x, use } : x))}
          />
        ) : (
          <DrillCard drill={d} isNew={!known.has(d.id)} />
        ))}
      {b.kind === 'stations' && d && <StationsCard block={b} drill={d} units={units} onZone={(k, z: Zone) => update((x) => (x.kind === 'stations' ? { ...x, zones: { ...x.zones, [k]: z } } : x))} />}
      {b.kind === 'rotation' && (
        <RotationCard
          block={b}
          drill={d}
          byId={byId}
          known={known}
          groupCount={gc}
          onChoose={onChooseDrill}
          onUseInstead={(z) => update((x) => (x.kind === 'rotation' ? { ...x, drop: [z] } : x))}
        />
      )}
    </div>
  );
}

/** The gap between two blocks: "+ Add here" (on hover on desktop, always on phones). */
function Gap({
  at,
  time,
  after,
  open,
  onOpen,
  onChoose,
  known,
  byId,
  end,
}: {
  at: number;
  time: string;
  after: string;
  open: boolean;
  onOpen: (n: number | null) => void;
  onChoose: (at: number, c: AddChoice) => void;
  known: string[];
  byId: Map<string, Drill>;
  end?: boolean;
}) {
  return (
    <div className="group relative">
      {open ? (
        <div className="hidden flex-col gap-2 py-2 pl-[68px] lg:flex">
          <div className="flex items-center gap-2.5 text-rink-100">
            <span className="h-0 flex-1 border-t-2 border-rink-100" />
            <span className="text-xs font-semibold">Add at {clock(time)}</span>
            <span className="h-0 flex-1 border-t-2 border-rink-100" />
          </div>
          <AddPicker at={at} onChoose={onChoose} onClose={() => onOpen(null)} known={known} byId={byId} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(at)}
        className={`flex w-full items-center gap-2.5 py-1 pl-[68px] text-xs text-rink-100 ${open ? 'lg:hidden' : ''} ${end ? 'font-medium' : 'lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-visible:opacity-100'}`}
      >
        <span className="h-0 flex-1 border-t border-dashed border-rink-100/50" />
        <span>{end ? '+ Add a block' : '+ Add here'}</span>
        <span className="h-0 flex-1 border-t border-dashed border-rink-100/50" />
        <span className="sr-only">{after ? `after ${after}` : 'at the start'}</span>
      </button>
    </div>
  );
}

function AddPicker({
  at,
  onChoose,
  onClose,
  known,
  byId,
  sheet,
}: {
  at: number;
  onChoose: (at: number, c: AddChoice) => void;
  onClose: () => void;
  known: string[];
  byId: Map<string, Drill>;
  sheet?: boolean;
}) {
  const [activity, setActivity] = useState(false);
  const ref = useDismiss(!sheet, onClose);
  const chips = known
    .map((id) => byId.get(id))
    .filter((d): d is Drill => !!d)
    .slice(0, 5);
  return (
    <div
      ref={ref}
      className={`flex flex-col gap-2.5 ${sheet ? '' : 'mx-auto w-full max-w-[620px] rounded-[14px] border border-border-100 bg-surface-100 p-3 shadow-[0_12px_32px_-12px_rgba(14,27,30,0.35)]'}`}
    >
      {activity ? (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setActivity(false)} className="w-fit text-sm text-ink-200">
            ‹ Activity
          </button>
          <div className={`grid gap-1.5 ${sheet ? '' : 'grid-cols-2'}`}>
            {ACTIVITY_KINDS.filter((k) => k !== 'other').map((k) => (
              <button key={k} type="button" onClick={() => onChoose(at, k)} className="min-h-11 rounded-md px-3 text-left text-[15px] hover:bg-surface-200">
                {ACTIVITY_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid gap-1.5 ${sheet ? '' : 'grid-cols-2'}`}>
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => (t.kind === 'activity' ? setActivity(true) : onChoose(at, t.kind))}
              className={`flex items-start gap-3 rounded-[10px] px-3 text-left hover:bg-surface-200 ${sheet ? 'min-h-14 items-center border-t border-surface-300 py-1.5' : 'py-2.5'}`}
            >
              <span className="mt-0.5 text-rink-200">{t.icon(sheet ? 20 : 18)}</span>
              <span className="flex flex-1 flex-col gap-0.5">
                <b className="text-[15px]">{t.label}</b>
                <span className="text-xs leading-4 text-ink-200">{t.help}</span>
              </span>
              {sheet && <span className="text-ink-200">›</span>}
            </button>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-surface-300 pt-2.5">
          <span className="text-xs text-ink-200">Known to the kids:</span>
          {chips.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onChoose(at, { drillId: d.id })}
              className="inline-flex h-7 items-center rounded-full border border-border-100 px-2.5 text-xs font-medium hover:bg-surface-200"
            >
              {d.funName}
            </button>
          ))}
          <button type="button" onClick={() => onChoose(at, 'drill')} className="ml-auto text-[13px] text-rink-100 hover:underline">
            Search the library
          </button>
        </div>
      )}
    </div>
  );
}

/** Phones: adding is a bottom sheet. */
function AddSheet({
  at,
  time,
  after,
  onChoose,
  onClose,
  known,
  byId,
}: {
  at: number;
  time: string;
  after: string;
  onChoose: (at: number, c: AddChoice) => void;
  onClose: () => void;
  known: string[];
  byId: Map<string, Drill>;
}) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Add at ${clock(time)}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/35" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 rounded-t-[18px] bg-surface-100 px-4 pb-7 pt-2.5 shadow-xl">
        <span className="mx-auto h-1 w-10 rounded-full bg-border-100" aria-hidden="true" />
        <div className="flex items-baseline justify-between">
          <b className="font-display text-[19px]">Add at {clock(time)}</b>
          {after && <span className="text-[13px] text-ink-200">after {after}</span>}
        </div>
        <AddPicker at={at} onChoose={onChoose} onClose={onClose} known={known} byId={byId} sheet />
      </div>
    </div>
  );
}

function PhoneStatus({ status, onChange }: { status: Practice['status']; onChange: (s: Practice['status']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const cur = STATUS.find(([s]) => s === status)!;
  return (
    <div ref={ref} className="relative flex-1">
      <button type="button" aria-expanded={open} aria-label={`Status: ${cur[1]}`} onClick={() => setOpen((o) => !o)} className="flex w-full flex-col items-center gap-0.5 text-[11px]">
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border-100 px-2 font-mono text-xs">
          <span className={`h-2 w-2 rounded-full ${cur[2]}`} />
          {cur[1]}
        </span>
        Status
      </button>
      {open && (
        <div className="absolute bottom-full right-1 mb-3 w-40 rounded-md border border-border-100 bg-surface-100 py-1 shadow-lg">
          {STATUS.map(([s, label, dot]) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-200 ${s === status ? 'font-semibold' : ''}`}
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeCard({
  used,
  total,
  adapted,
  gc,
  blocks,
  name,
  endTime,
  dismissed,
  onDismiss,
  onSet,
  onAddDrill,
  addAt,
}: {
  used: number;
  total: number;
  adapted: boolean;
  gc: number;
  blocks: Block[];
  name: (b: Block) => string;
  endTime: string;
  dismissed: boolean;
  onDismiss: () => void;
  onSet: (id: string, minutes: number) => void;
  onAddDrill: () => void;
  addAt: string;
}) {
  const diff = used - total;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const btn = 'flex min-h-9 w-full items-center justify-center rounded-full border border-border-100 bg-surface-100 px-3 text-[13px] font-medium hover:bg-surface-200';
  if (diff === 0 || (diff < 0 && dismissed))
    return (
      <section className="flex flex-col gap-2 border-t-2 border-ink-100 pt-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-extrabold">Time</h2>
          <span className={`font-mono text-xs font-medium ${diff === 0 ? 'text-good-100' : 'text-whistle-100'}`}>
            {used} of {total} min
          </span>
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-surface-300">
          <span className={`block h-1.5 ${diff === 0 ? 'bg-good-100' : 'bg-whistle-100'}`} style={{ width: `${pct}%` }} />
        </span>
        {diff < 0 && (
          <span className="text-xs text-ink-200">
            Ends at {clock(endTime)}, {-diff} min early.
          </span>
        )}
      </section>
    );
  const short = diff < 0;
  const grow = blocks.filter((b) => (b.kind === 'drill' || b.kind === 'stations') && b.drillId).sort((a, b) => b.minutes - a.minutes)[0];
  const trims = blocks
    .filter((b) => b.kind !== 'rotation' && b.minutes > 3)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);
  return (
    <section role={short ? undefined : 'alert'} className={`flex flex-col gap-2.5 rounded-[10px] border-[1.5px] px-3.5 py-3 ${short ? 'border-whistle-100' : 'border-flag-100'}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold">{short ? `${-diff} min short` : `${diff} min over`}</h2>
        <span className={`font-mono text-xs font-medium ${short ? 'text-whistle-100' : 'text-flag-100'}`}>
          {used} of {total} min
        </span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-surface-300">
        <span className={`block h-1.5 ${short ? 'bg-whistle-100' : 'bg-flag-100'}`} style={{ width: `${pct}%` }} />
      </span>
      <p className="text-[13px] leading-[18px] text-ink-200">
        {short ? (adapted && gc < 3 ? `Adapted for ${gc} group${gc === 1 ? '' : 's'}, so the plan runs shorter. Use the time:` : 'Use the time:') : 'Trim:'}
      </p>
      <div className="flex flex-col gap-1.5">
        {short ? (
          <>
            {grow && grow.kind !== 'activity' && grow.kind !== 'rotation' && (
              <button type="button" className={btn} onClick={() => onSet(grow.id, Math.min(60, grow.minutes - diff))}>
                {name(grow)} {grow.minutes} → {Math.min(60, grow.minutes - diff)} min
              </button>
            )}
            <button type="button" className={btn} onClick={onAddDrill}>
              Add a drill at {clock(addAt)}
            </button>
            <button type="button" className={`${btn} text-ink-200`} onClick={onDismiss}>
              Leave it short
            </button>
          </>
        ) : (
          trims.map((b) => {
            const cut = Math.min(diff, b.minutes - 3);
            return (
              <button key={b.id} type="button" className={btn} onClick={() => onSet(b.id, b.minutes - cut)}>
                {name(b)} {b.minutes} → {b.minutes - cut} min
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function DetailsDialog({ plan, setPlan, onClose }: { plan: Practice; setPlan: React.Dispatch<React.SetStateAction<Practice>>; onClose: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useDismiss(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-100/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Date, time and ice">
      <div ref={ref} className="flex w-full max-w-md flex-col gap-4 rounded-t-[18px] bg-surface-100 p-4 shadow-xl sm:rounded-[14px]">
        <h2 className="text-[17px] font-extrabold">Date, time and ice</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={input} value={plan.date} onChange={(e) => e.target.value && setPlan((p) => ({ ...p, date: e.target.value }))} />
          </Field>
          <Field label="Start">
            <input
              type="time"
              step={300}
              className={input}
              value={plan.startTime}
              onChange={(e) =>
                e.target.value &&
                setPlan((p) => ({
                  ...p,
                  startTime: e.target.value.slice(0, 5),
                }))
              }
            />
          </Field>
          <Field label="Ice time (min)">
            <input
              type="number"
              min={20}
              max={120}
              step={5}
              className={`${input} font-mono`}
              value={plan.minutes}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  minutes: Math.min(120, Math.max(20, Number(e.target.value) || 60)),
                }))
              }
            />
          </Field>
          <Field label="Ice">
            <select
              className={input}
              value={plan.ice}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  ice: e.target.value as Practice['ice'],
                }))
              }
            >
              <option value="half">Half ice</option>
              <option value="full">Full ice</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
          <button type="button" onClick={onClose} className="min-h-10 rounded-full bg-rink-100 px-4 font-medium text-surface-100">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-200">{label}</span>
      {children}
    </label>
  );
}
