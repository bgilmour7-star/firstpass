'use client';

import { Rink } from '@/components/ds';
import type { RinkDiagramProps } from '../../../../../design-system/index';
import type { Drill } from '@/lib/drills/schema';
import type { KeptSuggestion } from '@/lib/app/store';
import type { Checkin, RateUnit } from '@/lib/plans/checkin';
import type { Block } from '@/lib/plans/schema';
import type { Suggestion } from '@/lib/plans/suggest';
import { PanelSec } from './parts';

// Suggestions from the check-in (decision 0022), as the planner shows them: a dashed box on the
// block it's about (UX patterns: a warning lives on the item; suggest, never apply), a note with
// Undo once a coach acts on it, a section in the margin, and one line at the top on phones.

/** What the plan page passes down: the practice the check-ins are about, and what's been kept. */
export type SuggestContext = {
  last: { date: string; blocks: Block[] };
  checkins: Checkin[];
  units: RateUnit[];
  runs: Record<string, number>;
  kept: KeptSuggestion[];
  /** "Saturday" */
  day: string;
};

/** A suggestion a coach acted on in this visit: what to say, and the plan to go back to. */
export type Applied = { key: string; blockId: string; done: string; why: string; short: string; /** The block as it was. */ before: Block; /** A block the suggestion added before it (a game, water). */ added?: string };

const flag = (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
    <path d="M5 18V3m0 1h9l-2 3.5 2 3.5H5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
const tick = (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
    <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const heart = (
  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
    <path d="M10 17s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.5C16.5 13 10 17 10 17z" fill="currentColor" />
  </svg>
);

const btn = 'min-h-9 rounded-full bg-ink-100 px-4 text-sm font-semibold text-surface-100 hover:opacity-90';
const btn2 = 'min-h-9 rounded-full border border-border-100 bg-surface-100 px-4 text-sm font-medium hover:bg-surface-300';
const quiet = 'min-h-9 px-2 text-sm text-ink-200 hover:text-ink-100';

/** The label on the main button. Fixed words: never a drill or team name (UX patterns). */
function applyLabel(s: Suggestion): string | null {
  if (s.kind === 'add-level') return `Add Level ${s.level}`;
  if (s.kind === 'drop-level') return `Turn off Level ${s.level}`;
  if (s.kind === 'water-before') return 'Add a water break';
  if (s.kind === 'game-before') return s.drillId ? 'Add it before' : null;
  return s.drillId ? 'Swap it in' : null;
}

export function SuggestionBox({ s, day, drill, onApply, onPick, onKeep }: { s: Suggestion; day: string; drill?: Drill; onApply: () => void; onPick: () => void; onKeep: () => void }) {
  const main = applyLabel(s);
  const pickLabel = s.kind === 'swap' ? (main ? 'Other drills' : 'Choose a drill') : s.kind === 'game-before' ? (main ? 'Other games' : 'Choose a game') : null;
  return (
    <div role="note" id={`sg-${s.blockId}`} className="flex scroll-mt-28 flex-col gap-2.5 rounded-lg border-[1.5px] border-dashed border-whistle-100 bg-surface-200 px-3.5 pb-3.5 pt-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-200">
        <span className="text-whistle-100">{flag}</span>
        From {day}’s check-in · {s.by.join(', ')}
      </span>
      <p className="text-sm">
        <b className="font-semibold">{s.title}</b> <span className="text-ink-200">{s.detail}</span>
      </p>
      {drill && (
        <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border-100 bg-surface-100 py-2 pl-2 pr-3">
          <Rink spec={drill.diagram as RinkDiagramProps} title={drill.funName} detail="thumb" className="w-full" />
          <div className="flex min-w-0 flex-col">
            <b className="font-display text-[17px] font-bold leading-[22px]">{drill.funName}</b>
            <span className="text-[13px] text-ink-200">
              {drill.plainName} · {drill.minutes} min
            </span>
            {!!s.fits?.length && (
              <span className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs">
                {s.fits.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="size-[5px] rounded-full bg-good-100" />
                    {f}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {main && (
          <button type="button" onClick={onApply} className={btn}>
            {main}
          </button>
        )}
        {pickLabel && (
          <button type="button" onClick={onPick} className={main ? btn2 : btn}>
            {pickLabel}
          </button>
        )}
        <button type="button" onClick={onKeep} className={quiet}>
          Keep as is
        </button>
      </div>
    </div>
  );
}

/** Once acted on: one line beside the change, with Undo (UX patterns: feedback sits next to the control). */
export function AppliedNote({ a, day, onUndo }: { a: Applied; day: string; onUndo: () => void }) {
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-200">
      <b className="inline-flex items-center gap-1.5 font-semibold text-good-100">
        {tick}
        {a.done}
      </b>
      <span>
        {a.why} · from {day}’s check-in
      </span>
      <button type="button" onClick={onUndo} className="text-rink-100 underline underline-offset-2 hover:text-ink-100">
        Undo
      </button>
    </p>
  );
}

const split = (short: string) => {
  const [name, ...rest] = short.split(' · ');
  return { name, what: rest.join(' · ') };
};

/** The margin: what the check-in suggests, what's been done, and the Big hits that stay. */
export function CheckinPanel({ day, open, applied, kept, stays }: { day: string; open: Suggestion[]; applied: Applied[]; kept: (Suggestion & { editor: string })[]; stays: string[] }) {
  if (!open.length && !applied.length && !kept.length && !stays.length) return null;
  const done = !open.length && (applied.length > 0 || kept.length > 0);
  return (
    <PanelSec title={`${day}’s check-in`} right={open.length ? `${open.length} to look at` : done ? 'All done' : undefined} rightTone={open.length ? 'text-whistle-100' : 'text-good-100'}>
      <ul className="flex flex-col gap-2 text-[13px] leading-[18px]">
        {open.map((s) => {
          const { name, what } = split(s.short);
          return (
            <li key={s.key} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2 text-whistle-100">
              <span className="mt-0.5">{flag}</span>
              <a href={`#sg-${s.blockId}`} className="text-ink-100 hover:underline">
                <b className="font-semibold">{name}</b> · {what}
                <span className="block text-ink-200">{s.title.replace(/\.$/, '')}</span>
              </a>
            </li>
          );
        })}
        {applied.map((a) => (
          <li key={a.key} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2 text-good-100">
            <span className="mt-0.5">{tick}</span>
            <span className="text-ink-200">
              <b className="font-semibold text-ink-100">{split(a.short).name}</b> · {a.done.charAt(0).toLowerCase() + a.done.slice(1)}
            </span>
          </li>
        ))}
        {kept.map((s) => (
          <li key={s.key} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2 text-ink-200">
            <span className="mt-0.5">{tick}</span>
            <span>
              <b className="font-semibold text-ink-100">{split(s.short).name}</b> · kept as is ({s.editor})
            </span>
          </li>
        ))}
        {stays.map((n) => (
          <li key={n} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2 text-good-100">
            <span className="mt-0.5">{heart}</span>
            <span className="text-ink-200">
              <b className="font-semibold text-ink-100">{n}</b> stays: a Big hit
            </span>
          </li>
        ))}
      </ul>
    </PanelSec>
  );
}

/** Phones: the margin sits below the plan, so one line at the top points to the first suggestion. */
export function PhoneLine({ day, open }: { day: string; open: Suggestion[] }) {
  if (!open.length) return null;
  return (
    <a href={`#sg-${open[0].blockId}`} className="flex items-center gap-2 border-b border-border-100 py-2.5 text-sm lg:hidden">
      <span className="text-whistle-100">{flag}</span>
      <span className="min-w-0">
        <b className="font-semibold">
          {open.length} suggestion{open.length === 1 ? '' : 's'}
        </b>{' '}
        <span className="text-ink-200">from {day}’s check-in</span>
      </span>
      <span className="ml-auto whitespace-nowrap font-medium text-rink-100">Show ↓</span>
    </a>
  );
}
