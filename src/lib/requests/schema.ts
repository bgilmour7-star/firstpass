import { z } from 'zod';
import { FOCUS_ATTRIBUTES, PARTS, drillSchema, type Drill } from '../drills/schema';

// A coach's request for a new drill, or a suggested change to one (decision 0018).
// Claude drafts it once a day; an admin reviews; the coach hears the outcome.

export const REQUEST_KINDS = ['new', 'change'] as const;
export const REQUEST_STATES = ['sent', 'drafted', 'accepted', 'declined'] as const;
export const SHAPES = ['basic', 'stations', 'rotation', 'unsure'] as const;
export const SHAPE_LABEL: Record<(typeof SHAPES)[number], string> = { basic: 'Drill', stations: 'Stations', rotation: 'Rotation', unsure: 'Not sure' };
export const OPEN_LIMIT = 5;

export const answersSchema = z.object({
  part: z.enum(PARTS).optional(),
  shape: z.enum(SHAPES).optional(),
  focus: z.array(z.enum(FOCUS_ATTRIBUTES)).max(2).default([]),
  minutes: z.number().int().min(2).max(30).optional(),
});
export type Answers = z.infer<typeof answersSchema>;

const link = z
  .string()
  .trim()
  .max(500)
  .regex(/^https?:\/\/\S+$/, 'Paste a full link, starting with https://')
  .nullable();

/** What a coach sends. */
export const requestInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), answers: answersSchema, description: z.string().trim().min(10, 'Say a bit more: what do the kids do?').max(2000), link }),
  z.object({ kind: z.literal('change'), drillId: z.string().regex(/^[a-z0-9-]+$/), description: z.string().trim().min(5, 'Say what would make it better.').max(2000) }),
]);
export type RequestInput = z.infer<typeof requestInput>;

export type DrillRequest = {
  id: string;
  kind: (typeof REQUEST_KINDS)[number];
  teamId: string;
  teamName: string | null;
  requestedBy: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  drillId: string | null;
  answers: Answers;
  description: string;
  link: string | null;
  state: (typeof REQUEST_STATES)[number];
  proposed: Drill | null;
  claudeNote: string | null;
  reason: string | null;
  createdAt: string;
  draftedAt: string | null;
  decidedAt: string | null;
};

export const isOpen = (r: Pick<DrillRequest, 'state'>) => r.state === 'sent' || r.state === 'drafted';

/** Parse a stored proposal; a broken one is treated as missing rather than crashing the review page. */
export function parseProposed(v: unknown): Drill | null {
  if (!v) return null;
  const p = drillSchema.safeParse(v);
  return p.success ? p.data : null;
}

/** Plain words for where a request is, for the coach who sent it. */
export function stateLine(r: Pick<DrillRequest, 'state' | 'kind' | 'reason'>): string {
  if (r.state === 'sent') return 'Sent · Claude drafts it · then reviewed';
  if (r.state === 'drafted') return 'Drafted · waiting for review';
  if (r.state === 'accepted') return r.kind === 'new' ? 'Live in the library' : 'Changed';
  return `Not this time${r.reason ? `: ${r.reason}` : ''}`;
}
