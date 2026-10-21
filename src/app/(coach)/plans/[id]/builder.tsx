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
  blockLevels,
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
import { deletePractice, keepSuggestion, savePractice } from '../actions';
import { DrillCard, LevelPicker, RotationCard, StationsCard } from './blocks';
import { DrillDrawer, OpenDrill, useOpenDrill } from '@/components/drill-drawer';
import { AttendanceDialog, BLOCK_TYPES, FeedbackLine, Icon, input, LibraryDrawer, Menu, PanelSec, ShareControl, Stepper, useDismiss, type DrawerFilter, type DrawerSlot } from './parts';
import type { DrillFeedback } from '@/lib/plans/feedback';
import type { Favorite } from '@/lib/app/store';
import { varietyWarnings, type VarietyRule, type VarietyWarning } from '@/lib/plans/variety';
import { partForSlot } from '@/lib/plans/drawer';
import { suggestions, type Suggestion } from '@/lib/plans/suggest';
import { AppliedNote, CheckinPanel, PhoneLine, SuggestionBox, type Applied, type SuggestContext } from './suggestions';

// The plan builder (decision 0004). A sticky plan bar keeps the key actions in reach on long plans
// (a bottom bar on phones); blocks can be added at any gap and changed to another kind in place;
// "Who's here today" adapts every block to the groups on the ice.

type Picker = { mode: 'add'; at: number; filter: DrawerFilter; part?: Drill['part']; why?: string } | { mode: 'fill'; blockId: string; filter: DrawerFilter };
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
  lastRun,
  recent,
  feedback,
  suggest,
  favorites,
  copiedFrom,
  initialShare,
}: {
  initial: Practice;
  team: Team;
  drills: Drill[];
  known: string[];
  lastRun: Record<string, string>;
  recent: string[];
  feedback: Record<string, DrillFeedback>;
  suggest: SuggestContext | null;
  favorites: Record<string, Favorite>;
  copiedFrom: string | null;
  initialShare: { token: string; expiresAt: string } | null;
}) {
  const [plan, setPlan] = useState<Practice>(initial);
  // The drill open in the side drawer, and team favourites as starred here (the drawer and the picker share them).
  const [viewing, setViewing] = useState<string | null>(null);
  const [favs, setFavs] = useState(favorites);
  const closeDrill = useCallback(() => setViewing(null), []);
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
  const recentSet = useMemo(() => new Set(recent), [recent]);
  // "Keep as is" on a variety warning, remembered on this device for this plan.
  const keepKey = `firstpass:keep:${initial.id}`;
  const [kept, setKept] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setKept(new Set(JSON.parse(localStorage.getItem(keepKey) ?? '[]')));
    } catch {
      /* storage blocked: warnings just show again */
    }
  }, [keepKey]);
  const keep = (k: string) =>
    setKept((prev) => {
      const next = new Set(prev).add(k);
      try {
        localStorage.setItem(keepKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });

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
  const variety = varietyWarnings(blocks, byId);
  // The block that takes the plan past the team's usual number of new drills carries the warning
  // (UX pattern: a warning lives on the item that breaks the rule). The panel only counts.
  const overNew = new Set<string>();
  {
    const seen = new Set<string>();
    for (const b of blocks) {
      for (const d of drillIds(b)) if (!knownSet.has(d)) seen.add(d);
      // Only the block that crosses the limit, so the warning shows once, not on every later drill.
      if (seen.size > team.newDrillsPerWeek && drillIds(b).some((d) => !knownSet.has(d))) {
        overNew.add(b.id);
        break;
      }
    }
  }
  // Suggestions from the last check-in (decision 0022). Worked out from the plan as it is now, so
  // one that's been acted on simply stops appearing; this visit remembers what was done, for Undo.
  const [applied, setApplied] = useState<Applied[]>([]);
  const [keptBy, setKeptBy] = useState<Map<string, string>>(() => new Map((suggest?.kept ?? []).map((k) => [k.key, k.editor])));
  const sug = suggest ? suggestions({ blocks, last: suggest.last, checkins: suggest.checkins, units: suggest.units, byId, known: knownSet, feedback, runs: suggest.runs }) : { list: [], stays: [] };
  const appliedKeys = new Set(applied.map((a) => a.key));
  const openSug = sug.list.filter((x) => !keptBy.has(x.key) && !appliedKeys.has(x.key));
  const keptSug = sug.list.filter((x) => keptBy.has(x.key)).map((x) => ({ ...x, editor: keptBy.get(x.key)! }));
  const sugFor = new Map(openSug.map((x) => [x.blockId, x]));
  // A variety warning that a suggestion would clear says so ("Swapping Snake in the Forest above fixes this too").
  const fixesToo = new Map<string, string>();
  for (const x of openSug) {
    if (!x.drillId || (x.kind !== 'swap' && x.kind !== 'game-before')) continue;
    const after = varietyWarnings(applySuggestion(blocks, x, byId), byId);
    const what = x.kind === 'swap' ? `Swapping ${byId.get((blocks.find((b) => b.id === x.blockId) as { drillId?: string })?.drillId ?? '')?.funName ?? 'the drill'} above` : `The game before ${name0(blocks.find((b) => b.id === x.blockId))}`;
    for (const [id] of variety) if (!after.has(id) && !fixesToo.has(id)) fixesToo.set(id, `${what} fixes this too.`);
  }
  function name0(b: Block | undefined) {
    return b && b.kind !== 'activity' && b.drillId ? (byId.get(b.drillId)?.funName ?? 'it') : 'it';
  }
  function act(x: Suggestion) {
    const b = blocks.find((y) => y.id === x.blockId);
    if (!b) return;
    const oldName = name0(b);
    const done =
      x.kind === 'add-level' ? `Added Level ${x.level}` : x.kind === 'drop-level' ? `Turned off Level ${x.level}` : x.kind === 'water-before' ? 'Added a water break before it' : x.kind === 'game-before' ? `Added ${byId.get(x.drillId!)?.funName ?? 'a game'} before it` : `Swapped in for ${oldName}`;
    const next = applySuggestion(blocks, x, byId);
    const added = next.find((y) => !blocks.some((o) => o.id === y.id))?.id;
    setApplied((prev) => [...prev, { key: x.key, blockId: x.blockId, done, why: x.title.replace(/\.$/, ''), before: b, added, short: x.kind === 'swap' ? `${byId.get(x.drillId!)?.funName ?? oldName} · swapped in` : x.short }]);
    setBlocks(() => next);
  }
  // Undo puts back only this change: the block as it was, or without the block it added.
  function undo(a: Applied) {
    setBlocks((bs) => (a.added ? bs.filter((y) => y.id !== a.added) : bs.map((y) => (y.id === a.blockId ? a.before : y))));
    setApplied((prev) => prev.filter((y) => y.key !== a.key));
  }
  function keepSug(x: Suggestion) {
    setKeptBy((m) => new Map(m).set(x.key, 'you'));
    start(async () => {
      const r = await keepSuggestion(plan.id, x.key);
      setKeptBy((m) => {
        const next = new Map(m);
        if (r.ok) next.set(x.key, r.editor);
        else next.delete(x.key);
        return next;
      });
      if (!r.ok) {
        setSaveState('error');
        setSaveError(r.error);
      }
    });
  }
  function pickFor(x: Suggestion, i: number) {
    const b = blocks[i];
    if (x.kind === 'game-before') setPicker({ mode: 'add', at: i, filter: 'basic', part: 'game', why: `A fun game before ${name0(b)}` });
    else setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'stations' || b.kind === 'rotation' ? b.kind : 'basic' });
  }

  const name = (b: Block) => (b.kind === 'activity' ? b.title : b.kind === 'rotation' ? ((b.drillId && byId.get(b.drillId)?.funName) ?? 'Rotation') : (byId.get(b.drillId)?.funName ?? 'Drill'));

  // What the drawer knows about the spot it was opened from, so it can open pre-filtered for it.
  function pickerSlot(p: Picker): DrawerSlot {
    if (p.mode === 'add') {
      const left = plan.minutes - used;
      return {
        label: p.why ?? `Into ${clock(p.at < blocks.length ? times[p.at] : endTime)}${p.at > 0 ? `, after ${name(blocks[p.at - 1])}` : ', at the start'}`,
        // A break is extra time on purpose, so it isn't held to the gap.
        fitsMinutes: left > 0 && !p.why ? left : null,
        part: p.part ?? (p.filter === 'basic' ? partForSlot(p.at, blocks.length) : null),
      };
    }
    const b = blocks.find((x) => x.id === p.blockId);
    const current = b && b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
    return {
      label: b ? `For the ${b.minutes}-min ${b.kind === 'activity' ? 'block' : b.kind} block${current ? `, instead of ${current.funName}` : ''}` : '',
      fitsMinutes: b ? b.minutes : null,
      part: p.filter === 'basic' && current ? current.part : null,
    };
  }

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
    } else if (choice === 'drill' || choice === 'stations' || choice === 'rotation') setPicker({ mode: 'add', at, filter: choice === 'drill' ? 'basic' : choice });
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
          if (n !== rotationToday(b, gc).active.length) lines.push(`The rotation runs ${n} zone${n === 1 ? '' : 's'} of ${b.minutes} min.`);
        }
        const d = b.kind === 'drill' || b.kind === 'stations' ? byId.get(b.drillId) : undefined;
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
          setPicker({ mode: 'fill', blockId: b.id, filter: next.kind === 'drill' ? 'basic' : next.kind });
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

  const startNote = (cls: string) => (copiedFrom ? <p className={`${cls} text-ink-200`}>Copied from {day(copiedFrom)}. Change what you need.</p> : null);

  return (
    <OpenDrill.Provider value={setViewing}>
    <div className="flex flex-col gap-5">
      {/* Plan bar: sticky on desktop, the practice on the left, its status in the middle, actions on the right */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 -mt-6 hidden border-b border-border-100 bg-surface-100/95 px-4 py-3 lg:-mx-8 lg:px-8 shadow-[0_6px_16px_-14px_rgba(14,27,30,0.5)] backdrop-blur lg:block print:hidden">
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
        {startNote('text-xs')}
      </div>
      {startNote('-mt-2 hidden text-sm lg:block')}
      {suggest && <PhoneLine day={suggest.day} open={[...openSug].sort((x, y) => blocks.findIndex((b) => b.id === x.blockId) - blocks.findIndex((b) => b.id === y.blockId))} />}

      {/* The plan leads on the white page; practice-wide info sits in a grey margin column beside it (design system: Panel). */}
      <div className="grid lg:-mb-24 lg:-mr-8 lg:-mt-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
        <ol className="flex min-w-0 flex-col pb-6 lg:pr-14 lg:pt-5">
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
              <section className={`blk grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-border-100 ${i === 0 ? 'border-t-0' : ''} ${b.kind === 'activity' ? 'py-2.5' : 'py-6'}`}>
                <div className="flex flex-col gap-0.5 pt-1">
                  <span className={`font-mono text-sm font-medium ${b.kind === 'activity' ? 'text-ink-200' : ''}`}>{clock(times[i])}</span>
                  {b.kind !== 'activity' && <span className="font-mono text-xs text-ink-200">{blockMinutes(b, gc)} min</span>}
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
                  feedback={b.kind !== 'activity' && b.drillId && !sugFor.has(b.id) ? feedback[b.drillId] : undefined}
                  variety={(variety.get(b.id) ?? []).filter((w) => !kept.has(`${b.id}:${w.rule}`))}
                  varietyAlso={fixesToo.get(b.id)}
                  suggestion={
                    suggest && sugFor.has(b.id) ? (
                      <SuggestionBox
                        s={sugFor.get(b.id)!}
                        day={suggest.day}
                        drill={sugFor.get(b.id)!.drillId ? byId.get(sugFor.get(b.id)!.drillId!) : undefined}
                        onApply={() => act(sugFor.get(b.id)!)}
                        onPick={() => pickFor(sugFor.get(b.id)!, i)}
                        onKeep={() => keepSug(sugFor.get(b.id)!)}
                      />
                    ) : null
                  }
                  appliedNotes={suggest ? applied.filter((a) => a.blockId === b.id).map((a) => <AppliedNote key={a.key} a={a} day={suggest.day} onUndo={() => undo(a)} />) : null}
                  levelSuggested={sugFor.get(b.id)?.kind === 'add-level' ? sugFor.get(b.id)!.level : undefined}
                  onSwap={() => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'stations' || b.kind === 'rotation' ? b.kind : 'basic' })}
                  onBreak={(rule) =>
                    rule === 'hard'
                      ? insert(i, newActivity('water'))
                      : setPicker({ mode: 'add', at: i, filter: 'basic', part: 'game', why: `A fun break before ${name(b)}` })
                  }
                  onKeep={(rule) => keep(`${b.id}:${rule}`)}
                  overNew={overNew.has(b.id) && !kept.has(`${b.id}:new`) ? { limit: team.newDrillsPerWeek, count: fresh.length } : null}
                  onKeepNew={() => keep(`${b.id}:new`)}
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
                            run: () => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'drill' ? 'basic' : b.kind }),
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
                  onChooseDrill={() => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'stations' || b.kind === 'rotation' ? b.kind : 'basic' })}

                />
              </section>
            </li>
          ))}
          <li id="gap-end" className="border-t border-border-100 pt-1">
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

        <div className="border-t border-border-100 pt-6 lg:border-l lg:border-t-0 lg:bg-surface-200 lg:px-7 lg:pb-24 lg:pt-7">
        <aside aria-label="This practice" className="flex flex-col gap-[18px] lg:sticky lg:top-[96px]">
          <p className="hidden text-xs font-semibold tracking-[0.02em] text-ink-200 lg:block">This practice</p>
          <div className="flex flex-col">
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
              setPicker({ mode: 'add', at, filter: 'basic' });
            }}
            addAt={(() => {
              const last = blocks[blocks.length - 1];
              return last?.kind === 'activity' && last.activity === 'huddle' ? times[blocks.length - 1] : endTime;
            })()}
          />
          {suggest && <CheckinPanel day={suggest.day} open={[...openSug].sort((x, y) => blocks.findIndex((b) => b.id === x.blockId) - blocks.findIndex((b) => b.id === y.blockId))} applied={applied} kept={keptSug} stays={sug.stays} />}
          <PanelSec title="Who's here today" right={`${units.reduce((n, u) => n + u.skaters, 0)} skaters`}>
            <ul className="grid grid-cols-3 gap-2">
              {units.map((u) => (
                <li key={u.key} className="flex min-w-0 flex-col">
                  <span className="font-mono text-xl font-medium leading-6">{u.skaters}</span>
                  <span className="truncate text-[13px] text-ink-200">{u.label}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setAttOpen(true)} className="w-fit text-[13px] text-rink-100 hover:underline">
              Change for today
            </button>
          </PanelSec>
          <PanelSec title="Focus" right={`${used} min`}>
            <ul className="flex flex-col gap-1">
              {FOCUS_ATTRIBUTES.map((a) => {
                const f = focus.find((x) => x.attribute === a)!;
                return (
                  <li key={a} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-[13px]">
                    <Pips level={f.level} />
                    <span className={f.level === 2 ? 'font-semibold' : f.level === 1 ? '' : 'text-ink-200'}>
                      {a}
                      {f.level === 2 && <span className="font-normal text-ink-200"> · Main</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </PanelSec>
          <PanelSec
            title="New to the kids"
            right={`${fresh.length} · usual ${team.newDrillsPerWeek}`}
            rightTone={fresh.length > team.newDrillsPerWeek ? 'text-whistle-100' : undefined}
          >
            {fresh.length ? (
              <ol className="flex flex-col gap-1 text-[13px]">
                {fresh.map((d, n) => (
                  <li key={d} className="grid grid-cols-[18px_minmax(0,1fr)] gap-1">
                    <span className={`font-mono ${n >= team.newDrillsPerWeek ? 'text-whistle-100' : 'text-ink-200'}`}>{n + 1}</span>
                    {byId.get(d)?.funName ?? 'Drill not live'}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-ink-200">All familiar. Nice and calm.</p>
            )}
          </PanelSec>
          {gear.length > 0 && (
            <PanelSec title="You need" right={`${gear.length} item${gear.length === 1 ? '' : 's'}`}>
              <ul className="flex flex-col gap-1 text-[13px]">
                {gear.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </PanelSec>
          )}
          </div>
        </aside>
        </div>
      </div>

      {/* Phone bottom bar */}
      <nav
        aria-label="Plan actions"
        className="fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-30 flex border-t border-border-100 bg-surface-100 px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 lg:hidden print:hidden"
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
          title={picker.filter === 'rotation' ? 'Choose a rotation' : picker.filter === 'stations' ? 'Choose a stations drill' : picker.mode === 'fill' ? 'Choose a drill' : 'Add a drill'}
          filter={picker.filter}
          slot={pickerSlot(picker)}
          lastRun={lastRun}
          recent={recentSet}
          feedback={feedback}
          favorites={favs}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}
      {viewing && byId.get(viewing) && (
        <DrillDrawer
          drill={byId.get(viewing)!}
          from={`/plans/${plan.id}`}
          backLabel="Back to the plan"
          favorite={favs[viewing] ?? null}
          onFavorite={(f) =>
            setFavs((m) => {
              const n = { ...m };
              if (f) n[viewing] = f;
              else delete n[viewing];
              return n;
            })
          }
          onClose={closeDrill}
        />
      )}
      {attOpen && <AttendanceDialog team={team} value={plan.attendance} preview={preview} onApply={setAttendance} onClose={() => setAttOpen(false)} />}
      {detailsOpen && <DetailsDialog plan={plan} setPlan={setPlan} onClose={() => setDetailsOpen(false)} />}
    </div>
    </OpenDrill.Provider>
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
  feedback,
  variety,
  varietyAlso,
  suggestion,
  appliedNotes,
  levelSuggested,
  onSwap,
  onBreak,
  onKeep,
  overNew,
  onKeepNew,
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
  feedback?: DrillFeedback;
  variety: VarietyWarning[];
  varietyAlso?: string;
  suggestion: React.ReactNode;
  appliedNotes: React.ReactNode;
  levelSuggested?: number;
  onSwap: () => void;
  onBreak: (rule: VarietyRule) => void;
  onKeep: (rule: VarietyRule) => void;
  overNew: { limit: number; count: number } | null;
  onKeepNew: () => void;
  update: (f: (b: Block) => Block) => void;
  menu: Parameters<typeof Menu>[0]['items'];
  onChooseDrill: () => void;
}) {
  void index;
  void count;
  const openDrill = useOpenDrill();
  const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
  const fewer = gc < 3;
  // A quiet, sentence-case label: what kind of block this is. Activities need none; they are one-line rows.
  let tag = '';
  let tone = 'text-rink-100';
  if (b.kind === 'drill') {
    const lv = d?.levels.length ? blockLevels(d, b) : [];
    tag = `Drill${lv.length > 1 ? ` · Levels ${lv.join(' → ')}` : lv.length ? ` · Level ${lv[0]} of ${d!.levels.length + 1}` : ''}`;
  }
  if (b.kind === 'stations') {
    tag = fewer ? `Stations · ${gc} group${gc === 1 ? '' : 's'} today` : 'Stations · one per group';
    tone = 'text-[var(--role-defense-100)]';
  }
  if (b.kind === 'rotation') {
    const { active, off } = rotationToday(b, gc);
    tag = b.stations.length ? `Rotation · ${active.length} zone${active.length === 1 ? '' : 's'}${off.length ? ' today' : ''}` : 'Rotation';
    tone = 'text-rink-200';
  }
  const act = b.kind === 'activity';
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className={`flex flex-wrap gap-3 ${act ? 'items-center' : 'items-start'}`}>
        <div className={`flex min-w-0 flex-[1_1_240px] ${act ? 'flex-wrap items-baseline gap-x-2.5' : 'flex-col gap-0.5'}`}>
          {tag && <span className={`text-xs font-medium ${tone}`}>{tag}</span>}
          {b.kind === 'activity' ? (
            <>
              <input
                aria-label="Block name"
                className="-mx-1 rounded px-1 text-base font-semibold leading-6 [field-sizing:content] max-w-[16rem] min-w-[4ch] hover:bg-surface-200 focus:bg-surface-200"
                value={b.title}
                maxLength={60}
                onChange={(e) => update((x) => ({ ...x, title: e.target.value }) as Block)}
              />
              <input
                aria-label="Note"
                placeholder="Add a note"
                className="-mx-1 min-w-0 flex-[1_1_12rem] rounded px-1 text-[13px] text-ink-200 placeholder:text-ink-200/0 hover:bg-surface-200 hover:placeholder:text-ink-200/70 focus:bg-surface-200 focus:placeholder:text-ink-200/70"
                value={b.note}
                maxLength={200}
                onChange={(e) => update((x) => ({ ...x, note: e.target.value }) as Block)}
              />
            </>
          ) : b.kind === 'rotation' && !d && isOldRotation(b) ? (
            <h2 className="font-display text-[22px] font-bold leading-7">Rotation</h2>
          ) : d ? (
            <>
              <button type="button" onClick={() => openDrill(d.id)} className="w-fit text-left font-display text-[22px] font-bold leading-7 hover:underline">
                {d.funName}
              </button>
              <span className="text-[13px] text-ink-200">{d.plainName}</span>
            </>
          ) : (
            <button type="button" onClick={onChooseDrill} className="w-fit font-display text-[22px] font-bold leading-7 text-rink-100 hover:underline">
              {b.drillId ? 'This drill isn’t live any more. Swap it' : b.kind === 'rotation' ? 'Choose a rotation' : 'Choose a drill'}
            </button>
          )}
        </div>
        {/* Minutes and the menu show on hover or keyboard focus (always on touch screens): see .blk-ctl in globals.css. */}
        <div className="blk-ctl flex items-center gap-1">
          <Stepper
            value={b.minutes}
            min={b.kind === 'rotation' ? 2 : 1}
            max={b.kind === 'rotation' ? 20 : 60}
            label={b.kind === 'rotation' ? 'min each' : 'min'}
            onChange={(m) => update((x) => ({ ...x, minutes: m }) as Block)}
          />
          <Menu items={menu} />
        </div>
      </div>
      {appliedNotes}
      {feedback && <FeedbackLine fb={feedback} />}
      {suggestion}
      {variety.map((w) => (
        <VarietyBox key={w.rule} w={w} also={varietyAlso} onSwap={onSwap} onBreak={() => onBreak(w.rule)} onKeep={() => onKeep(w.rule)} />
      ))}
      {overNew && (
        <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-[1.5px] border-dashed border-whistle-100 px-3.5 py-2.5">
          <p className="min-w-0 flex-[1_1_260px] text-sm">
            <b className="font-semibold text-whistle-100">{overNew.count} new drills today.</b>{' '}
            <span className="text-ink-200">Your usual is {overNew.limit}. Fine if it&apos;s on purpose.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSwap} className="min-h-9 rounded-full bg-ink-100 px-4 text-sm font-semibold text-surface-100 hover:opacity-90">
              Swap
            </button>
            <button type="button" onClick={onKeepNew} className="min-h-9 px-2 text-sm text-ink-200 hover:text-ink-100">
              Keep as is
            </button>
          </div>
        </div>
      )}
      {b.kind === 'drill' &&
        d &&
        (d.levels.length ? (
          <LevelPicker block={b} drill={d} suggested={levelSuggested} onLevels={(levels) => update((x) => (x.kind === 'drill' ? { ...x, levels } : x))} />
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
      <section className="flex flex-col gap-2.5 pb-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Time</h2>
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
    <section role={short ? undefined : 'alert'} className={`mb-[18px] flex flex-col gap-2.5 rounded-[10px] border-[1.5px] bg-surface-100 px-3.5 py-3 ${short ? 'border-whistle-100' : 'border-flag-100'}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{short ? `${-diff} min short` : `${diff} min over`}</h2>
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

/** A variety warning, inside the block that breaks the streak. Suggests; never changes the plan on its own. */
function VarietyBox({ w, also, onSwap, onBreak, onKeep }: { w: VarietyWarning; also?: string; onSwap: () => void; onBreak: () => void; onKeep: () => void }) {
  const breakLabel = w.rule === 'hard' ? 'Add a water break before it' : w.rule === 'skill' ? 'Add a fun game before it' : null;
  return (
    <div role="note" className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-whistle-100 bg-surface-200 px-3.5 pb-3.5 pt-3">
      <p className="text-sm">
        <b className="font-semibold">{w.text}</b> <span className="text-ink-200">{w.fix}</span>
        {also && <span className="text-ink-200"> {also}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSwap} className="min-h-9 rounded-full bg-ink-100 px-4 text-sm font-semibold text-surface-100 hover:opacity-90">
          Swap
        </button>
        {breakLabel && (
          <button type="button" onClick={onBreak} className="min-h-9 rounded-full border border-border-100 bg-surface-100 px-4 text-sm font-medium hover:bg-surface-300">
            {breakLabel}
          </button>
        )}
        <button type="button" onClick={onKeep} className="min-h-9 px-2 text-sm text-ink-200 hover:text-ink-100">
          Keep as is
        </button>
      </div>
    </div>
  );
}

/** A suggestion from the check-in, carried out on the plan (decision 0022). */
function applySuggestion(blocks: Block[], x: Suggestion, byId: Map<string, Drill>): Block[] {
  const i = blocks.findIndex((b) => b.id === x.blockId);
  if (i < 0) return blocks;
  const b = blocks[i];
  const d = x.drillId ? byId.get(x.drillId) : undefined;
  if ((x.kind === 'add-level' || x.kind === 'drop-level') && b.kind === 'drill') {
    const levels = x.kind === 'add-level' ? [...new Set([...b.levels, x.level!])].sort((m, n) => m - n) : b.levels.filter((l) => l !== x.level);
    return blocks.map((y) => (y.id === b.id ? { ...b, levels: levels.length ? levels : [1] } : y));
  }
  if (x.kind === 'swap' && d) return blocks.map((y) => (y.id === b.id ? { ...blockForDrill(d, b.minutes), id: b.id } : y));
  if (x.kind === 'game-before' && d) return [...blocks.slice(0, i), blockForDrill(d), ...blocks.slice(i)];
  if (x.kind === 'water-before') return [...blocks.slice(0, i), newActivity('water'), ...blocks.slice(i)];
  return blocks;
}
