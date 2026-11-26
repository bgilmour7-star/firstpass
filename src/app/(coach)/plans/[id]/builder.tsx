'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Pips } from '@/components/ds';
import { FOCUS_ATTRIBUTES, levelOf, startLevelFor, type Drill } from '@/lib/drills/schema';
import {
  addMinutes,
  attendanceLabel,
  blockForDrill,
  blockMinutes,
  changeBlock,
  clock,
  drillIds,
  isOldRotation,
  isAdapted,
  usualCounts,
  blockLevels,
  newActivity,
  newId,
  practiceFocus,
  rotationToday,
  startTimes,
  todayUnits,
  groupLabels,
  totalMinutes,
  unusedZones,
  zonesWithoutCoach,
  coachesToday,
  ZONES,
  type Attendance,
  type Block,
  type ChangeTarget,
  type Practice,
  type Team,
  type Zone,
} from '@/lib/plans/schema';
import { deletePractice, goalSuggestionTaken, keepSuggestion, savePractice } from '../actions';
import { RotationCard, StationsCard } from './blocks';
import { FORMAT_NAME, FormatIcon, LevelChips, formatWhat } from '@/components/drill-format';
import { LevelPills, PlayableRink } from './opened';
import { FavoriteButton } from '@/components/favorite-button';
import { Rink, RinkLegend } from '@/components/ds';
import type { RinkDiagramProps } from '../../../../../design-system/index';
import { DrillDrawer, OpenDrill, useOpenDrill } from '@/components/drill-drawer';
import { A, ActionButton, AttendanceDialog, FeedbackLine, Icon, input, LibraryDrawer, Menu, PanelSec, ShareControl, Stepper, useDismiss, type DrawerFilter, type DrawerSlot, type MenuItem, type QuickActivity } from './parts';
import type { DrillFeedback } from '@/lib/plans/feedback';
import type { Favorite } from '@/lib/app/store';
import { varietyWarnings, type VarietyRule, type VarietyWarning } from '@/lib/plans/variety';
import { partForSlot } from '@/lib/plans/drawer';
import { planShares, suggestions, type Suggestion } from '@/lib/plans/suggest';
import { AppliedNote, CheckinPanel, GoalsPanel, PhoneLine, SuggestionBox, type Applied, type SuggestContext } from './suggestions';

// The plan builder (decision 0004). A sticky plan bar keeps the key actions in reach on long plans
// (a bottom bar on phones); blocks can be added at any gap and changed to another kind in place;
// "Who's here today" adapts every block to the groups on the ice.

type Picker = { mode: 'add'; at: number; filter: DrawerFilter; part?: Drill['part']; why?: string } | { mode: 'fill'; blockId: string; filter: DrawerFilter };

const day = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

export function Builder({
  initial,
  team,
  drills,
  pool,
  ageNotice,
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
  /** The live library, to read the drills already in the plan. */
  drills: Drill[];
  /** What can be picked, swapped in or suggested: drills for the team's age (drillsForAge, decision 0025). */
  pool: Drill[];
  /** The U9 fallback line, when it's on. */
  ageNotice: string | null;
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
  // Read first (decision 0024): one drill open at a time; removing shows Undo.
  const [openId, setOpenId] = useState<string | null>(null);
  // Every change to the blocks can be undone (⌘Z / Ctrl+Z, or Undo on the toast): the last 40 versions.
  // Edits to the same block within two seconds (stepper taps, typing) count as one change.
  const [toast, setToast] = useState<{ text: string } | null>(null);
  const hist = useRef<{ blocks: Block[]; key?: string; at: number }[]>([]);
  const blocksRef = useRef(initial.blocks);
  blocksRef.current = plan.blocks;
  const desktop = useDesktop();
  const [undoKey, setUndoKey] = useState('⌘Z');
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) setUndoKey('Ctrl+Z');
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const [attOpen, setAttOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [leaveShort, setLeaveShort] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [, start] = useTransition();
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  // A drill goes in at its start level for the team's age (decision 0025). The pool carries the
  // U9 fallback's top-level start for borrowed U7 drills, so it is read from there first.
  const poolById = useMemo(() => new Map(pool.map((d) => [d.id, d])), [pool]);
  const startAt = useCallback((d: Drill) => startLevelFor(poolById.get(d.id) ?? d, team.ageGroup), [poolById, team.ageGroup]);
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
  // The first practice: everything is new to the kids, so there's no usual to go over.
  const firstPractice = knownSet.size === 0;
  if (!firstPractice) {
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
  const sug = suggest ? suggestions({ blocks, last: suggest.last, checkins: suggest.checkins, units: suggest.units, byId, pool, known: knownSet, feedback, runs: suggest.runs, team, goals: suggest.goals?.list, targets: suggest.goals?.targets }) : { list: [], stays: [] };
  const appliedKeys = new Set(applied.map((a) => a.key));
  const openSug = sug.list.filter((x) => !keptBy.has(x.key) && !appliedKeys.has(x.key));
  const keptSug = sug.list.filter((x) => keptBy.has(x.key)).map((x) => ({ ...x, editor: keptBy.get(x.key)! }));
  const sugFor = new Map(openSug.map((x) => [x.blockId, x]));
  // A variety warning that a suggestion would clear says so ("Swapping Snake in the Forest above fixes this too").
  const fixesToo = new Map<string, string>();
  for (const x of openSug) {
    if (!x.drillId || (x.kind !== 'swap' && x.kind !== 'game-before')) continue;
    const after = varietyWarnings(applySuggestion(blocks, x, byId, startAt), byId);
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
    const next = applySuggestion(blocks, x, byId, startAt);
    const added = next.find((y) => !blocks.some((o) => o.id === y.id))?.id;
    setApplied((prev) => [...prev, { key: x.key, blockId: x.blockId, done, why: x.title.replace(/\.$/, ''), from: x.source === 'goal' ? 'from your season goals' : `from ${suggest?.day ?? 'the last'}’s check-in`, before: b, added, short: x.kind === 'swap' ? `${byId.get(x.drillId!)?.funName ?? oldName} · swapped in` : x.short }]);
    setBlocks(() => next);
    if (x.source === 'goal') void goalSuggestionTaken(plan.id, x.key).catch(() => undefined);
  }
  // Undo puts back only this change: the block as it was, or without the block it added.
  function undo(a: Applied) {
    setBlocks((bs) => (a.added ? bs.filter((y) => y.id !== a.added) : bs.map((y) => (y.id === a.blockId ? a.before : y))));
    setApplied((prev) => prev.filter((y) => y.key !== a.key));
    if (a.key.startsWith('goal:')) void goalSuggestionTaken(plan.id, a.key, false).catch(() => undefined);
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
        presetPart: p.part ?? null,
      };
    }
    const b = blocks.find((x) => x.id === p.blockId);
    const current = b && b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
    return {
      label: b ? `For the ${blockMinutes(b, gc)}-min ${b.kind === 'activity' ? 'block' : b.kind} block${current ? `, instead of ${current.funName}` : ''}` : '',
      // The whole block's time: a rotation's minutes are per zone, and a rotation drill is judged by its total.
      fitsMinutes: b ? blockMinutes(b, gc) : null,
      part: p.filter === 'basic' && current ? current.part : null,
    };
  }

  function setBlocks(f: (b: Block[]) => Block[], o: { key?: string; toast?: string } = {}) {
    const prev = blocksRef.current;
    const next = f(prev);
    if (next === prev) return;
    const h = hist.current;
    const last = h[h.length - 1];
    const now = Date.now();
    if (o.key && last?.key === o.key && now - last.at < 2000) last.at = now;
    else h.push({ blocks: prev, key: o.key, at: now });
    if (h.length > 40) h.shift();
    blocksRef.current = next;
    setPlan((p) => ({ ...p, blocks: next }));
    setToast(o.toast ? { text: o.toast } : null);
  }
  function undoLast() {
    const h = hist.current.pop();
    if (!h) return;
    blocksRef.current = h.blocks;
    setPlan((p) => ({ ...p, blocks: h.blocks }));
    setToast(null);
    // A suggestion undone this way stops showing its own Undo note.
    const still = (a: Applied) => (a.added ? h.blocks.some((y) => y.id === a.added) : JSON.stringify(h.blocks.find((y) => y.id === a.blockId)) !== JSON.stringify(a.before));
    for (const a of applied) if (!still(a) && a.key.startsWith('goal:')) void goalSuggestionTaken(plan.id, a.key, false).catch(() => undefined);
    setApplied((prev) => prev.filter(still));
  }
  // A drawer or dialog on top keeps Escape and ⌘Z for itself.
  const overlay = useRef(false);
  overlay.current = !!(picker || viewing || attOpen || detailsOpen);
  const undoRef = useRef(undoLast);
  undoRef.current = undoLast;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      // Typing in a field keeps the field's own undo.
      if (overlay.current || (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      undoRef.current();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const update = (id: string, f: (b: Block) => Block, key = `edit:${id}`) => setBlocks((bs) => bs.map((b) => (b.id === id ? f(b) : b)), { key });
  const move = (from: number, to: number) => {
    const bs = blocksRef.current;
    if (to < 0 || to >= bs.length || from === to) return;
    const c = [...bs];
    const [x] = c.splice(from, 1);
    c.splice(to, 0, x);
    setBlocks(() => c, { toast: `Moved ${name(x)} to ${clock(startTimes(plan.startTime, c, gc)[to])}` });
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  const insert = (at: number, b: Block) => setBlocks((bs) => [...bs.slice(0, at), b, ...bs.slice(at)]);

  // One picker for everything (decision 0024): the drill decides the kind of block.
  const addAt = () => {
    const last = blocks[blocks.length - 1];
    return last?.kind === 'activity' && last.activity === 'huddle' ? blocks.length - 1 : blocks.length;
  };
  const openAdd = (at: number) => setPicker({ mode: 'add', at, filter: 'all' });
  const quick = (k: QuickActivity) => {
    if (picker?.mode !== 'add') return;
    insert(picker.at, newActivity(k, k === 'water' ? 2 : k === 'huddle' ? 3 : 5));
    setPicker(null);
  };
  const remove = (b: Block) => {
    setOpenId(null);
    setBlocks((bs) => bs.filter((x) => x.id !== b.id), { toast: `Removed ${name(b)}` });
  };

  // The open drill: in the right column on desktop (it takes the place of This practice), in a sheet on phones.
  const openIndex = blocks.findIndex((b) => b.id === openId);
  const closeOpen = useCallback(() => {
    setOpenId((id) => {
      if (id) requestAnimationFrame(() => document.getElementById(`open-${id}`)?.focus());
      return null;
    });
  }, []);
  useEffect(() => {
    if (!openId) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && !overlay.current && closeOpen();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [openId, closeOpen]);

  // Phones: long-press a drill, then drag it (desktop drags by the grip).
  const press = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> } | null>(null);
  const dragged = useRef(false);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const pressStart = (e: React.PointerEvent, i: number) => {
    if (e.pointerType !== 'touch' || desktop) return;
    const t = setTimeout(() => {
      press.current = null;
      navigator.vibrate?.(10);
      setDrag({ from: i, over: i });
    }, 450);
    press.current = { x: e.clientX, y: e.clientY, t };
  };
  const pressMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      clearTimeout(p.t);
      press.current = null;
    }
  };
  const pressEnd = () => {
    if (press.current) clearTimeout(press.current.t);
    press.current = null;
  };
  const touchDrag = !desktop && drag !== null;
  useEffect(() => {
    if (!touchDrag) return;
    const mv = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-blk]');
      if (!el) return;
      const over = Number(el.getAttribute('data-blk'));
      setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
    };
    const end = () => {
      const d = dragRef.current;
      if (d) moveRef.current(d.from, d.over);
      setDrag(null);
      // The finger lifting would also tap the drill open.
      dragged.current = true;
      setTimeout(() => (dragged.current = false), 400);
    };
    const cancel = () => setDrag(null);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', cancel);
    return () => {
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [touchDrag]);

  const swapFor = (b: Block) => setPicker({ mode: 'fill', blockId: b.id, filter: b.kind === 'stations' || b.kind === 'rotation' ? b.kind : 'basic' });
  // The ⋯ menu (design system: DrillActions): only the actions that apply to this block.
  // Swap only applies to a drill (or an old rotation); everything else gets a drill through "Change to".
  const canSwap = (b: Block): boolean => b.kind !== 'activity' && (Boolean(b.drillId && byId.has(b.drillId)) || isOldRotation(b));
  // inPill: the desktop hover pill already shows Add after, Swap and Remove as buttons, so the ⋯ menu leaves them out.
  const menuFor = (b: Block, i: number, inPill = false): MenuItem[] => {
    const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
    const items: MenuItem[] = [];
    if (!inPill && canSwap(b)) items.push({ label: 'Swap for another drill', icon: A.swap, run: () => swapFor(b) });
    if (b.kind === 'drill' && d && d.levels.length > 0) items.push({
        label: 'Change levels',
        icon: A.levels,
        run: () => {
          setOpenId(b.id);
          setTimeout(() => {
            const el = document.getElementById(`levels-${b.id}`);
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
          }, 50);
        },
      });
    items.push({ label: 'Change to', icon: A.change, sub: changeTargets(b), note: 'Keeps the time slot and minutes' });
    items.push({ label: 'Duplicate', icon: A.duplicate, run: () => setBlocks((bs) => [...bs.slice(0, i + 1), { ...structuredClone(b), id: newId() }, ...bs.slice(i + 1)], { toast: `Duplicated ${name(b)}` }) });
    if (!inPill) items.push({ label: 'Add a drill after', icon: Icon.plus(16), run: () => openAdd(i + 1) });
    if (i > 0) items.push({ label: 'Move to the start', icon: A.start, run: () => move(i, 0) });
    if (i < blocks.length - 1) items.push({ label: 'Move to the end', icon: A.end, run: () => move(i, blocks.length - 1) });
    if (d) items.push({ label: 'Open details', icon: A.details, run: () => setViewing(d.id) });
    if (!inPill) items.push({ label: 'Remove', icon: A.remove, danger: true, sep: true, run: () => remove(b) });
    return items;
  };
  const pill = (b: Block, i: number) => (
    <span role="toolbar" aria-label={`Actions for ${name(b)}`} className="inline-flex w-max items-center gap-1 rounded-full border border-border-100 bg-surface-100 p-1">
      <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-9 place-items-center rounded-full hover:bg-surface-200 disabled:opacity-30">
        {A.up}
      </button>
      <button type="button" aria-label="Move down" title="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)} className="grid size-9 place-items-center rounded-full hover:bg-surface-200 disabled:opacity-30">
        {A.down}
      </button>
      <button type="button" aria-label={`Add a drill after ${name(b)}`} title="Add a drill after" onClick={() => openAdd(i + 1)} className="grid size-9 place-items-center rounded-full hover:bg-surface-200">
        {Icon.plus(16)}
      </button>
      {canSwap(b) && (
        <button type="button" aria-label="Swap for another drill" title="Swap for another drill" onClick={() => swapFor(b)} className="grid size-9 place-items-center rounded-full hover:bg-surface-200">
          {A.swap}
        </button>
      )}
      <button type="button" aria-label={`Remove ${name(b)}`} title="Remove" onClick={() => remove(b)} className="grid size-9 place-items-center rounded-full text-flag-100 hover:bg-surface-200">
        {A.remove}
      </button>
      <Menu items={menuFor(b, i, true)} />
    </span>
  );

  function pick(drillId: string) {
    if (!picker) return;
    const d = byId.get(drillId);
    if (!d) return;
    if (picker.mode === 'add') insert(picker.at, blockForDrill(d, d.minutes, startAt(d)));
    if (picker.mode === 'fill')
      update(picker.blockId, (b) => {
        // A rotation keeps its minutes per station; an activity takes the drill's own minutes.
        const keep = b.kind === 'activity' ? d.minutes : b.kind === 'rotation' ? (d.groupModel === 'rotation' ? b.minutes : d.minutes) : d.groupModel === 'rotation' ? d.minutes : b.minutes;
        return { ...blockForDrill(d, keep, startAt(d)), id: b.id };
      });
    setPicker(null);
  }

  // Decision 0046: say what changed when the plan updates, with Undo.
  const [changed, setChanged] = useState<{ text: string; free: number; prev: Attendance | null } | null>(null);
  const setAttendance = (a: Attendance | null, how: 'update' | 'keep' = 'update') => {
    const prev = plan.attendance;
    const next = a && isAdapted(team, a) ? a : null;
    if (how === 'update' && next) {
      const u2 = todayUnits(team, next);
      const c = coachesToday(team, next);
      const free = used - totalMinutes(blocks, u2.length);
      const lines = preview(next);
      setChanged({ text: `Plan updated for ${c} coach${c === 1 ? '' : 'es'} and ${u2.length} group${u2.length === 1 ? '' : 's'}.${lines.length ? ' ' + lines.join(' ') : ''}`, free: Math.max(0, free), prev });
    } else setChanged(null);
    setPlan((p) => ({ ...p, attendance: next }));
    setAttOpen(false);
  };
  const zonesOff = zonesWithoutCoach(team, plan.attendance, units);
  const runZones = () => setAttendance({ ...(plan.attendance ?? { counts: usualCounts(team), merges: [] }), groups: coachesToday(team, plan.attendance) });
  const keepZones = () => setPlan((p) => ({ ...p, attendance: { ...(p.attendance ?? { counts: usualCounts(team), merges: [] }), keepZones: true } }));

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
        ['drill', FORMAT_NAME.basic],
        ['stations', FORMAT_NAME.stations],
        ['rotation', FORMAT_NAME.rotation],
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

  const panelFor = (i: number, phone = false) => {
    const b = blocks[i];
    const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
    return (
      <BlockPanel
        key={b.id}
        block={b}
        index={i}
        count={blocks.length}
        start={times[i]}
        phone={phone}
        units={units}
        gc={gc}
        byId={byId}
        known={knownSet}
        feedback={d ? feedback[d.id] : undefined}
        levelSuggested={sugFor.get(b.id)?.kind === 'add-level' ? sugFor.get(b.id)!.level : undefined}
        used={used}
        total={plan.minutes}
        update={(f, key) => update(b.id, f, key)}
        onSwap={() => swapFor(b)}
        onMove={(to) => move(i, to)}
        menu={menuFor(b, i)}
        onClose={closeOpen}
        favorite={d ? (favs[d.id] ?? null) : null}
        onFavorite={(f) => {
          if (!d) return;
          setFavs((m) => {
            const n = { ...m };
            if (f) n[d.id] = f;
            else delete n[d.id];
            return n;
          });
        }}
      />
    );
  };

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

  // The grey column pins just under the plan bar, whatever its height (2026-11-25).
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(72);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const startNote = (cls: string) => (copiedFrom ? <p className={`${cls} text-ink-200`}>Copied from {day(copiedFrom)}. Change what you need.</p> : null);

  return (
    <OpenDrill.Provider value={setViewing}>
    <div className="flex flex-col gap-5">
      {/* Plan bar: sticky on desktop, the practice on the left, its status in the middle, actions on the right */}
      <div ref={barRef} className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 -mt-6 hidden border-b border-border-100 bg-surface-100/95 px-4 py-3 lg:-mx-8 lg:px-8 shadow-[0_6px_16px_-14px_rgba(14,27,30,0.5)] backdrop-blur lg:block print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={() => setDetailsOpen(true)} className="flex min-w-0 flex-col items-start text-left" aria-label="Date, time and ice">
              <span className="font-display text-xl font-extrabold leading-6">{day(plan.date)}</span>
              <span className="truncate text-[13px] text-ink-200">
                {clock(plan.startTime)}–{clock(addMinutes(plan.startTime, plan.minutes))} · {plan.ice === 'half' ? 'Half ice' : 'Full ice'} · {saved}
              </span>
            </button>
            {attChip}
          </div>
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
              onClick={() => openAdd(addAt())}
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full bg-rink-100 px-4 text-sm font-medium text-surface-100 hover:bg-rink-200"
            >
              {Icon.plus(16)} Add a drill
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
      <div className="grid lg:-mb-24 lg:-mr-8 lg:-mt-5 lg:grid-cols-[minmax(0,1fr)_clamp(340px,30vw,560px)] lg:items-stretch">
        <ol className="flex min-w-0 flex-col pb-6 lg:pr-14 lg:pt-5">
          {changed && (
            <li role="status" className="mb-2 mt-3 flex flex-col gap-2 rounded-xl border border-rink-100 px-3.5 py-3 lg:mt-0">
              <span className="text-sm leading-normal">{changed.text}</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setPlan((p) => ({ ...p, attendance: changed.prev })); setChanged(null); }} className="min-h-10 rounded-full border border-border-100 px-3.5 text-sm hover:bg-surface-200">
                  Undo
                </button>
                {changed.free > 0 && (
                  <button type="button" onClick={() => { setChanged(null); document.getElementById('time-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="min-h-10 rounded-full border border-border-100 px-3.5 text-sm hover:bg-surface-200">
                    Use the {changed.free} minutes
                  </button>
                )}
                <button type="button" onClick={() => setChanged(null)} className="min-h-10 px-2 text-sm text-ink-200 hover:text-ink-100">
                  Got it
                </button>
              </span>
              <span className="text-xs text-ink-200">
                {team.planning === 'ask' ? 'You chose to update the plan.' : 'Your team lets Firstpass update the plan.'}{' '}
                <Link href="/team/settings" className="text-rink-100 underline underline-offset-2">Change in Team settings</Link>
              </span>
            </li>
          )}
          {blocks.map((b, i) => (
            <li
              key={b.id}
              data-blk={i}
              draggable={armed === b.id}
              onPointerDown={(e) => pressStart(e, i)}
              onPointerMove={pressMove}
              onPointerUp={pressEnd}
              onPointerCancel={pressEnd}
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
                if (drag) move(drag.from, drag.over);
                setDrag(null);
                setArmed(null);
              }}
              onDragEnd={() => {
                setDrag(null);
                setArmed(null);
              }}
              className={`flex flex-col max-lg:select-none max-lg:[-webkit-touch-callout:none] ${drag?.from === i ? 'opacity-40' : ''} ${drag && drag.over === i && drag.from !== i ? (drag.from < i ? 'border-b-4 border-rink-100' : 'border-t-4 border-rink-100') : ''}`}
            >
              {/* The whole row opens the drill (2026-11-25): a click anywhere but on the row's own controls acts
                  like a click on its name, so a tall row has no dead space. */}
              <section
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label, [role="menu"], [role="menuitem"], [role="dialog"]')) return;
                  document.getElementById(`open-${b.id}`)?.click();
                }}
                className={`blk group grid cursor-pointer grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-border-100 lg:-mx-3 lg:grid-cols-[96px_minmax(0,1fr)] lg:rounded-xl lg:px-3 ${i === 0 ? 'border-t-0' : ''} ${b.kind === 'activity' ? 'py-4' : 'py-6 lg:py-7'} ${openId === b.id ? '-mx-4 bg-surface-200/60 px-4 lg:outline lg:outline-2 lg:-outline-offset-2 lg:outline-rink-100' : 'lg:hover:bg-surface-200/50'}`}
              >
                <div className="flex flex-col items-start gap-0.5 pt-1">
                  <span className={`font-mono text-sm font-medium ${b.kind === 'activity' ? 'text-ink-200' : ''}`}>{clock(times[i])}</span>
                  {/* Minutes: the number, or a stepper while the row is hovered or focused (desktop). No "min" label
                      under the stepper: it pushed the row down, and the rows around it already say "min". */}
                  <span className={`font-mono text-xs text-ink-200 ${desktop ? 'lg:group-focus-within:hidden lg:group-hover:hidden' : ''}`}>{blockMinutes(b, gc)} min</span>
                  {desktop && (
                    <span className="hidden lg:group-focus-within:flex lg:group-hover:flex">
                      <Stepper size="sm" label="" value={b.minutes} min={b.kind === 'rotation' ? 2 : 1} max={b.kind === 'rotation' ? 20 : 60} onChange={(m) => update(b.id, (x) => ({ ...x, minutes: m }) as Block, `min:${b.id}`)} />
                    </span>
                  )}
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
                  appliedNotes={suggest ? applied.filter((a) => a.blockId === b.id).map((a) => <AppliedNote key={a.key} a={a} onUndo={() => undo(a)} />) : null}
                  zoneWarn={b.kind === 'rotation' && zonesOff > 0 ? { zones: units.length, coaches: coachesToday(team, plan.attendance), onRun: runZones, onKeep: keepZones } : undefined}
                  onSwap={() => swapFor(b)}
                  onBreak={(rule) =>
                    rule === 'hard'
                      ? insert(i, newActivity('water'))
                      : setPicker({ mode: 'add', at: i, filter: 'basic', part: 'game', why: `A fun break before ${name(b)}` })
                  }
                  onKeep={(rule) => keep(`${b.id}:${rule}`)}
                  overNew={overNew.has(b.id) && !kept.has(`${b.id}:new`) ? { limit: team.newDrillsPerWeek, count: fresh.length } : null}
                  onKeepNew={() => keep(`${b.id}:new`)}
                  onChooseDrill={() => swapFor(b)}
                  selected={openId === b.id}
                  onOpen={() => {
                    if (dragged.current) return;
                    setOpenId((o) => (o === b.id && desktop ? null : b.id));
                  }}
                  actions={desktop ? pill(b, i) : null}
                />
              </section>
            </li>
          ))}
          <li className="border-t border-border-100 pt-3">
            <button type="button" onClick={() => openAdd(addAt())} className="min-h-11 pl-[68px] text-sm font-medium text-rink-100 hover:underline">
              + Add a drill
            </button>
          </li>
        </ol>

        {/* The grey column is one scroll area pinned under the plan bar (2026-11-25): its padding sits inside it, so
            there's a single scrollbar at the right edge and nothing is clipped. */}
        <div className="border-t border-border-100 pt-6 lg:border-l lg:border-t-0 lg:bg-surface-200 lg:pt-0">
        <div style={{ '--bar': `${barH}px` } as React.CSSProperties} className="lg:sticky lg:top-[var(--bar)] lg:h-[calc(100dvh-var(--bar))] lg:overflow-y-auto lg:overflow-x-hidden lg:px-7 lg:pb-16 lg:[scrollbar-gutter:stable]">
        {desktop && openIndex >= 0 ? (
          <section aria-label={name(blocks[openIndex])}>
            {panelFor(openIndex)}
          </section>
        ) : (
        <aside aria-label="This practice" className="flex flex-col gap-6 lg:pt-6">
          <p className="hidden text-sm font-semibold tracking-[0.02em] text-ink-200 lg:block">This practice</p>
          <div className="flex flex-col">
          <div id="time-card" />
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
            onAddDrill={() => openAdd(addAt())}
            addAt={(() => {
              const last = blocks[blocks.length - 1];
              return last?.kind === 'activity' && last.activity === 'huddle' ? times[blocks.length - 1] : endTime;
            })()}
          />
          {suggest?.goals && <GoalsPanel goals={suggest.goals} shares={planShares(blocks, byId, gc)} />}
          {suggest && <CheckinPanel day={suggest.day} open={[...openSug].sort((x, y) => blocks.findIndex((b) => b.id === x.blockId) - blocks.findIndex((b) => b.id === y.blockId))} applied={applied} kept={keptSug} stays={sug.stays} />}
          <PanelSec title="Who's here today" right={`${units.reduce((n, u) => n + u.skaters, 0)} skaters · ${coachesToday(team, plan.attendance)} coach${coachesToday(team, plan.attendance) === 1 ? '' : 'es'}`}>
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
                // The team's focus from Create a team (decision 0039): marked, and flagged when this plan doesn't work it.
                const picked = team.focus.includes(a);
                return (
                  <li key={a} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-[13px]">
                    <Pips level={f.level} />
                    <span className={f.level === 2 ? 'font-semibold' : f.level === 1 ? '' : 'text-ink-200'}>
                      {a}
                      {f.level === 2 && <span className="font-normal text-ink-200"> · Main</span>}
                      {picked && <span className={`font-normal ${f.level ? 'text-rink-100' : 'text-whistle-100'}`}>{f.level ? ' · Your focus' : ' · Your focus, not in this plan'}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </PanelSec>
          <PanelSec
            title="New to the kids"
            right={firstPractice ? `${fresh.length}` : `${fresh.length} · usual ${team.newDrillsPerWeek}`}
            rightTone={!firstPractice && fresh.length > team.newDrillsPerWeek ? 'text-whistle-100' : undefined}
          >
            {firstPractice ? (
              <p className="text-[13px] text-ink-200">Your first practice, so it’s all new. From the next one, Firstpass keeps it to about {team.newDrillsPerWeek} new drills.</p>
            ) : fresh.length ? (
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
        )}
        </div>
        </div>
      </div>
      {!desktop && openIndex >= 0 && (
        <Sheet title={name(blocks[openIndex])} onClose={closeOpen}>
          {panelFor(openIndex, true)}
        </Sheet>
      )}

      {/* Phone bottom bar */}
      <nav
        aria-label="Plan actions"
        className="fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-30 flex border-t border-border-100 bg-surface-100 px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 lg:hidden print:hidden"
      >
        <button type="button" onClick={() => openAdd(addAt())} className="flex flex-1 flex-col items-center gap-0.5 text-[11px] font-semibold text-rink-100">
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
        <Link href={`/today?plan=${plan.id}`} className="flex flex-1 flex-col items-center gap-0.5 text-[11px]">
          {Icon.rinkside(20)}
          Rink-side
        </Link>
      </nav>

      {toast && (
        <div role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-full bg-ink-100 py-1.5 pl-4 pr-1.5 text-sm text-surface-100 shadow-lg lg:bottom-6 print:hidden">
          <span className="min-w-0 flex-1 truncate">{toast.text}</span>
          {desktop && <span className="font-mono text-xs opacity-80">{undoKey}</span>}
          <button type="button" onClick={undoLast} className="min-h-9 rounded-full bg-surface-100 px-4 font-semibold text-ink-100">
            Undo
          </button>
        </div>
      )}
      {picker && (
        <LibraryDrawer
          drills={pool}
          ageGroup={team.ageGroup}
          notice={ageNotice}
          known={knownSet}
          inPlan={inPlan}
          title={picker.mode === 'add' ? 'Add a drill' : picker.filter === 'rotation' ? 'Choose a rotation' : picker.filter === 'stations' ? 'Choose a split-by-skill drill' : 'Choose a drill'}
          filter={picker.filter}
          slot={pickerSlot(picker)}
          lastRun={lastRun}
          recent={recentSet}
          feedback={feedback}
          favorites={favs}
          onPick={pick}
          onActivity={picker.mode === 'add' && !picker.part ? quick : undefined}
          onClose={() => setPicker(null)}
        />
      )}
      {viewing && byId.get(viewing) && (
        <DrillDrawer
          groupNames={groupLabels(team)}
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

/** Desktop (lg and up) or phone: the open drill shows in the right column or in a sheet. */
function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const f = () => setD(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return d;
}

// A row in the plan (decision 0024, design system: DrillActions): how it's organised, its name, a
// thumbnail and the one message it carries. Clicking it opens the drill; on desktop the frequent
// actions (move up, move down, ⋯) show under the name while the row is hovered or focused.
function BlockBody({
  block: b,
  gc,
  byId,
  feedback,
  variety,
  varietyAlso,
  suggestion,
  appliedNotes,
  onSwap,
  onBreak,
  onKeep,
  overNew,
  onKeepNew,
  onChooseDrill,
  selected,
  onOpen,
  actions,
  zoneWarn,
}: {
  zoneWarn?: { zones: number; coaches: number; onRun: () => void; onKeep: () => void };
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
  onSwap: () => void;
  onBreak: (rule: VarietyRule) => void;
  onKeep: (rule: VarietyRule) => void;
  overNew: { limit: number; count: number } | null;
  onKeepNew: () => void;
  onChooseDrill: () => void;
  selected: boolean;
  onOpen: () => void;
  actions: React.ReactNode;
}) {
  const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
  const act = b.kind === 'activity';
  const tag = blockTag(b, d, gc);
  const empty = !act && !d && !(b.kind === 'rotation' && isOldRotation(b));
  // One message per drill: a suggestion first, then the variety check, then the new-drill limit, then what coaches said.
  const box =
    (zoneWarn ? (
      <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-[1.5px] border-dashed border-whistle-100 px-3.5 py-2.5">
        <p className="min-w-0 flex-[1_1_260px] text-sm">
          <b className="font-semibold text-warn-text">
            {zoneWarn.zones} zones, {zoneWarn.coaches} coach{zoneWarn.coaches === 1 ? '' : 'es'} today.
          </b>{' '}
          <span className="text-ink-200">{zoneWarn.zones - zoneWarn.coaches === 1 ? 'One zone has' : `${zoneWarn.zones - zoneWarn.coaches} zones have`} no coach.</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={zoneWarn.onRun} className="min-h-10 rounded-full bg-ink-100 px-4 text-sm font-semibold text-surface-100 hover:opacity-90">
            Run {zoneWarn.coaches} zone{zoneWarn.coaches === 1 ? '' : 's'}
          </button>
          <button type="button" onClick={zoneWarn.onKeep} className="min-h-10 px-2 text-sm text-ink-200 hover:text-ink-100">
            Keep {zoneWarn.zones}
          </button>
        </div>
      </div>
    ) : null) ??
    suggestion ??
    (variety[0] ? (
      <VarietyBox w={variety[0]} also={varietyAlso} onSwap={onSwap} onBreak={() => onBreak(variety[0].rule)} onKeep={() => onKeep(variety[0].rule)} />
    ) : overNew ? (
      <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-[1.5px] border-dashed border-whistle-100 px-3.5 py-2.5">
        <p className="min-w-0 flex-[1_1_260px] text-sm">
          <b className="font-semibold text-whistle-100">{overNew.count} new drills today.</b> <span className="text-ink-200">Your usual is {overNew.limit}. Fine if it&apos;s on purpose.</span>
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
    ) : null);
  const open = empty ? onChooseDrill : onOpen;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 ${act ? 'items-center' : 'items-start'}`}>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <button id={`open-${b.id}`} type="button" onClick={open} aria-expanded={empty ? undefined : selected} className="flex w-full min-w-0 flex-col gap-0.5 text-left">
            {tag && <span className="flex items-center gap-1.5 text-xs font-medium text-rink-100">{tag}</span>}
            {act ? (
              <span className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-base font-semibold leading-6">{b.title}</span>
                {b.note && <span className="text-[13px] text-ink-200">{b.note}</span>}
              </span>
            ) : d ? (
              <>
                <span className="font-display text-[22px] font-bold leading-7">{d.funName}</span>
                <span className="text-[13px] text-ink-200">{d.plainName}</span>
              </>
            ) : b.kind === 'rotation' && isOldRotation(b) ? (
              <span className="font-display text-[22px] font-bold leading-7">{FORMAT_NAME.rotation}</span>
            ) : (
              <span className="font-display text-[22px] font-bold leading-7 text-rink-100">{b.drillId ? 'This drill isn’t live any more. Swap it' : b.kind === 'rotation' ? 'Choose a rotation' : 'Choose a drill'}</span>
            )}
          </button>
          {actions && (
            <span className={`${selected ? 'flex' : 'hidden group-focus-within:flex group-hover:flex group-has-[[aria-expanded=true]]:flex'}`}>{actions}</span>
          )}
        </div>
        {d && (
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={open} className="block w-[92px] overflow-hidden rounded-md border border-border-100 sm:w-[132px] lg:w-[184px]">
            <Rink spec={d.diagram} title={d.funName} detail="thumb" />
          </button>
        )}
      </div>
      {appliedNotes}
      {box}
      {!box && feedback && <FeedbackLine fb={feedback} />}
    </div>
  );
}

/** The quiet line above a drill's name: its levels, or how a station or rotation block runs today. */
function blockTag(b: Block, d: Drill | undefined, gc: number): React.ReactNode {
  if (b.kind === 'drill' && d) {
    const lv = d.levels.length ? blockLevels(d, b) : [];
    return (
      <>
        <FormatIcon model="basic" />
        {FORMAT_NAME.basic}
        {lv.length > 0 && <LevelChips count={d.levels.length + 1} on={lv} className="ml-0.5" />}
      </>
    );
  }
  if (b.kind === 'stations')
    return (
      <>
        <FormatIcon model="stations" />
        {FORMAT_NAME.stations}
        {gc < 3 ? ` · ${gc} group${gc === 1 ? '' : 's'} today` : ''}
      </>
    );
  if (b.kind === 'rotation' && (d || isOldRotation(b))) {
    const { active, off } = rotationToday(b, gc);
    return (
      <>
        <FormatIcon model="rotation" />
        {FORMAT_NAME.rotation} · {b.minutes} min a zone{off.length ? ` · ${active.length} zone${active.length === 1 ? '' : 's'} today` : ''}
      </>
    );
  }
  return null;
}

// The open drill (design system: DrillActions): the same actions as the row, labelled, then
// everything about the drill. Desktop shows it in the right column, phones in a sheet.
function BlockPanel({
  block: b,
  index,
  count,
  start,
  phone,
  units,
  gc,
  byId,
  known,
  feedback,
  levelSuggested,
  used,
  total,
  update,
  onSwap,
  onMove,
  menu,
  onClose,
  favorite,
  onFavorite,
}: {
  block: Block;
  index: number;
  count: number;
  start: string;
  phone: boolean;
  units: ReturnType<typeof todayUnits>;
  gc: number;
  byId: Map<string, Drill>;
  known: Set<string>;
  feedback?: DrillFeedback;
  levelSuggested?: number;
  used: number;
  total: number;
  update: (f: (b: Block) => Block, key?: string) => void;
  onSwap: () => void;
  onMove: (to: number) => void;
  menu: MenuItem[];
  onClose: () => void;
  favorite: Favorite | null;
  onFavorite: (f: Favorite | null) => void;
}) {
  const openDrill = useOpenDrill();
  const d = b.kind !== 'activity' && b.drillId ? byId.get(b.drillId) : undefined;
  const act = b.kind === 'activity';
  const mins = blockMinutes(b, gc);
  const zones = b.kind === 'rotation' ? Math.max(1, rotationToday(b, gc).active.length) : 1;
  const title = act ? b.title : d ? d.funName : b.kind === 'rotation' && isOldRotation(b) ? FORMAT_NAME.rotation : b.kind === 'rotation' ? 'Choose a rotation' : 'Choose a drill';
  const tag = blockTag(b, d, gc);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!phone) heading.current?.focus();
  }, [phone]);

  const stepper = (
    <Stepper
      size={phone ? 'lg' : 'md'}
      value={b.minutes}
      min={b.kind === 'rotation' ? 2 : 1}
      max={b.kind === 'rotation' ? 20 : 60}
      label="min"
      onChange={(m) => update((x) => ({ ...x, minutes: m }) as Block, `min:${b.id}`)}
    />
  );
  const perZone =
    b.kind === 'rotation' ? (
      <span className="text-[13px] text-ink-200">
        a zone · <b className="font-mono font-medium text-ink-100">{zones} × {b.minutes} = {mins} min</b>
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* The way back stays in view while the drill scrolls (2026-11-25). Escape and clicking the row again work too. */}
      {!phone && (
        <div className="sticky top-0 z-10 -mx-7 flex items-center justify-between gap-3 border-b border-border-100 bg-surface-200 px-7 py-2">
          <button type="button" onClick={onClose} className="-ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-surface-100">
            <span aria-hidden="true" className="text-lg leading-none">‹</span> This practice
          </button>
          <span className={`font-mono text-[13px] ${used === total ? 'text-good-100' : used > total ? 'text-flag-100' : 'text-whistle-100'}`}>
            {used} of {total} min
          </span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-200">
          {clock(start)}–{clock(addMinutes(start, mins))}
        </span>
        {/* The team favourite sits with the drill's name, where a coach looks first (it used to be last in the panel). */}
        <div className="flex items-start gap-2">
          <h2 ref={heading} tabIndex={-1} className="min-w-0 flex-1 font-display text-[26px] font-bold leading-8 outline-none focus-visible:!shadow-none">
            {title}
          </h2>
          {d && <FavoriteButton key={d.id} drillId={d.id} drillName={d.funName} initial={favorite} onChange={onFavorite} />}
        </div>
        {tag && <span className="flex items-center gap-1.5 text-xs font-medium text-rink-100">{tag}</span>}
        {d && <p className="mt-1.5 text-[15px] leading-[22px]">{d.description}</p>}
      </div>

      {phone ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {stepper}
            <span className="flex-1" />
            <ActionButton iconOnly icon={A.up} label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)} />
            <ActionButton iconOnly icon={A.down} label="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)} />
            <Menu items={menu} size={48} />
          </div>
          {perZone}
        </div>
      ) : (
        // Desktop: moving, swapping, removing and the rest live on the selected row's toolbar, right beside this
        // panel, so the panel keeps only the minutes and gives its space to the drill itself.
        <div className="flex flex-wrap items-center gap-2">
          {stepper}
          {perZone}
        </div>
      )}

      {act && (
        <div className="flex flex-col gap-2">
          <input
            aria-label="Block name"
            className={`${input} font-semibold`}
            value={b.title}
            maxLength={60}
            onChange={(e) => update((x) => ({ ...x, title: e.target.value }) as Block)}
          />
          <input
            aria-label="Note"
            placeholder="Add a note"
            className={`${input} text-sm`}
            value={b.note}
            maxLength={200}
            onChange={(e) => update((x) => ({ ...x, note: e.target.value }) as Block)}
          />
        </div>
      )}
      {b.kind === 'drill' && d && (
        <div className="flex flex-col gap-2">
          <PlayableRink spec={b.levels.length && Math.max(...blockLevels(d, b)) > 1 ? (levelOf(d, Math.max(...blockLevels(d, b))).diagram as RinkDiagramProps) : d.diagram} title={d.funName} />
          <RinkLegend spec={(b.levels.length && Math.max(...blockLevels(d, b)) > 1 ? levelOf(d, Math.max(...blockLevels(d, b))).diagram : d.diagram) as RinkDiagramProps} />
        </div>
      )}
      {b.kind === 'drill' && d && d.levels.length > 0 && (
        <div id={`levels-${b.id}`}>
          <LevelPills block={b} drill={d} suggested={levelSuggested} onLevels={(levels) => update((x) => (x.kind === 'drill' ? { ...x, levels } : x))} />
        </div>
      )}
      {b.kind === 'stations' && d && (
        <>
          <p className="flex items-start gap-1.5 text-[13px] text-ink-200">
            <FormatIcon model="stations" className="mt-0.5 text-rink-100" />
            {formatWhat('stations')}.
          </p>
          <StationsCard block={b} drill={d} units={units} onZone={(k, z: Zone) => update((x) => (x.kind === 'stations' ? { ...x, zones: { ...x.zones, [k]: z } } : x))} />
        </>
      )}
      {b.kind === 'rotation' && (
        <>
          {d && (
            <p className="flex items-start gap-1.5 text-[13px] text-ink-200">
              <FormatIcon model="rotation" className="mt-0.5 text-rink-100" />
              {formatWhat('rotation', rotationToday(b, gc).active.length)}. Whistle every {b.minutes} min.
            </p>
          )}
          <RotationCard block={b} drill={d} byId={byId} known={known} groupCount={gc} onChoose={onSwap} onUseInstead={(z) => update((x) => (x.kind === 'rotation' ? { ...x, drop: [z] } : x))} />
        </>
      )}
      {/* How to run it, in the panel (2026-11-25): steps, every cue and the gear, so a coach doesn't leave the plan to
          understand a drill. The full drill (variations, where it came from) is one tap further. */}
      {d && (
        <section aria-label="How to run it" className="flex flex-col gap-2.5 border-t border-border-100 pt-4">
          <h3 className="text-[15px] font-semibold">How to run it</h3>
          {d.steps.length > 0 && (
            <ol className="flex flex-col gap-2">
              {d.steps.map((st, n) => (
                <li key={n} className="grid grid-cols-[22px_minmax(0,1fr)] gap-1.5 text-sm leading-[21px]">
                  <span className="font-mono text-ink-200">{n + 1}</span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          )}
          {d.cues.map((c) => (
            <p key={c} className="text-sm">
              <span className="text-ink-200">Say:</span> “{c}”
            </p>
          ))}
          {d.gear && d.gear !== 'None' && (
            <p className="text-sm">
              <span className="text-ink-200">Set up:</span> {d.gear}
            </p>
          )}
        </section>
      )}
      {feedback ? <FeedbackLine fb={feedback} /> : d && !known.has(d.id) ? <span className="text-[13px] text-ink-200">New to the kids</span> : null}
      {d && (
        <button type="button" onClick={() => openDrill(d.id)} className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-rink-100 hover:underline">
          More about this drill <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}

/** A bottom sheet on phones: Escape, the backdrop or the drag handle's tap closes it. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink-100/50" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-surface-100 shadow-lg outline-none">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-6 shrink-0 items-center justify-center">
          <span className="h-1 w-10 rounded-full bg-border-100" />
        </button>
        <div className="overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">{children}</div>
      </div>
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
function applySuggestion(blocks: Block[], x: Suggestion, byId: Map<string, Drill>, startAt: (d: Drill) => number = () => 1): Block[] {
  const i = blocks.findIndex((b) => b.id === x.blockId);
  if (i < 0) return blocks;
  const b = blocks[i];
  const d = x.drillId ? byId.get(x.drillId) : undefined;
  if ((x.kind === 'add-level' || x.kind === 'drop-level') && b.kind === 'drill') {
    const levels = x.kind === 'add-level' ? [...new Set([...b.levels, x.level!])].sort((m, n) => m - n) : b.levels.filter((l) => l !== x.level);
    return blocks.map((y) => (y.id === b.id ? { ...b, levels: levels.length ? levels : [1] } : y));
  }
  if (x.kind === 'swap' && d) return blocks.map((y) => (y.id === b.id ? { ...blockForDrill(d, b.minutes, startAt(d)), id: b.id } : y));
  if (x.kind === 'game-before' && d) return [...blocks.slice(0, i), blockForDrill(d, d.minutes, startAt(d)), ...blocks.slice(i)];
  if (x.kind === 'water-before') return [...blocks.slice(0, i), newActivity('water'), ...blocks.slice(i)];
  return blocks;
}
