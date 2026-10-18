import { z } from 'zod';
import { GROUPS, type Drill } from '../drills/schema';
import { addMinutes, clock, rotationToday, startTimes, todayUnits, type Practice, type Team } from './schema';

// The after-practice check-in (decision 0007, "Strava style"): one overall answer, whether
// they lost steam and from when, and only the drills that stood out. Every drill not marked
// counts as OK. Each coach checks in on their own; answers are kept side by side.

export const OVERALL = ['rough', 'ok', 'great'] as const;
export const OVERALL_LABEL: Record<(typeof OVERALL)[number], [string, string]> = { rough: ['Rough', 'a grind'], ok: ['OK', 'did the job'], great: ['Great', 'they loved it'] };
export const STEAM = ['no', 'bored', 'tired'] as const;
export const STEAM_LABEL: Record<(typeof STEAM)[number], string> = { no: 'No', bored: 'Got bored', tired: 'Got tired' };
/** Reasons describe the drill. Boredom and tiredness are about the order of drills, so they are the "lost steam" question instead. */
export const REASONS = ['waiting', 'too_hard', 'too_easy', 'setup'] as const;
export const REASON_LABEL: Record<(typeof REASONS)[number], string> = { waiting: 'Too much waiting', too_hard: 'Too hard', too_easy: 'Too easy', setup: 'Confusing setup' };

export const markSchema = z.object({
  /** Which part of the practice: a block id, or "blockId:A" for one station or zone. */
  key: z.string().min(1).max(80),
  /** The drill, so its history follows it to future plans. */
  drillId: z.string().min(1),
  rating: z.enum(['hit', 'flop']),
  reasons: z.array(z.enum(REASONS)).max(REASONS.length).default([]),
});

export const checkinInput = z.object({
  overall: z.enum(OVERALL).nullable().default(null),
  steam: z.enum(STEAM).nullable().default(null),
  /** The unit key they lost steam from. */
  steamFrom: z.string().max(80).nullable().default(null),
  ready: z.array(z.enum(GROUPS)).max(3).default([]),
  note: z.string().max(500).default(''),
  marks: z.array(markSchema).max(40).default([]),
});
export type CheckinInput = z.infer<typeof checkinInput>;
export type Mark = z.infer<typeof markSchema>;
export type Checkin = CheckinInput & { practiceId: string; teamId: string; userId: string; editor: string; savedAt: string };

/** One thing to rate: a drill, a station, or a rotation zone. */
export type RateUnit = { key: string; drillId: string; name: string; time: string; zone?: string; group?: string };

/** The practice as a list of things to rate, in order. Activities (water, huddle) and empty blocks are left out. */
export function rateUnits(p: Pick<Practice, 'blocks' | 'startTime' | 'attendance'>, team: Pick<Team, 'groups'>, byId: Map<string, Pick<Drill, 'funName' | 'zones'>>): RateUnit[] {
  const gc = todayUnits(team, p.attendance).length;
  const times = startTimes(p.startTime, p.blocks, gc);
  const out: RateUnit[] = [];
  p.blocks.forEach((b, i) => {
    const time = clock(times[i]);
    if (b.kind === 'activity') return;
    if (b.kind === 'drill' || b.kind === 'stations') {
      const d = b.drillId ? byId.get(b.drillId) : undefined;
      if (d) out.push({ key: b.id, drillId: b.drillId, name: d.funName, time });
      return;
    }
    // A rotation: each zone running today is rated on its own; they share the block's time.
    const { active } = rotationToday(b, gc);
    const rot = b.drillId ? byId.get(b.drillId) : undefined;
    active.forEach((s, j) => {
      const at = clock(addMinutes(times[i], b.minutes * j));
      if (rot) {
        const z = rot.zones?.find((x) => x.station === s.station);
        if (z) out.push({ key: `${b.id}:${s.station}`, drillId: b.drillId!, name: z.name, time: at, zone: s.station, group: rot.funName });
      } else if (s.drillId && byId.get(s.drillId)) {
        out.push({ key: `${b.id}:${s.station}`, drillId: s.drillId, name: byId.get(s.drillId)!.funName, time: at, zone: s.station, group: 'Rotation' });
      }
    });
  });
  return out;
}

/** Keep only marks that match the practice, with reasons only on Flopped. */
export function cleanMarks(marks: Mark[], units: RateUnit[]): Mark[] {
  const byKey = new Map(units.map((u) => [u.key, u]));
  const seen = new Set<string>();
  return marks.flatMap((m) => {
    const u = byKey.get(m.key);
    if (!u || seen.has(m.key)) return [];
    seen.add(m.key);
    return [{ key: m.key, drillId: u.drillId, rating: m.rating, reasons: m.rating === 'flop' ? [...new Set(m.reasons)] : [] }];
  });
}

export type CheckinSummary = {
  hits: RateUnit[];
  flops: (RateUnit & { reasons: string[]; by: string[] })[];
  split: RateUnit[];
  /** The earliest point any coach said they lost steam, and how. */
  lostSteam: { unit: RateUnit; how: 'bored' | 'tired' } | null;
  ready: string[];
  /** Big hits that were also Big hits at an earlier practice. */
  again: RateUnit[];
  coaches: { userId: string; editor: string }[];
};

/**
 * Everyone's answers merged, never averaged away: a unit counts as a Big hit or a Flop when
 * the coaches who marked it agree; when they disagree it is a split.
 */
export function summarize(checkins: Checkin[], units: RateUnit[], earlier: Checkin[] = []): CheckinSummary {
  const hits: RateUnit[] = [], flops: CheckinSummary['flops'] = [], split: RateUnit[] = [];
  for (const u of units) {
    const marks = checkins.flatMap((c) => c.marks.filter((m) => m.key === u.key).map((m) => ({ m, by: c.editor })));
    if (!marks.length) continue;
    const kinds = new Set(marks.map((x) => x.m.rating));
    if (kinds.size > 1) split.push(u);
    else if (kinds.has('hit')) hits.push(u);
    else flops.push({ ...u, reasons: [...new Set(marks.flatMap((x) => x.m.reasons))].map((r) => REASON_LABEL[r as keyof typeof REASON_LABEL]), by: marks.map((x) => x.by) });
  }
  const order = new Map(units.map((u, i) => [u.key, i]));
  const steam = checkins
    .filter((c) => (c.steam === 'bored' || c.steam === 'tired') && c.steamFrom && order.has(c.steamFrom))
    .sort((a, b) => order.get(a.steamFrom!)! - order.get(b.steamFrom!)!)[0];
  const earlierHits = new Set(earlier.flatMap((c) => c.marks.filter((m) => m.rating === 'hit').map((m) => m.drillId)));
  return {
    hits,
    flops,
    split,
    lostSteam: steam ? { unit: units[order.get(steam.steamFrom!)!], how: steam.steam as 'bored' | 'tired' } : null,
    ready: GROUPS.filter((g) => checkins.some((c) => c.ready.includes(g))),
    again: hits.filter((u) => earlierHits.has(u.drillId)),
    coaches: checkins.map((c) => ({ userId: c.userId, editor: c.editor })),
  };
}

/** When a practice's ice time is over, in the team's time zone. */
export function practiceOver(p: Pick<Practice, 'date' | 'startTime' | 'minutes'>, now = new Date()): boolean {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  if (p.date !== today) return p.date < today;
  const hhmm = now.toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hour12: false });
  return hhmm >= addMinutes(p.startTime, p.minutes);
}
