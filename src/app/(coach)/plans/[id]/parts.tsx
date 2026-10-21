'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Rink } from '@/components/ds';
import { FORMAT_NAME, FormatLabel, formatWhat } from './format';
import { FOCUS_ATTRIBUTES, GROUPS, type Drill, type Group } from '@/lib/drills/schema';
import { usualCounts, type Attendance, type Team } from '@/lib/plans/schema';
import { EMPTY, blockMinutes, countWith, filterDrills, widenOptions, type DrawerContext, type DrawerState, type FilterKey } from '@/lib/plans/drawer';
import type { Favorite } from '@/lib/app/store';
import { StarIcon, starredBy } from '@/components/favorite-button';
import type { DrillFeedback } from '@/lib/plans/feedback';
import { shareWithParents, stopSharing } from '../actions';

// Small pieces of the plan builder: icons, menus, steppers, the drill drawer, sharing and
// the "Who's here today" dialog.

export const input = 'rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';

const svg = (d: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {d}
  </svg>
);
export const Icon = {
  drill: (s?: number) => svg(<><rect x="3" y="6" width="18" height="12" rx="5" /><path d="M12 6v12" /></>, s),
  stations: (s?: number) => svg(<><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /></>, s),
  rotation: (s?: number) => svg(<><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></>, s),
  activity: (s?: number) => svg(<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />, s),
  print: (s?: number) => svg(<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>, s),
  share: (s?: number) => svg(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>, s),
  // Rink-side is the phone view used on the bench: a phone, not a calendar.
  rinkside: (s?: number) => svg(<><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>, s),
  plus: (s?: number) => svg(<path d="M12 5v14M5 12h14" />, s),
  grip: (s?: number) => svg(<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>, s),
};


export function Badge({ zone, dim }: { zone: string; dim?: boolean }) {
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs text-surface-100 ${dim ? 'bg-ink-200/50' : 'bg-ink-100'}`}>{zone}</span>;
}

export function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
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

/** Close a popover on Escape or a click outside it. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // A hidden popover (the desktop add-picker on a phone, say) ignores taps, or it would close the sheet the tap was meant for.
    const click = (e: MouseEvent) => ref.current && ref.current.getClientRects().length > 0 && !ref.current.contains(e.target as Node) && close();
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', click);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', click);
    };
  }, [open, close]);
  return ref;
}

export type MenuItem = { label: string; run?: () => void; disabled?: boolean; danger?: boolean; sub?: { label: string; run: () => void; current?: boolean }[]; note?: string };

export function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const ref = useDismiss(open, () => {
    setOpen(false);
    setSub(null);
  });
  const close = () => {
    setOpen(false);
    setSub(null);
  };
  const subItem = items.find((i) => i.label === sub);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-surface-200">
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-border-100 bg-surface-100 py-1 shadow-lg">
          {subItem ? (
            <>
              <button type="button" onClick={() => setSub(null)} className="w-full px-3 py-2 text-left text-sm text-ink-200 hover:bg-surface-200">
                ‹ {subItem.label}
              </button>
              {subItem.note && <p className="px-3 pb-1 text-xs text-ink-200">{subItem.note}</p>}
              {subItem.sub!.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={s.current}
                  onClick={() => {
                    s.run();
                    close();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-200 disabled:text-ink-200"
                >
                  <span className="w-3.5 text-good-100">{s.current ? '✓' : ''}</span>
                  {s.label}
                </button>
              ))}
            </>
          ) : (
            items.map((it) => (
              <button
                key={it.label}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  if (it.sub) setSub(it.label);
                  else {
                    it.run?.();
                    close();
                  }
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-200 disabled:opacity-40 ${it.danger ? 'text-flag-100' : ''}`}
              >
                {it.label}
                {it.sub && <span aria-hidden="true">›</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PanelSec({ title, right, rightTone, children }: { title: string; right?: string; rightTone?: string; children: React.ReactNode }) {
  return (
    // A section of the panel margin (design system: Panel). A hairline between sections, never an ink rule,
    // and titles one step below the plan's so the plan always leads.
    <section className="flex flex-col gap-2.5 border-t border-border-100 pt-[18px] first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right && <span className={`font-mono text-xs ${rightTone ?? 'text-ink-200'}`}>{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** Swapping lists only the block's own kind of drill (decision 0006); adding lists every kind (decision 0024). */
export type DrawerFilter = 'all' | 'basic' | 'stations' | 'rotation';
/** Quick activities offered at the top when adding. */
export type QuickActivity = 'water' | 'scrimmage' | 'huddle';
/** The spot the drawer was opened for: where it is, the minutes it has and the part of practice it suggests. */
export type DrawerSlot = { label: string; fitsMinutes: number | null; part: Drill['part'] | null };

const PART_OPTIONS: [Drill['part'] | null, string][] = [[null, 'Any part'], ['warmup', 'Warm-up'], ['skill', 'Skill'], ['game', 'Fun game']];
const TOGGLES: [Exclude<FilterKey, 'part' | 'fits' | 'focus'>, string][] = [['fav', 'Team favourites'], ['known', 'Known to them'], ['isNew', 'New'], ['fresh', 'Not used lately'], ['levels', 'Has levels'], ['loved', 'Kids loved it']];
const LABEL: Record<FilterKey, string> = { part: 'Any part', fits: 'Fits the time', focus: 'Any skill', known: 'Known to them', isNew: 'New', fresh: 'Not used lately', levels: 'Has levels', loved: 'Kids loved it', fav: 'Team favourites' };
const lastDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export function LibraryDrawer({
  drills,
  known,
  inPlan,
  title,
  filter,
  slot,
  lastRun,
  recent,
  feedback = {},
  favorites = {},
  onPick,
  onActivity,
  onClose,
}: {
  drills: Drill[];
  known: Set<string>;
  inPlan: Set<string>;
  title: string;
  filter: DrawerFilter;
  slot: DrawerSlot;
  lastRun: Record<string, string>;
  recent: Set<string>;
  feedback?: Record<string, DrillFeedback>;
  favorites?: Record<string, Favorite>;
  onPick: (id: string) => void;
  /** Adding: Water, Small games and Huddle as one tap each. */
  onActivity?: (k: QuickActivity) => void;
  onClose: () => void;
}) {
  // Opens pre-set from the slot: its part of practice and the minutes it has.
  const preset: DrawerState = { ...EMPTY, part: slot.part, fits: slot.fitsMinutes != null };
  const [s, setS] = useState<DrawerState>(preset);
  const [menu, setMenu] = useState<'part' | 'focus' | null>(null);
  const menuRef = useDismiss(menu !== null, () => setMenu(null));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (menu ? setMenu(null) : onClose());
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, menu]);

  const pool = filter === 'all' ? drills : drills.filter((d) => d.groupModel === filter);
  const loved = new Set(Object.entries(feedback).filter(([, f]) => f.loved).map(([id]) => id));
  const favSet = new Set(Object.keys(favorites));
  const ctx: DrawerContext = { fitsMinutes: slot.fitsMinutes, known, recent, loved, favorites: favSet };
  // Already in the plan last, then drills that flopped or lost them last time; Big hits first.
  // Team favourites first, then drills the kids loved; warnings and drills already in the plan last.
  const rank = (id: string) => (inPlan.has(id) ? 3 : feedback[id]?.warn ? 2 : favSet.has(id) ? -1 : feedback[id]?.loved ? 0 : 1);
  const list = filterDrills(pool, s, ctx).sort(
    (a, b) => rank(a.id) - rank(b.id) || Number(!known.has(a.id)) - Number(!known.has(b.id)) || a.funName.localeCompare(b.funName),
  );
  const widen = list.length <= 2 ? widenOptions(pool, s, ctx) : [];
  const set = (patch: Partial<DrawerState>) => {
    setS((x) => ({ ...x, ...patch }));
    setMenu(null);
  };
  const toggle = (k: (typeof TOGGLES)[number][0]) => set({ [k]: !s[k], ...(k === 'known' && !s.known ? { isNew: false } : {}), ...(k === 'isNew' && !s.isNew ? { known: false } : {}) });
  const anyOn = Boolean(s.part || s.fits || s.focus || s.known || s.isNew || s.fresh || s.levels || s.loved || s.fav);
  const isPreset = s.part === preset.part && s.fits === preset.fits && Boolean(preset.part || preset.fits);
  const hint =
    filter === 'stations'
      ? `${FORMAT_NAME.stations}: ${formatWhat('stations').toLowerCase()}.`
      : filter === 'rotation'
        ? `${FORMAT_NAME.rotation}: every group does all the zones, one after another.`
        : '';
  const chip = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] disabled:cursor-default disabled:opacity-[var(--opacity-disabled)] ${on ? 'border-ink-100 bg-ink-100 text-surface-100' : 'border-border-100 hover:bg-surface-200 disabled:hover:bg-transparent'}`;
  const menuItems: [string | null, string][] = menu === 'part' ? PART_OPTIONS : [[null, 'Any skill'], ...FOCUS_ATTRIBUTES.map((f): [string, string] => [f, f])];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface-100 shadow-xl">
        <div className="relative flex flex-col gap-3 border-b border-border-100 p-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold">{title}</h2>
              {slot.label && (
                <p className="text-[13px] text-ink-200">
                  {slot.label}
                  {isPreset && ' · filtered for this spot'}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-full px-3 text-sm hover:bg-surface-200">
              Close
            </button>
          </div>
          {onActivity && (
            <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
              <span className="shrink-0 text-xs text-ink-200">Quick:</span>
              {(
                [
                  ['water', 'Water · 2 min'],
                  ['scrimmage', 'Small games · 5 min'],
                  ['huddle', 'Huddle · 3 min'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => onActivity(k)} className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-border-100 px-3 text-[13px] hover:bg-surface-200">
                  {label}
                </button>
              ))}
            </div>
          )}
          <input autoFocus type="search" aria-label="Search drills" placeholder="Search drills" className={input} value={s.q} onChange={(e) => setS((x) => ({ ...x, q: e.target.value }))} />
          {/* All filters on one row, scrolling sideways when it doesn't fit. */}
          <div
            role="group"
            aria-label="Filters"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-28px),transparent)] [scrollbar-width:none]"
          >
            <button type="button" aria-haspopup="menu" aria-expanded={menu === 'part'} onMouseDown={(e) => e.stopPropagation()} onClick={() => setMenu(menu === 'part' ? null : 'part')} className={chip(Boolean(s.part))}>
              {PART_OPTIONS.find(([k]) => k === s.part)?.[1]} <span aria-hidden="true" className="text-[10px] opacity-70">▾</span>
            </button>
            {slot.fitsMinutes != null && (
              <button type="button" aria-pressed={s.fits} onClick={() => set({ fits: !s.fits })} className={chip(s.fits)}>
                Fits {slot.fitsMinutes} min{s.fits && <span aria-hidden="true">×</span>}
              </button>
            )}
            <button type="button" aria-haspopup="menu" aria-expanded={menu === 'focus'} onMouseDown={(e) => e.stopPropagation()} onClick={() => setMenu(menu === 'focus' ? null : 'focus')} className={chip(Boolean(s.focus))}>
              {s.focus ?? 'Any skill'} <span aria-hidden="true" className="text-[10px] opacity-70">▾</span>
            </button>
            {TOGGLES.filter(([k]) => (k !== 'loved' || loved.size > 0 || s.loved) && (k !== 'fav' || favSet.size > 0 || s.fav)).map(([k, label]) => {
              const n = s[k] ? null : countWith(pool, s, ctx, { [k]: true, ...(k === 'known' ? { isNew: false } : k === 'isNew' ? { known: false } : {}) });
              return (
                <button key={k} type="button" aria-pressed={s[k]} disabled={n === 0} title={n === 0 ? 'None with your other filters' : undefined} onClick={() => toggle(k)} className={chip(s[k])}>
                  {label}
                  {s[k] ? <span aria-hidden="true">×</span> : <span className="font-mono text-xs opacity-70">{n}</span>}
                </button>
              );
            })}
            {anyOn && (
              <button type="button" onClick={() => set({ ...EMPTY, q: s.q })} className={`${chip(false)} border-dashed text-ink-200`}>
                Clear
              </button>
            )}
          </div>
          {menu && (
            <div ref={menuRef} role="menu" className="absolute left-4 top-full z-10 -mt-1 flex min-w-48 flex-col rounded-md border border-border-100 bg-surface-100 p-1 shadow-md">
              {menuItems.map(([k, label]) => {
                const on = (menu === 'part' ? s.part : s.focus) === k;
                const n = countWith(pool, s, ctx, { [menu]: k });
                return (
                  <button
                    key={label}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    disabled={n === 0 && !on}
                    onClick={() => set({ [menu]: k } as Partial<DrawerState>)}
                    className={`flex min-h-10 items-center justify-between gap-4 rounded-sm px-3 text-left text-sm hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)] disabled:hover:bg-transparent ${on ? 'font-semibold' : ''}`}
                  >
                    {label}
                    <span className="font-mono text-xs text-ink-200">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 pt-3" aria-live="polite">
          <p className="text-[13px] text-ink-200">
            <b className="text-ink-100">{list.length}</b> of {pool.length} {filter === 'rotation' ? 'rotations' : filter === 'stations' ? 'split-by-skill drills' : 'drills'}
            {hint && ` · ${hint}`}
          </p>
          <ul className="flex flex-col">
            {list.map((d) => {
              const over = slot.fitsMinutes != null ? blockMinutes(d) - slot.fitsMinutes : 0;
              return (
                <li key={d.id} className="border-t border-border-100">
                  <button type="button" onClick={() => onPick(d.id)} className={`grid w-full grid-cols-[120px_minmax(0,1fr)] items-start gap-3 rounded-md py-3 text-left hover:bg-surface-200/60 ${inPlan.has(d.id) ? 'opacity-60' : ''}`}>
                    <Rink spec={d.diagram} title={d.funName} detail="thumb" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <b className="flex items-center gap-1.5 font-display text-base leading-5">
                        {d.funName}
                        {favorites[d.id] && (
                          <span className="text-rink-100" title={starredBy(favorites[d.id])}>
                            <StarIcon on size={15} />
                            <span className="sr-only">Team favourite</span>
                          </span>
                        )}
                      </b>
                      <span className="text-xs text-ink-200">{d.plainName}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-200">
                        <span className="font-mono text-ink-100">
                          {d.minutes} min{d.groupModel === 'rotation' ? ' a zone' : ''}
                        </span>
                        {known.has(d.id) ? (
                          <span className="rounded-full bg-surface-300 px-1.5 text-[11px] font-semibold text-ink-100">Known{lastRun[d.id] ? ` · last ${lastDate(lastRun[d.id])}` : ''}</span>
                        ) : (
                          <span className="rounded-full border border-whistle-100 px-1.5 text-[11px] font-semibold text-whistle-100">New</span>
                        )}
                        <FormatLabel model={d.groupModel} className="font-medium text-rink-100" />
                        {d.groupModel === 'basic' && d.levels.length > 0 && <span>{d.levels.length + 1} levels</span>}
                        {d.groupModel === 'rotation' && <span>{d.zones?.length ?? 0} zones</span>}
                        {d.lessons.length > 0 && <span>Lesson {d.lessons.join(', ')}</span>}
                      </span>
                      <span className="text-xs font-medium">{d.focus.filter((f) => f.level === 2).map((f) => f.attribute).join(' · ')}</span>
                      {feedback[d.id] && <FeedbackLine fb={feedback[d.id]} compact />}
                      {inPlan.has(d.id) ? (
                        <span className="text-xs text-whistle-100">Already in this plan</span>
                      ) : over > 0 ? (
                        <span className="text-xs text-whistle-100">{over} min longer than the gap. You can shorten it once it’s in.</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {pool.length === 0 && <p className="text-sm text-ink-200">{filter === 'rotation' ? 'No rotations in the library yet. Admins add them in drill review.' : 'No drills in the library yet.'}</p>}
          {/* Never a dead end: say which filter is hiding the rest and offer to turn it off. */}
          {pool.length > 0 && widen.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-md bg-surface-200 p-3">
              <p className="text-[13px]">
                {list.length === 0 ? 'Nothing matches all of these.' : list.length === 1 ? 'Only one matches.' : 'Only two match.'}{' '}
                {widen[0].key === 'fits' ? `${widen[0].more} more if they run longer than ${slot.fitsMinutes} min.` : `${widen[0].more} more without “${s[widen[0].key] && widen[0].key === 'part' ? PART_OPTIONS.find(([k]) => k === s.part)?.[1] : widen[0].key === 'focus' ? s.focus : LABEL[widen[0].key]}”.`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {widen.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => set({ [w.key]: w.key === 'part' || w.key === 'focus' ? null : false } as Partial<DrawerState>)}
                    className="min-h-9 rounded-full border border-border-100 bg-surface-100 px-3 text-[13px] font-medium hover:border-ink-200"
                  >
                    {w.key === 'fits' ? 'Show longer ones' : w.key === 'part' ? 'Any part' : w.key === 'focus' ? 'Any skill' : `Turn off “${LABEL[w.key]}”`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShareControl({ practiceId, initial, compact }: { practiceId: string; initial: { token: string; expiresAt: string } | null; compact?: boolean }) {
  const [share, setShare] = useState(initial);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const ref = useDismiss(open, () => setOpen(false));
  const url = share ? `${typeof window === 'undefined' ? '' : window.location.origin}/p/${share.token}` : '';
  const toggle = () => {
    setOpen((o) => !o);
    if (!share)
      start(async () => {
        const r = await shareWithParents(practiceId);
        if (r.ok) setShare({ token: r.token, expiresAt: r.expiresAt });
      });
  };
  return (
    <div ref={ref} className="relative">
      {compact ? (
        <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full flex-col items-center gap-0.5 text-[11px]">
          {Icon.share(20)}
          Share
        </button>
      ) : (
        <button type="button" aria-expanded={open} aria-label="Share" title="Share with parents" onClick={toggle} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-100 px-3.5 text-sm font-medium hover:bg-surface-200">
          {Icon.share(16)} <span className="hidden lg:inline">Share</span>
        </button>
      )}
      {open && (
        <div className={`absolute z-40 flex w-[min(92vw,380px)] flex-col gap-2 rounded-md border border-border-100 bg-surface-100 p-3 text-left shadow-lg ${compact ? 'bottom-full right-[-60px] mb-3' : 'right-0 mt-2'}`}>
          <b className="text-sm">Share with parents</b>
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

/** "Who's here today": counts per group and merges, for this practice only. */
export function AttendanceDialog({
  team,
  value,
  preview,
  onApply,
  onClose,
}: {
  team: Team;
  value: Attendance | null;
  preview: (a: Attendance) => string[];
  onApply: (a: Attendance | null) => void;
  onClose: () => void;
}) {
  const usual = usualCounts(team);
  const [a, setA] = useState<Attendance>(value ?? { counts: usual, merges: [] });
  const merged = (x: Group, y: Group) => a.merges.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  const toggle = (x: Group, y: Group) => setA((s) => ({ ...s, merges: merged(x, y) ? s.merges.filter(([p, q]) => !((p === x && q === y) || (p === y && q === x))) : [...s.merges, [x, y]] }));
  const changes = preview(a);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="att-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex w-full max-w-[440px] flex-col gap-4 rounded-t-[18px] bg-surface-100 p-4 shadow-xl sm:rounded-[14px]">
        <div className="flex flex-col gap-0.5">
          <h2 id="att-title" className="text-[17px] font-extrabold">
            Who&apos;s here today
          </h2>
          <p className="text-sm text-ink-200">Only this practice. Your team&apos;s usual groups don&apos;t change.</p>
        </div>
        <div className="flex flex-col gap-2">
          {GROUPS.map((g) => (
            <div key={g} className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <b>{g}</b>
              <span className="text-xs text-ink-200">usually {usual[g]}</span>
              <Stepper value={a.counts[g]} min={0} max={20} label="" onChange={(n) => setA((s) => ({ ...s, counts: { ...s.counts, [g]: n } }))} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {(
            [
              ['Sharks', 'Bears'],
              ['Bears', 'Eagles'],
            ] as const
          ).map(([x, y]) => (
            <label key={x + y} className="flex cursor-pointer items-center gap-3 rounded-md bg-surface-200 px-3 py-2.5 text-sm">
              <input type="checkbox" role="switch" checked={merged(x, y)} onChange={() => toggle(x, y)} className="h-5 w-5 accent-[var(--rink-100)]" />
              <span>
                <b>
                  Merge {x} and {y} today
                </b>
                <br />
                <span className="text-xs text-ink-200">One group of {a.counts[x] + a.counts[y]}, at the easier group&apos;s level.</span>
              </span>
            </label>
          ))}
        </div>
        {changes.length > 0 && (
          <div className="text-[13px] leading-5">
            <b>What changes: </b>
            {changes.join(' ')}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {value && (
            <button type="button" onClick={() => onApply(null)} className="mr-auto min-h-10 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200">
              Back to usual
            </button>
          )}
          <button type="button" onClick={onClose} className="min-h-10 rounded-full border border-border-100 px-4 text-sm hover:bg-surface-200">
            Cancel
          </button>
          <button type="button" onClick={() => onApply(a)} className="min-h-10 rounded-full bg-rink-100 px-4 text-sm font-medium text-surface-100">
            Apply to today
          </button>
        </div>
      </div>
    </div>
  );
}

/** What coaches said last time, on the drill itself (decision 0008). Older feedback fades. */
export function FeedbackLine({ fb, compact = false }: { fb: DrillFeedback; compact?: boolean }) {
  const tone = fb.warn ? 'text-whistle-100' : fb.loved ? 'text-good-100' : 'text-ink-200';
  return (
    <span className={`flex items-start gap-1.5 ${compact ? 'text-xs' : 'text-[13px]'} ${tone} ${fb.stale ? 'opacity-60' : ''}`}>
      <svg viewBox="0 0 20 20" width="14" height="14" className="mt-[1px] shrink-0" aria-hidden="true">
        {fb.warn ? (
          <path d="M10 2.5 L18 16.5 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        ) : fb.loved ? (
          <path d="M10 17s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.5C16.5 13 10 17 10 17z" fill="currentColor" />
        ) : (
          <path d="M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      <span className={fb.warn ? 'font-medium' : ''}>{fb.line}</span>
    </span>
  );
}
