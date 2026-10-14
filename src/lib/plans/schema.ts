import { z } from 'zod';
import { FOCUS_ATTRIBUTES, GROUPS, type Drill } from '../drills/schema';

// A practice plan is an ordered list of blocks. Times are never stored: each block's start
// is the practice start plus the minutes of the blocks before it, so editing minutes retimes
// everything after it.

const id = z.string().min(1).max(40);

export const ACTIVITY_KINDS = ['free_skate', 'water', 'huddle', 'scrimmage', 'other'] as const;
export const ACTIVITY_LABEL: Record<(typeof ACTIVITY_KINDS)[number], string> = {
  free_skate: 'Free skate & hellos',
  water: 'Water',
  huddle: 'Huddle',
  scrimmage: 'Scrimmage',
  other: 'Activity',
};

export const blockSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('drill'), drillId: z.string(), minutes: z.number().int().min(1).max(60) }),
  z.object({
    id,
    kind: z.literal('stations'),
    // Minutes at each station; every group visits every station.
    minutes: z.number().int().min(2).max(20),
    stations: z
      .array(z.object({ station: z.enum(['A', 'B', 'C']), drillId: z.string().nullable(), coach: z.string().max(40).default('') }))
      .min(2)
      .max(3),
  }),
  z.object({
    id,
    kind: z.literal('activity'),
    activity: z.enum(ACTIVITY_KINDS),
    title: z.string().max(60),
    minutes: z.number().int().min(1).max(60),
    note: z.string().max(200).default(''),
  }),
]);

export const practiceSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.number().int().min(20).max(120),
  ice: z.enum(['half', 'full']),
  status: z.enum(['draft', 'ready', 'done']),
  blocks: z.array(blockSchema).max(30),
});

export const teamSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Give the team a name').max(80),
  ageGroup: z.string(),
  groups: z.array(z.object({ group: z.enum(GROUPS), skaters: z.number().int().min(0).max(20) })).length(3),
  coachesOnIce: z.number().int().min(1).max(10),
  practiceMinutes: z.number().int().min(20).max(120),
  ice: z.enum(['half', 'full', 'varies']),
  newDrillsPerWeek: z.number().int().min(0).max(10),
});

export type Block = z.infer<typeof blockSchema>;
export type Practice = z.infer<typeof practiceSchema>;
export type Team = z.infer<typeof teamSchema>;

export function blockMinutes(b: Block): number {
  return b.kind === 'stations' ? b.minutes * b.stations.length : b.minutes;
}

export function totalMinutes(blocks: Block[]): number {
  return blocks.reduce((t, b) => t + blockMinutes(b), 0);
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}

/** Start time of every block, in plan order. */
export function startTimes(startTime: string, blocks: Block[]): string[] {
  let t = 0;
  return blocks.map((b) => {
    const s = addMinutes(startTime, t);
    t += blockMinutes(b);
    return s;
  });
}

/** Which group is at which station in each rotation. Rotation r: station i holds group (i - r) mod n. */
export function rotation(groups: string[], stationCount: number): string[][] {
  const n = Math.min(groups.length, stationCount);
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, i) => groups[(((i - r) % n) + n) % n]));
}

/** Drill ids a block uses. */
export function drillIds(b: Block): string[] {
  if (b.kind === 'drill') return [b.drillId];
  if (b.kind === 'stations') return b.stations.map((s) => s.drillId).filter((x): x is string => !!x);
  return [];
}

export type FocusSummary = { attribute: (typeof FOCUS_ATTRIBUTES)[number]; level: 0 | 1 | 2; score: number }[];

/**
 * Minute-weighted focus for the practice (design decision 2026-10-12): each drill adds
 * minutes × level for each attribute it trains; every station counts its full minutes because
 * every skater does every station. The top two trained attributes are Main, other trained ones Some.
 */
export function practiceFocus(blocks: Block[], drills: Map<string, Pick<Drill, 'focus'>>): FocusSummary {
  const score = new Map<string, number>(FOCUS_ATTRIBUTES.map((a) => [a, 0]));
  const add = (drillId: string | null, minutes: number) => {
    const d = drillId ? drills.get(drillId) : undefined;
    d?.focus.forEach((f) => score.set(f.attribute, (score.get(f.attribute) ?? 0) + minutes * f.level));
  };
  for (const b of blocks) {
    if (b.kind === 'drill') add(b.drillId, b.minutes);
    if (b.kind === 'stations') b.stations.forEach((s) => add(s.drillId, b.minutes));
  }
  const ranked = [...score.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const main = new Set(ranked.slice(0, 2).map(([a]) => a));
  return FOCUS_ATTRIBUTES.map((a) => ({ attribute: a, score: score.get(a) ?? 0, level: main.has(a) ? 2 : (score.get(a) ?? 0) > 0 ? 1 : 0 }));
}

/** Drills in this plan that the kids haven't done in any earlier practice. */
export function newDrillIds(plan: Pick<Practice, 'date' | 'blocks' | 'id'>, earlier: Pick<Practice, 'date' | 'blocks' | 'id'>[]): Set<string> {
  const seen = new Set(earlier.filter((p) => p.id !== plan.id && p.date < plan.date).flatMap((p) => p.blocks.flatMap(drillIds)));
  return new Set(plan.blocks.flatMap(drillIds).filter((d) => !seen.has(d)));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** The next practice starts as a copy of the last one (design decision): same blocks, fresh ids. */
export function copyBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({ ...b, id: newId(), ...(b.kind === 'stations' ? { stations: b.stations.map((s) => ({ ...s })) } : {}) }));
}

/** A sensible first plan when there's nothing to copy. */
export function starterBlocks(minutes: number): Block[] {
  const blocks: Block[] = [
    { id: newId(), kind: 'activity', activity: 'free_skate', title: ACTIVITY_LABEL.free_skate, minutes: 5, note: 'Greet every kid by name.' },
    { id: newId(), kind: 'stations', minutes: 8, stations: (['A', 'B', 'C'] as const).map((station) => ({ station, drillId: null, coach: '' })) },
    { id: newId(), kind: 'activity', activity: 'water', title: ACTIVITY_LABEL.water, minutes: 3, note: '' },
  ];
  const left = minutes - totalMinutes(blocks) - 5;
  if (left > 0) blocks.push({ id: newId(), kind: 'activity', activity: 'scrimmage', title: 'Small games', minutes: left, note: '' });
  blocks.push({ id: newId(), kind: 'activity', activity: 'huddle', title: 'Huddle & shout-outs', minutes: 5, note: '' });
  return blocks;
}
