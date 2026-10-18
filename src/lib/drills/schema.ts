import { z } from 'zod';

// One drill record. The library is curated by admins, never by coaches (v1 scope).
// Diagrams are RinkDiagram specs (see design-system/index.d.ts); we validate their
// outer shape here and leave the drawing details to the design-system renderer.

export const GROUPS = ['Sharks', 'Bears', 'Eagles'] as const;
export const FOCUS_ATTRIBUTES = ['Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun'] as const;
export const STATUSES = ['draft', 'in_review', 'approved', 'live', 'archived'] as const;
/** Which slot of a practice a drill fills (the Hockey Canada practice shape; see the season plan decision). */
export const PARTS = ['warmup', 'skill', 'game'] as const;
export const EFFORTS = ['easy', 'medium', 'hard'] as const;
export const EFFORT_LABEL: Record<(typeof EFFORTS)[number], string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const FORMATS = ['everyone', 'groups', 'line'] as const;
export const FORMAT_LABEL: Record<(typeof FORMATS)[number], string> = { everyone: 'Everyone moves', groups: 'Small groups', line: 'One at a time' };
export const PART_LABEL: Record<(typeof PARTS)[number], string> = { warmup: 'Warm-up', skill: 'Skill', game: 'Fun game' };

export const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  live: 'Live',
  archived: 'Archived',
};

export const GROUP_MODELS = ['basic', 'stations', 'rotation'] as const;
export const GROUP_MODEL_LABEL: Record<(typeof GROUP_MODELS)[number], string> = { basic: 'Basic', stations: 'Stations', rotation: 'Rotation' };
/** A basic drill plus at most two added levels: one level per group. */
export const MAX_LEVELS = 3;

const point = z.tuple([z.number(), z.number()]);
const xy = z.object({ x: z.number(), y: z.number() }).passthrough();

export const diagramSchema = z
  .object({
    scope: z.enum(['full', 'half', 'zone']).optional(),
    side: z.enum(['left', 'right']).optional(),
    zone: z.enum(['A', 'B', 'C']).optional(),
    players: z.array(xy.extend({ role: z.enum(['O', 'X', 'F', 'D', 'C', 'G']) })).optional(),
    paths: z
      .array(
        z
          .object({
            type: z.enum(['skate', 'puck', 'pass', 'shot', 'backward']),
            points: z.array(point).min(2),
            step: z.union([z.number(), z.string()]).optional(),
            caption: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    cones: z.array(xy).optional(),
    sticks: z.array(z.object({ points: z.tuple([point, point]) })).optional(),
    stations: z.object({ layout: z.enum(['halfice', 'halves', 'thirds', 'quarters']) }).passthrough().optional(),
  })
  .passthrough();

const drillObject = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and dashes'),
  funName: z.string().min(1, 'Give the drill a name kids will remember').max(40),
  plainName: z.string().min(1, 'Say what the drill works on in plain words').max(60),
  sourceTitle: z.string().optional(),
  minutes: z.number().int().min(1).max(30),
  gear: z.string(),
  worksAsStation: z.boolean(),
  description: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).max(6),
  cues: z.array(z.string().min(1)).min(1).max(3),
  focus: z
    .array(z.object({ attribute: z.enum(FOCUS_ATTRIBUTES), level: z.union([z.literal(1), z.literal(2)]), why: z.string() }))
    .min(1)
    .refine((f) => f.filter((x) => x.level === 2).length <= 2, 'At most two Main focus attributes')
    .refine((f) => new Set(f.map((x) => x.attribute)).size === f.length, 'Each attribute once'),
  // How skill groups use the drill (decision 0006):
  // 'basic': one drill everyone can do. It is Level 1; up to two harder levels can be added.
  // 'stations': each group plays its own version at its own spot on half ice, all at once.
  // 'rotation': 2-3 zones with their own activity; every group does every zone (decision 0004).
  groupModel: z.enum(GROUP_MODELS),
  part: z.enum(PARTS).default('skill'),
  /** How hard the kids work physically (decision 0008). Drives the variety check: a third Hard drill in a row is flagged. */
  effort: z.enum(EFFORTS).optional(),
  /** How the group is organised. "line" (one at a time) is the main cause of too much waiting. */
  format: z.enum(FORMATS).optional(),
  /** The Hockey Canada U7 lessons this drill comes from, e.g. [3, 4]. Lets the season plan find it. */
  lessons: z.array(z.number().int().min(1).max(32)).default([]),
  /** A basic drill's own level (Level 1) in a few words, e.g. "Skate the course". */
  levelName: z.string().max(40).default(''),
  /** Harder levels added on top of the drill: Level 2, then Level 3. Each adds one thing and has its own diagram. */
  levels: z.array(z.object({ name: z.string().max(40), adds: z.string().max(200), diagram: diagramSchema })).max(MAX_LEVELS - 1).default([]),
  stations: z.array(z.object({ station: z.enum(['A', 'B', 'C']), group: z.enum(GROUPS), version: z.string() })).optional(),
  /** A rotation's zones on the half-ice layout, each with its own activity. */
  zones: z
    .array(z.object({ station: z.enum(['A', 'B', 'C']), name: z.string().max(40), how: z.string().max(240), cue: z.string().max(80) }))
    .max(3)
    .optional(),
  source: z.object({ label: z.string(), url: z.string().url().nullable(), note: z.string().optional() }),
  diagram: diagramSchema,
  status: z.enum(STATUSES),
});

export const drillSchema = z.preprocess((raw) => fromZones(upgradeDrill(raw)), drillObject);

/** The first sentence of a zone's "How it works", which is that zone's diagram caption. */
export function firstSentenceOf(t: string): string {
  const s = t.trim();
  return (s.match(/^[^.!?]*[.!?]/)?.[0] ?? s).trim();
}

/** A rotation zone's step line: "Walk backwards: Line up on the goal line facing the end boards, toes turned in." */
export function zoneStep(z: { name: string; how: string }): string {
  const first = firstSentenceOf(z.how);
  return [z.name.trim(), first].filter(Boolean).join(': ');
}

/**
 * A rotation drill's zones are the one place each zone is written (design decision 2026-10-17).
 * Its steps, cues and diagram captions are derived from them on every read and save, so they
 * can never drift: step n and diagram step n are zone n (its badge shows the zone letter), and each zone's "Say this" is a cue.
 */
export function fromZones(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const d = raw as Record<string, unknown> & { groupModel?: string; zones?: { station: string; name: string; how: string; cue: string }[]; diagram?: { paths?: Record<string, unknown>[] } };
  if (d.groupModel !== 'rotation' || !Array.isArray(d.zones) || !d.zones.length) return raw;
  const steps = d.zones.map((z) => zoneStep(z) || z.station);
  const zoneCues = d.zones.map((z) => z.cue.trim()).filter(Boolean);
  const cues = zoneCues.length ? zoneCues : d.zones.map((z) => z.name.trim() || z.station);
  const diagram = d.diagram && Array.isArray(d.diagram.paths)
    ? { ...d.diagram, paths: d.diagram.paths.map((p) => (typeof p.step === 'number' && steps[p.step - 1] ? { ...p, caption: steps[p.step - 1], stepLabel: d.zones![p.step - 1].station } : p)) }
    : d.diagram;
  return { ...d, steps: steps.slice(0, 6), cues: cues.slice(0, 3), diagram };
}

export type Drill = z.infer<typeof drillSchema>;
export type GroupModel = Drill['groupModel'];

const ORDER: readonly string[] = GROUPS;
const firstSentence = (t: string) => (t.split(/(?<=[.!?])\s/)[0] ?? t).replace(/[.!?]$/, '').slice(0, 40);

/**
 * Reads drills saved before decision 0006. Stored drills are upgraded when read and saved in
 * the new shape the next time they are saved, so no data migration is needed.
 * - 'together' → basic, no added levels.
 * - 'levels' (one level per group, 1.0/1.1/1.2) → basic: the first level names Level 1, the rest are added levels.
 * - 'versions' (a line of text per group) → basic: the easiest group's line names Level 1, the others become added levels.
 */
export function upgradeDrill(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const d = raw as Record<string, unknown> & { groupModel?: string; diagram?: unknown };
  const { versions, ...rest } = d as typeof d & { versions?: { group: string; version: string }[] };
  if (d.groupModel === 'together') return { ...rest, groupModel: 'basic', levels: [] };
  if (d.groupModel === 'levels' && Array.isArray(d.levels)) {
    const old = d.levels as { name?: string; adds?: string; diagram?: unknown }[];
    return {
      ...rest,
      groupModel: 'basic',
      levelName: (old[0]?.name ?? '').slice(0, 40),
      levels: old.slice(1, MAX_LEVELS).map((l) => ({ name: (l.name ?? '').slice(0, 40), adds: (l.adds ?? '').slice(0, 200), diagram: l.diagram ?? d.diagram })),
    };
  }
  if (d.groupModel === 'versions') {
    const v = [...(versions ?? [])].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
    return {
      ...rest,
      groupModel: 'basic',
      levelName: firstSentence(v[0]?.version ?? ''),
      levels: v.slice(1, MAX_LEVELS).map((x) => ({ name: firstSentence(x.version), adds: x.version.slice(0, 200), diagram: d.diagram })),
    };
  }
  return rest;
}

/** A drill's shape in a few words, the same on every screen: "Basic · 3 levels", "Stations", "Rotation · 3 zones". */
export function shapeLabel(d: Pick<Drill, 'groupModel' | 'levels' | 'zones'>): string {
  if (d.groupModel === 'rotation') return `Rotation · ${d.zones?.length ?? 0} zones`;
  if (d.groupModel === 'stations') return 'Stations';
  return d.levels?.length ? `Basic · ${d.levels.length + 1} levels` : 'Basic';
}

/** The block a drill goes in (decision 0006: the drill decides the block). */
export const BLOCK_FOR: Record<(typeof GROUP_MODELS)[number], string> = { basic: 'Drill', stations: 'Stations', rotation: 'Rotation' };

/** How many levels a drill has: 1 for a drill with nothing added, up to 3. */
export function levelCount(d: Pick<Drill, 'groupModel' | 'levels'>): number {
  return d.groupModel === 'basic' ? 1 + (d.levels?.length ?? 0) : 1;
}

/** Level n of a drill (1-based). Level 1 is the drill itself. */
export function levelOf(d: Pick<Drill, 'levelName' | 'description' | 'diagram' | 'levels'>, n: number): { n: number; name: string; adds: string; diagram: Drill['diagram'] } {
  if (n <= 1 || !d.levels?.[n - 2]) return { n: 1, name: d.levelName || 'Basic', adds: '', diagram: d.diagram };
  const l = d.levels[n - 2];
  return { n, name: l.name, adds: l.adds, diagram: l.diagram };
}
export type Status = (typeof STATUSES)[number];
export type Group = (typeof GROUPS)[number];

export type DiagramRequest = {
  id: string;
  drillId: string;
  note: string;
  createdBy: string;
  createdAt: string; // ISO, UTC
  resolvedAt: string | null;
  resolution: string | null;
  /** The diagram as it was when the request was sent, so the reviewer can compare it with the redraw. Null for older requests. */
  before: Drill['diagram'] | null;
};

export type ReviewNote = { id: string; drillId: string; body: string; createdBy: string; createdAt: string };

// Who may move a drill where. Live drills reach coaches; only approved drills can go live.
// Any drill can be archived (not good enough to keep); an archived drill comes back through review.
const NEXT: Record<Status, Status[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['draft', 'approved', 'archived'],
  approved: ['in_review', 'live', 'archived'],
  live: ['approved', 'archived'],
  archived: ['in_review'],
};

export function canMove(from: Status, to: Status, openDiagramRequests: number): { ok: boolean; reason?: string } {
  if (!NEXT[from].includes(to)) return { ok: false, reason: `A ${STATUS_LABEL[from].toLowerCase()} drill can't go straight to ${STATUS_LABEL[to].toLowerCase()}.` };
  const forward = from !== 'archived' && STATUSES.indexOf(to) > STATUSES.indexOf(from);
  if (forward && (to === 'approved' || to === 'live') && openDiagramRequests > 0)
    return { ok: false, reason: 'Finish the open diagram change first.' };
  return { ok: true };
}

export function nextStatuses(from: Status): Status[] {
  return NEXT[from];
}

// The group model must be complete before a drill can be approved.
export function groupModelProblem(d: Drill): string | null {
  if (d.groupModel === 'basic' && d.levels.length) {
    if (!d.levelName.trim()) return 'Name Level 1.';
    const i = d.levels.findIndex((l) => !l.name.trim() || !l.adds.trim());
    if (i >= 0) return `Name Level ${i + 2} and say what it adds.`;
  }
  if (d.groupModel === 'stations') {
    if (!d.stations || d.stations.length !== 3) return 'Give each group a station.';
  }
  if (d.groupModel === 'rotation') {
    const z = d.zones ?? [];
    if (z.length < 2) return 'A rotation needs two or three zones.';
    if (new Set(z.map((x) => x.station)).size !== z.length) return 'Each zone needs its own letter.';
    if (z.some((x) => !x.name.trim() || !x.how.trim())) return 'Name each zone and say how it works.';
  }
  return null;
}
