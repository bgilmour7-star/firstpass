'use client';

import { FOCUS_ATTRIBUTES, GROUPS, type Group } from '@/lib/drills/schema';
import { GEAR, type Team } from '@/lib/plans/schema';

export { Drawer } from '@/components/drawer';

// Pieces the Team page's drawers and Create a team share (decision 0026), so a section edits the same
// way in both places.

export const field = 'h-12 w-full rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3.5 text-[16px] placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25';
export const primary = 'inline-flex h-12 items-center justify-center rounded-full bg-rink-100 px-7 text-[15px] font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]';
export const quiet = 'inline-flex h-12 items-center justify-center rounded-full px-5 text-[15px] font-medium hover:bg-surface-200';
export const NO_KIDS = 'No kids’ names, please.';

/** Half ice · Full ice · It changes, as one pill row (T3-Edit, W4-Ice). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-surface-300 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`h-10 rounded-full px-[18px] text-sm ${value === v ? 'bg-surface-100 font-semibold text-ink-100 shadow-sm' : 'font-medium text-ink-200 hover:text-ink-100'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export const ICE_OPTIONS = [
  ['half', 'Half ice'],
  ['full', 'Full ice'],
  ['varies', 'It changes'],
] as const;

/** A count with − and + (44px targets). */
export function Count({ value, min = 0, max, label, onChange }: { value: number; min?: number; max: number; label: string; onChange: (n: number) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 items-center rounded-full border border-border-100">
      <button type="button" aria-label={`One fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="size-11 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        −
      </button>
      <span className="min-w-8 text-center font-mono text-[15px]" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`One more: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="size-11 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        +
      </button>
    </div>
  );
}

/** A plain-word hint under a prefilled answer: the guess and why (UX pattern "prefill with a reason"). */
export function Why({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-ink-200">{children}</p>;
}

// ---------------------------------------------------------------- skill groups

type Groups = Team['groups'];
/** Strongest first, as coaches think of them. */
const STRONGEST_FIRST: Group[] = [...GROUPS].reverse();
const MORE_NAMES = ['Wolves', 'Hawks', 'Otters', 'Foxes', 'Comets'];
const ORDINAL = ['strongest', 'second', 'third'];

/** What each group is, by rank among the groups the team uses (strongest first). */
export function tiers(count: number): { short: string; long: string }[] {
  if (count === 1) return [{ short: 'Everyone together', long: 'Everyone together' }];
  if (count === 2)
    return [
      { short: 'Stronger', long: 'Stronger · races and battles' },
      { short: 'Still finding their edges', long: 'Developing · the most coach time' },
    ];
  return [
    { short: 'Strongest', long: 'Strongest · races and battles' },
    { short: 'Next up', long: 'Middle · one new challenge at a time' },
    { short: 'Still finding their edges', long: 'Developing · the most coach time' },
  ];
}

/** The groups a team uses, strongest first. */
export const shownGroups = (groups: Groups) => STRONGEST_FIRST.map((slot) => groups.find((g) => g.group === slot)!).filter((g) => g && !g.off);

/**
 * 1 to 3 skill groups with team-chosen names (decision 0026). The slots stay the internal keys,
 * easiest to hardest; a removed group is turned off. A fourth group is deferred: "3 is the most for now".
 */
export function GroupsEditor({ groups, onChange }: { groups: Groups; onChange: (g: Groups) => void }) {
  const shown = shownGroups(groups);
  const tier = tiers(shown.length);
  const total = shown.reduce((n, g) => n + g.skaters, 0);
  const set = (slot: Group, patch: Partial<Groups[number]>) => onChange(groups.map((g) => (g.group === slot ? { ...g, ...patch } : g)));
  const add = () => {
    const off = GROUPS.filter((s) => groups.find((g) => g.group === s)?.off);
    if (!off.length) return;
    // The new group goes in as the easiest (a new row at the bottom): the off slot just below the
    // easiest group in use, else the nearest one above it.
    const lowest = GROUPS.indexOf(GROUPS.find((s) => !groups.find((g) => g.group === s)?.off) ?? 'Eagles');
    const below = off.filter((s) => GROUPS.indexOf(s) < lowest);
    const slot = below.length ? below[below.length - 1] : off[0];
    const taken = new Set(shown.map((g) => (g.name || g.group).toLowerCase()));
    const name = [slot, ...MORE_NAMES].find((n) => !taken.has(n.toLowerCase())) ?? slot;
    set(slot, { off: false, skaters: 3, name });
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {shown.map((g, i) => (
          <li key={g.group} className="flex items-center gap-2 border-t border-border-100 py-3 first:border-t-0">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                aria-label={`Name of the ${shown.length === 1 ? 'only' : ORDINAL[i]} group`}
                value={g.name ?? g.group}
                maxLength={24}
                onChange={(e) => set(g.group, { name: e.target.value })}
                className="h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3 text-[16px] font-semibold focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25"
              />
              <span className="text-xs text-ink-200">{tier[i]?.short}</span>
            </span>
            <Count value={g.skaters} min={0} max={20} label={`skaters in ${g.name || g.group}`} onChange={(n) => set(g.group, { skaters: n })} />
            <button
              type="button"
              aria-label={`Remove ${g.name || g.group}`}
              disabled={shown.length <= 1}
              onClick={() => set(g.group, { off: true, skaters: 0 })}
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink-200 hover:bg-surface-200 hover:text-ink-100 disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-200">{NO_KIDS} Counts only.</p>
      <p className="flex items-baseline justify-between border-t border-border-100 pt-3 text-sm">
        <span className="text-ink-200">
          {shown.length} group{shown.length === 1 ? '' : 's'} · skaters
        </span>
        <b className="font-mono text-base font-medium">{total}</b>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={add} disabled={shown.length >= 3} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-rink-100 disabled:text-ink-200 disabled:opacity-70">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add a group
        </button>
        {shown.length >= 3 && <span className="text-[13px] text-ink-200">3 is the most for now.</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- gear and focus

export function gearLine(gear: Team['gear']): string | null {
  const parts = GEAR.filter(([k]) => (gear[k] ?? 0) > 0).map(([k, label]) => `${gear[k]} ${label}`);
  return parts.length ? parts.join(' · ') : null;
}

export function GearEditor({ gear, onChange }: { gear: Team['gear']; onChange: (g: Team['gear']) => void }) {
  return (
    <ul className="flex flex-col">
      {GEAR.map(([k, label]) => (
        <li key={k} className="flex min-h-14 items-center justify-between gap-3 border-t border-border-100 first:border-t-0">
          <span className="text-[15px] first-letter:uppercase">{label}</span>
          <Count value={gear[k] ?? 0} max={200} label={label} onChange={(n) => onChange({ ...gear, [k]: n })} />
        </li>
      ))}
    </ul>
  );
}

/** Up to two skills to start with. */
export function FocusPicker({ focus, onChange }: { focus: Team['focus']; onChange: (f: Team['focus']) => void }) {
  return (
    <div role="group" aria-label="Focus to start" className="flex flex-wrap gap-2">
      {FOCUS_ATTRIBUTES.filter((f) => f !== 'Effort & fun').map((f) => {
        const on = focus.includes(f);
        const full = !on && focus.length >= 2;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={on}
            disabled={full}
            onClick={() => onChange(on ? focus.filter((x) => x !== f) : [...focus, f])}
            className={`min-h-11 rounded-full border px-4 text-sm ${on ? 'border-ink-100 bg-ink-100 font-semibold text-surface-100' : 'border-border-200 hover:bg-surface-200 disabled:opacity-40'}`}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}
