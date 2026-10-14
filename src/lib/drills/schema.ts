import { z } from 'zod';

// One drill record. The library is curated by admins, never by coaches (v1 scope).
// Diagrams are RinkDiagram specs (see design-system/index.d.ts); we validate their
// outer shape here and leave the drawing details to the design-system renderer.

export const GROUPS = ['Sharks', 'Bears', 'Eagles'] as const;
export const FOCUS_ATTRIBUTES = ['Skating', 'Puck control', 'Passing', 'Shooting', 'Game sense', 'Effort & fun'] as const;
export const STATUSES = ['draft', 'in_review', 'approved', 'live'] as const;

export const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  live: 'Live',
};

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
    stations: z.object({ layout: z.enum(['halfice', 'halves', 'thirds', 'quarters']) }).passthrough().optional(),
  })
  .passthrough();

export const drillSchema = z.object({
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
  // How skill groups use the drill: each at a level of one progression, each at its own station,
  // or a rotation (2-3 zones with their own activity; every group does every zone, decision 0004).
  // 'versions' is the legacy spike model, kept until a reviewer picks levels or stations.
  groupModel: z.enum(['levels', 'stations', 'rotation', 'versions']),
  levels: z
    .array(z.object({ level: z.string(), name: z.string(), adds: z.string(), groups: z.array(z.enum(GROUPS)), diagram: diagramSchema }))
    .optional(),
  stations: z.array(z.object({ station: z.enum(['A', 'B', 'C']), group: z.enum(GROUPS), version: z.string() })).optional(),
  versions: z.array(z.object({ group: z.enum(GROUPS), version: z.string() })).optional(),
  /** A rotation's zones on the half-ice layout, each with its own activity. */
  zones: z
    .array(z.object({ station: z.enum(['A', 'B', 'C']), name: z.string().max(40), how: z.string().max(240), cue: z.string().max(80) }))
    .max(3)
    .optional(),
  source: z.object({ label: z.string(), url: z.string().url().nullable(), note: z.string().optional() }),
  diagram: diagramSchema,
  status: z.enum(STATUSES),
});

export type Drill = z.infer<typeof drillSchema>;
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
};

export type ReviewNote = { id: string; drillId: string; body: string; createdBy: string; createdAt: string };

// Who may move a drill where. Live drills reach coaches; only approved drills can go live.
const NEXT: Record<Status, Status[]> = {
  draft: ['in_review'],
  in_review: ['draft', 'approved'],
  approved: ['in_review', 'live'],
  live: ['approved'],
};

export function canMove(from: Status, to: Status, openDiagramRequests: number): { ok: boolean; reason?: string } {
  if (!NEXT[from].includes(to)) return { ok: false, reason: `A ${STATUS_LABEL[from].toLowerCase()} drill can't go straight to ${STATUS_LABEL[to].toLowerCase()}.` };
  const forward = STATUSES.indexOf(to) > STATUSES.indexOf(from);
  if (forward && (to === 'approved' || to === 'live') && openDiagramRequests > 0)
    return { ok: false, reason: 'Finish the open diagram change first.' };
  return { ok: true };
}

export function nextStatuses(from: Status): Status[] {
  return NEXT[from];
}

// The group model must be complete before a drill can be approved.
export function groupModelProblem(d: Drill): string | null {
  if (d.groupModel === 'versions') return 'Pick levels or stations for the groups.';
  if (d.groupModel === 'levels') {
    if (!d.levels?.length) return 'Add at least one level.';
    const covered = new Set(d.levels.flatMap((l) => l.groups));
    const missing = GROUPS.filter((g) => !covered.has(g));
    if (missing.length) return `No level for ${missing.join(', ')}.`;
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
