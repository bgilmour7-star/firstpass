import type { Drill } from '../drills/schema';

// Filters for the add-a-drill drawer. They follow the coach's intent: what fits this
// spot (part of practice, minutes), what suits these kids (known, new, not used
// lately, has levels, kids loved it) and what it works on. The drawer opens pre-set from the slot.

export type Part = Drill['part'];
export type DrawerState = {
  q: string;
  part: Part | null;
  fits: boolean;
  focus: Drill['focus'][number]['attribute'] | null;
  known: boolean;
  isNew: boolean;
  fresh: boolean;
  levels: boolean;
  loved: boolean;
};
export type DrawerContext = {
  /** Minutes the slot has. Null when there is no gap to fit (the plan is full or over). */
  fitsMinutes: number | null;
  known: Set<string>;
  /** Drills run in the last two practices. */
  recent: Set<string>;
  /** Drills that were a Big hit last time (check-ins). */
  loved?: Set<string>;
};
export type FilterKey = Exclude<keyof DrawerState, 'q'>;

export const EMPTY: DrawerState = { q: '', part: null, fits: false, focus: null, known: false, isNew: false, fresh: false, levels: false, loved: false };

/** A drill's minutes in a plan: a rotation runs each zone for its minutes. */
export function blockMinutes(d: Pick<Drill, 'groupModel' | 'minutes' | 'zones'>): number {
  return d.groupModel === 'rotation' ? d.minutes * Math.max(1, d.zones?.length ?? 0) : d.minutes;
}

/** The part of practice a slot suggests: first is the warm-up, the last is the fun game, the rest is skill work. */
export function partForSlot(at: number, blockCount: number): Part {
  if (at <= 0) return 'warmup';
  if (at >= blockCount - 1) return 'game';
  return 'skill';
}

export function matches(d: Drill, s: DrawerState, ctx: DrawerContext, skip?: FilterKey): boolean {
  if (s.q && !`${d.funName} ${d.plainName}`.toLowerCase().includes(s.q.trim().toLowerCase())) return false;
  if (skip !== 'part' && s.part && d.part !== s.part) return false;
  if (skip !== 'fits' && s.fits && ctx.fitsMinutes != null && blockMinutes(d) > ctx.fitsMinutes) return false;
  if (skip !== 'focus' && s.focus && !d.focus.some((f) => f.attribute === s.focus && f.level === 2)) return false;
  if (skip !== 'known' && s.known && !ctx.known.has(d.id)) return false;
  if (skip !== 'isNew' && s.isNew && ctx.known.has(d.id)) return false;
  if (skip !== 'fresh' && s.fresh && ctx.recent.has(d.id)) return false;
  if (skip !== 'levels' && s.levels && !(d.groupModel === 'basic' && d.levels.length > 0)) return false;
  if (skip !== 'loved' && s.loved && !ctx.loved?.has(d.id)) return false;
  return true;
}

export function filterDrills(drills: Drill[], s: DrawerState, ctx: DrawerContext): Drill[] {
  return drills.filter((d) => matches(d, s, ctx));
}

/** How many drills there would be with a change applied, for the counts on chips and menu options. */
export function countWith(drills: Drill[], s: DrawerState, ctx: DrawerContext, patch: Partial<DrawerState>): number {
  return filterDrills(drills, { ...s, ...patch }, ctx).length;
}

/** Filters hiding drills right now, most useful first, with how many more each would show if turned off. */
export function widenOptions(drills: Drill[], s: DrawerState, ctx: DrawerContext): { key: FilterKey; more: number }[] {
  const now = filterDrills(drills, s, ctx).length;
  const keys: FilterKey[] = ['fits', 'part', 'focus', 'known', 'isNew', 'fresh', 'levels', 'loved'];
  return keys
    .filter((k) => Boolean(s[k]))
    .map((key) => ({ key, more: drills.filter((d) => matches(d, s, ctx, key)).length - now }))
    .filter((o) => o.more > 0);
}
