import { z } from 'zod';
import { FOCUS_ATTRIBUTES, GROUPS, type Drill, type Group } from '../drills/schema';

// A practice plan is an ordered list of blocks. Times are never stored: each block's start
// is the practice start plus the minutes of the blocks before it, so editing minutes retimes
// everything after it.
//
// Four kinds of block (decision 0004):
//   drill     one drill for everyone; if it has levels, each group does its own level (a progression)
//   stations  one drill, one diagram, each group at its own station (A, B, C)
//   rotation  every group does every station, moving on the whistle; the coach picks who starts where
//   activity  free skate, water, huddle, small games
// Who's here today (attendance) is set per practice and adapts every block: a rotation runs as
// many stations as there are groups, levels and stations follow merged groups. Per-block choices
// (a level, a station, which rotation station sits out) are kept by group, so they survive changes.

const id = z.string().min(1).max(40);
const zone = z.enum(['A', 'B', 'C']);
export type Zone = z.infer<typeof zone>;
export const ZONES: Zone[] = ['A', 'B', 'C'];

export const ACTIVITY_KINDS = ['free_skate', 'water', 'huddle', 'scrimmage', 'other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  free_skate: 'Free skate & hellos',
  water: 'Water',
  huddle: 'Huddle',
  scrimmage: 'Small games',
  other: 'Activity',
};

const drillBlock = z.object({
  id,
  kind: z.literal('drill'),
  // Empty until the coach picks one (a block changed to a drill starts empty).
  drillId: z.string(),
  minutes: z.number().int().min(1).max(60),
  /** Level chosen for a group today, keyed by group key ("Sharks", "Sharks+Bears"). Missing = default. */
  levels: z.record(z.string(), z.string()).default({}),
});
const stationsBlock = z.object({
  id,
  kind: z.literal('stations'),
  drillId: z.string(),
  minutes: z.number().int().min(1).max(60),
  /** Station chosen for a group today, keyed by group key. Missing = the drill's own station for that group. */
  zones: z.record(z.string(), zone).default({}),
});
const rotationBlock = z.object({
  id,
  kind: z.literal('rotation'),
  // Minutes at each station.
  minutes: z.number().int().min(2).max(20),
  stations: z
    .array(z.object({ station: zone, drillId: z.string().nullable(), coach: z.string().max(40).default('') }))
    .min(2)
    .max(3),
  /** Stations the coach chose to sit out when there are fewer groups than stations. Default: the last ones. */
  drop: z.array(zone).default([]),
});
const activityBlock = z.object({
  id,
  kind: z.literal('activity'),
  activity: z.enum(ACTIVITY_KINDS),
  title: z.string().max(60),
  minutes: z.number().int().min(1).max(60),
  note: z.string().max(200).default(''),
});

/** Plans saved before decision 0004 called a rotation "stations". Read them as rotations. */
function upgradeBlock(b: unknown): unknown {
  if (b && typeof b === 'object' && (b as { kind?: string }).kind === 'stations' && Array.isArray((b as { stations?: unknown }).stations)) return { ...b, kind: 'rotation' };
  return b;
}

export const blockSchema = z.preprocess(upgradeBlock, z.discriminatedUnion('kind', [drillBlock, stationsBlock, rotationBlock, activityBlock]));

export const attendanceSchema = z.object({
  counts: z.object({ Sharks: z.number().int().min(0).max(20), Bears: z.number().int().min(0).max(20), Eagles: z.number().int().min(0).max(20) }),
  /** Groups skating together today, e.g. [["Sharks", "Bears"]]. */
  merges: z.array(z.tuple([z.enum(GROUPS), z.enum(GROUPS)])).max(2).default([]),
});

export const practiceSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.number().int().min(20).max(120),
  ice: z.enum(['half', 'full']),
  status: z.enum(['draft', 'ready', 'done']),
  blocks: z.array(blockSchema).max(30),
  /** Who's here today. Null: the team's usual groups. */
  attendance: attendanceSchema.nullable().default(null),
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
export type BlockKind = Block['kind'];
export type DrillBlock = z.infer<typeof drillBlock>;
export type StationsBlock = z.infer<typeof stationsBlock>;
export type RotationBlock = z.infer<typeof rotationBlock>;
export type Attendance = z.infer<typeof attendanceSchema>;
export type Practice = z.infer<typeof practiceSchema>;
export type Team = z.infer<typeof teamSchema>;

// ---------------------------------------------------------------- who's here today

/** A group as it skates today: one skill group, or several merged. Ordered easiest first. */
export type Unit = { key: string; label: string; groups: Group[]; skaters: number };

export function usualCounts(team: Pick<Team, 'groups'>): Attendance['counts'] {
  const c = { Sharks: 0, Bears: 0, Eagles: 0 };
  team.groups.forEach((g) => (c[g.group] = g.skaters));
  return c;
}

/** Today's groups, easiest first (Sharks, Bears, Eagles). Empty groups drop out; merged groups join. */
export function todayUnits(team: Pick<Team, 'groups'>, attendance: Attendance | null): Unit[] {
  const counts = attendance?.counts ?? usualCounts(team);
  let present = GROUPS.filter((g) => counts[g] > 0);
  if (!present.length) present = [...GROUPS];
  const root = new Map<Group, Group>(present.map((g) => [g, g]));
  const find = (g: Group): Group => (root.get(g) === g ? g : find(root.get(g)!));
  for (const [a, b] of attendance?.merges ?? []) {
    if (!root.has(a) || !root.has(b)) continue;
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) root.set(GROUPS.indexOf(ra) < GROUPS.indexOf(rb) ? rb : ra, GROUPS.indexOf(ra) < GROUPS.indexOf(rb) ? ra : rb);
  }
  const units = new Map<Group, Group[]>();
  present.forEach((g) => units.set(find(g), [...(units.get(find(g)) ?? []), g]));
  return [...units.values()].map((gs) => ({ key: gs.join('+'), label: gs.join(' + '), groups: gs, skaters: gs.reduce((n, g) => n + counts[g], 0) }));
}

export function attendanceLabel(units: Unit[]): string {
  const n = units.reduce((t, u) => t + u.skaters, 0);
  return `${n} skater${n === 1 ? '' : 's'} · ${units.length} group${units.length === 1 ? '' : 's'}`;
}

/** Is today different from the team's usual groups? */
export function isAdapted(team: Pick<Team, 'groups'>, attendance: Attendance | null): boolean {
  if (!attendance) return false;
  const u = usualCounts(team);
  return attendance.merges.length > 0 || GROUPS.some((g) => attendance.counts[g] !== u[g]);
}

// ---------------------------------------------------------------- how blocks adapt

/** Which rotation stations run today: as many as there are groups (at least one). */
export function rotationToday(b: RotationBlock, groupCount: number): { active: RotationBlock['stations']; off: Zone[] } {
  const need = Math.max(0, b.stations.length - Math.max(1, groupCount));
  const letters = b.stations.map((s) => s.station);
  const off = b.drop.filter((z) => letters.includes(z)).slice(0, need);
  for (const z of [...letters].reverse()) if (off.length < need && !off.includes(z)) off.push(z);
  return { active: b.stations.filter((s) => !off.includes(s.station)), off };
}

/** The level a group does in a drill with levels: the coach's choice, else the level of its easiest group. */
export function levelFor(drill: Pick<Drill, 'levels'> | undefined, unit: Unit, chosen: Record<string, string>): string | null {
  const levels = drill?.levels ?? [];
  if (!levels.length) return null;
  const c = chosen[unit.key];
  if (c && levels.some((l) => l.level === c)) return c;
  return (levels.find((l) => l.groups.includes(unit.groups[0])) ?? levels[0]).level;
}

/** The station a group plays at in a station drill: the coach's choice, else its easiest group's station. */
export function zoneFor(drill: Pick<Drill, 'stations'> | undefined, unit: Unit, chosen: Record<string, Zone>, index = 0): Zone {
  if (chosen[unit.key]) return chosen[unit.key];
  return drill?.stations?.find((s) => s.group === unit.groups[0])?.station ?? ZONES[index % 3];
}

/** Stations with no group on them today. */
export function unusedZones(drill: Pick<Drill, 'stations'> | undefined, units: Unit[], chosen: Record<string, Zone>): Zone[] {
  const used = new Set(units.map((u, i) => zoneFor(drill, u, chosen, i)));
  return ZONES.filter((z) => !used.has(z));
}

// ---------------------------------------------------------------- time

export function blockMinutes(b: Block, groupCount = 3): number {
  return b.kind === 'rotation' ? b.minutes * rotationToday(b, groupCount).active.length : b.minutes;
}

export function totalMinutes(blocks: Block[], groupCount = 3): number {
  return blocks.reduce((t, b) => t + blockMinutes(b, groupCount), 0);
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
export function startTimes(startTime: string, blocks: Block[], groupCount = 3): string[] {
  let t = 0;
  return blocks.map((b) => {
    const s = addMinutes(startTime, t);
    t += blockMinutes(b, groupCount);
    return s;
  });
}

// ---------------------------------------------------------------- drills in a plan

/** Drill ids a block uses. */
export function drillIds(b: Block): string[] {
  if (b.kind === 'drill' || b.kind === 'stations') return b.drillId ? [b.drillId] : [];
  if (b.kind === 'rotation') return b.stations.map((s) => s.drillId).filter((x): x is string => !!x);
  return [];
}

export type FocusSummary = { attribute: (typeof FOCUS_ATTRIBUTES)[number]; level: 0 | 1 | 2; score: number }[];

/**
 * Minute-weighted focus for the practice (design decision 2026-10-12): each drill adds
 * minutes × level for each attribute it trains; every rotation station counts its full minutes because
 * every skater does every station. The top two trained attributes are Main, other trained ones Some.
 */
export function practiceFocus(blocks: Block[], drills: Map<string, Pick<Drill, 'focus'>>, groupCount = 3): FocusSummary {
  const score = new Map<string, number>(FOCUS_ATTRIBUTES.map((a) => [a, 0]));
  const add = (drillId: string | null, minutes: number) => {
    const d = drillId ? drills.get(drillId) : undefined;
    d?.focus.forEach((f) => score.set(f.attribute, (score.get(f.attribute) ?? 0) + minutes * f.level));
  };
  for (const b of blocks) {
    if (b.kind === 'drill' || b.kind === 'stations') add(b.drillId, b.minutes);
    if (b.kind === 'rotation') rotationToday(b, groupCount).active.forEach((s) => add(s.drillId, b.minutes));
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

// ---------------------------------------------------------------- making and changing blocks

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A drill from the library goes in as the block its group model calls for. */
export function blockForDrill(d: Pick<Drill, 'id' | 'minutes' | 'groupModel'>, minutes = d.minutes): Block {
  return d.groupModel === 'stations' ? { id: newId(), kind: 'stations', drillId: d.id, minutes, zones: {} } : { id: newId(), kind: 'drill', drillId: d.id, minutes, levels: {} };
}

export function newRotation(stationCount: number, minutesEach = 8): RotationBlock {
  const n = Math.min(3, Math.max(2, stationCount));
  return { id: newId(), kind: 'rotation', minutes: Math.min(20, Math.max(2, minutesEach)), stations: ZONES.slice(0, n).map((station) => ({ station, drillId: null, coach: '' })), drop: [] };
}

export function newActivity(kind: ActivityKind, minutes?: number): Block {
  return { id: newId(), kind: 'activity', activity: kind, title: ACTIVITY_LABEL[kind], minutes: minutes ?? (kind === 'water' ? 3 : 5), note: '' };
}

export type ChangeTarget = 'drill' | 'stations' | 'rotation' | ActivityKind;

/**
 * Change a block to another kind in place (design decision 2026-10-14): it keeps its place and its
 * minutes. A drill or station drill keeps its drill when it can; a new drill block starts empty.
 */
export function changeBlock(b: Block, to: ChangeTarget, groupCount = 3): Block {
  const total = blockMinutes(b, groupCount);
  const keepDrill = b.kind === 'drill' || b.kind === 'stations' ? b.drillId : b.kind === 'rotation' ? (b.stations.find((s) => s.drillId)?.drillId ?? '') : '';
  const mins = Math.min(60, Math.max(1, total));
  if (to === 'drill') return { id: b.id, kind: 'drill', drillId: keepDrill, minutes: mins, levels: {} };
  if (to === 'stations') return { id: b.id, kind: 'stations', drillId: keepDrill, minutes: mins, zones: {} };
  if (to === 'rotation') {
    if (b.kind === 'rotation') return b;
    const n = Math.min(3, Math.max(2, groupCount));
    const r = newRotation(n, Math.round(total / Math.min(n, Math.max(1, groupCount))));
    if (keepDrill) r.stations[0].drillId = keepDrill;
    return { ...r, id: b.id };
  }
  const a = newActivity(to, mins);
  return { ...a, id: b.id };
}

/** Plans made before decision 0004 hold station drills as plain drill blocks: show them as stations. */
export function withStationDrills(blocks: Block[], drills: Map<string, Pick<Drill, 'groupModel'>>): Block[] {
  return blocks.map((b) => (b.kind === 'drill' && drills.get(b.drillId)?.groupModel === 'stations' ? { id: b.id, kind: 'stations', drillId: b.drillId, minutes: b.minutes, zones: {} } : b));
}

/** The next practice starts as a copy of the last one (design decision): same blocks, fresh ids. */
export function copyBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({ ...structuredClone(b), id: newId() }));
}

/** A sensible first plan when there's nothing to copy. */
export function starterBlocks(minutes: number): Block[] {
  const blocks: Block[] = [{ ...newActivity('free_skate', 5), note: 'Greet every kid by name.' } as Block, newRotation(3, 8), newActivity('water', 3)];
  const left = minutes - totalMinutes(blocks) - 5;
  if (left > 0) blocks.push(newActivity('scrimmage', left));
  blocks.push({ ...newActivity('huddle', 5), title: 'Huddle & shout-outs' } as Block);
  return blocks;
}
