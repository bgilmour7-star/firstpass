import { levelCount, type Drill } from '../drills/schema';
import type { Checkin, RateUnit } from './checkin';
import type { DrillFeedback } from './feedback';
import { activeGroups, blockLevels, groupLabel, type Block, type Team } from './schema';
import { mainSkill } from './variety';

// Suggestions on the next plan from the latest check-in (decision 0022). Rules, no AI: the same
// answers always give the same suggestion, and each one says why. A suggestion is a proposal on the
// block it's about; nothing changes until a coach taps. Everything is worked out against the last
// practice, so a suggestion that's been acted on simply stops appearing.
//
//   A group was ready for harder   add the next level to ONE drill they know (the one done most)
//   Flopped: too much waiting      swap for a drill with the same Main skill where everyone moves
//   Flopped: too hard              turn off its top level, else swap for an easier drill
//   Flopped: too easy              add its next level, else swap for a harder drill
//   Flopped: confusing setup       swap for a drill the kids know
//   Got bored from a drill         put a fun game before it
//   Got tired from a drill         put a water break before it
//   Big hit                        never suggested away; listed as staying
//
// At most three per plan (flops first). Only where the coaches agree: a split gives no suggestion.

export const MAX_SUGGESTIONS = 3;

export type SuggestionKind = 'add-level' | 'drop-level' | 'swap' | 'game-before' | 'water-before';

export type Suggestion = {
  /** Stable while the facts behind it stay the same; "Keep as is" stores it. */
  key: string;
  blockId: string;
  kind: SuggestionKind;
  /** The coaches whose answers it comes from. */
  by: string[];
  /** Bold: what happened. */
  title: string;
  /** Plain: what to do about it. */
  detail: string;
  /** add-level / drop-level: the level added or turned off. */
  level?: number;
  /** swap / game-before: the drill proposed. Missing on a swap when nothing fits: the coach picks. */
  drillId?: string;
  /** Why the proposed drill fits, in a few words each. */
  fits?: string[];
  /** One line for the margin: "Ski Racer · add Level 2". */
  short: string;
};

export type SuggestInput = {
  /** The plan being edited, as it is now. */
  blocks: Block[];
  /** The practice the check-ins are about. */
  last: { date: string; blocks: Block[] };
  /** Every coach's check-in on that practice. */
  checkins: Checkin[];
  /** What could be rated at that practice (rateUnits). */
  units: RateUnit[];
  /** The live library. */
  byId: Map<string, Drill>;
  /** Drills the kids have done before this plan. */
  known: Set<string>;
  /** What coaches said about each drill before this plan (drillFeedback). */
  feedback: Record<string, DrillFeedback>;
  /** How many earlier practices each drill ran in. */
  runs: Record<string, number>;
  /** What the team calls each group, and which it uses (decision 0026). Default: the slot names, all three. */
  team?: Pick<Team, 'groups'>;
};

export type SuggestResult = {
  list: Suggestion[];
  /** Big hits from the last practice that are still in the plan. */
  stays: string[];
};

const EFFORT_RANK = { easy: 0, medium: 1, hard: 2 } as const;
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

type Want = { format?: 'everyone'; known?: boolean; effort?: 'easier' | 'harder' };

/** The one drill to propose instead of `cur` in `block`, or null when nothing fits. */
export function pickSwap(cur: Drill, block: Block, want: Want, i: Pick<SuggestInput, 'blocks' | 'byId' | 'known' | 'feedback'>): Drill | null {
  const inPlan = new Set(i.blocks.flatMap((b) => (b.kind === 'activity' ? [] : b.kind === 'rotation' ? [b.drillId ?? ''] : [b.drillId])));
  const main = mainSkill(cur);
  const rank = (d: Drill) => (d.effort ? EFFORT_RANK[d.effort] : 1);
  const ok = [...i.byId.values()].filter((d) => {
    if (d.id === cur.id || inPlan.has(d.id)) return false;
    if (d.groupModel !== cur.groupModel || d.part !== cur.part) return false;
    if (main && mainSkill(d) !== main) return false;
    if (Math.abs(d.minutes - block.minutes) > 2) return false;
    if (i.feedback[d.id]?.warn) return false;
    if (want.format && d.format !== want.format) return false;
    if (want.known && !i.known.has(d.id)) return false;
    if (want.effort === 'easier' && !(rank(d) < rank(cur))) return false;
    if (want.effort === 'harder' && !(rank(d) > rank(cur))) return false;
    return true;
  });
  // Big hits first, then drills the kids know, then the closest in minutes, then by name.
  const score = (d: Drill) => (i.feedback[d.id]?.loved ? 0 : 10) + (i.known.has(d.id) ? 0 : 5) + Math.abs(d.minutes - block.minutes);
  return ok.sort((a, b) => score(a) - score(b) || a.funName.localeCompare(b.funName))[0] ?? null;
}

function fitsFor(d: Drill, cur: Drill, i: Pick<SuggestInput, 'known' | 'feedback'>, want: Want): string[] {
  const out: string[] = [];
  const main = mainSkill(d);
  if (main && main === mainSkill(cur)) out.push(`${main}, same as now`);
  if (want.format === 'everyone' || d.format === 'everyone') out.push('Everyone moves');
  if (want.effort === 'easier') out.push('Easier');
  if (want.effort === 'harder') out.push('Harder');
  if (i.feedback[d.id]?.loved) out.push('A Big hit before');
  else if (i.known.has(d.id)) out.push('The kids know it');
  return out;
}

export function suggestions(i: SuggestInput): SuggestResult {
  const out: Suggestion[] = [];
  const unitByKey = new Map(i.units.map((u) => [u.key, u]));
  const blockFor = (drillId: string) => i.blocks.findIndex((b) => b.kind !== 'activity' && b.drillId === drillId);
  const taken = new Set<string>();

  // --- Flops the coaches agree on (drills and stations; rotation zones aren't handled yet).
  const marks = new Map<string, { flop: Set<string>; hit: Set<string>; reasons: Set<string> }>();
  for (const c of i.checkins)
    for (const m of c.marks) {
      const u = unitByKey.get(m.key);
      if (!u || u.zone) continue;
      const v = marks.get(m.drillId) ?? { flop: new Set(), hit: new Set(), reasons: new Set() };
      marks.set(m.drillId, v);
      (m.rating === 'flop' ? v.flop : v.hit).add(c.editor);
      if (m.rating === 'flop') m.reasons.forEach((r) => v.reasons.add(r));
    }

  // When they lost steam: the earliest point any coach gave, and who said so.
  const order = new Map(i.units.map((u, n) => [u.key, n]));
  const steamFrom = i.checkins
    .filter((c) => (c.steam === 'bored' || c.steam === 'tired') && c.steamFrom && order.has(c.steamFrom))
    .sort((a, b) => order.get(a.steamFrom!)! - order.get(b.steamFrom!)!);
  const steam = steamFrom[0] ? { unit: unitByKey.get(steamFrom[0].steamFrom!)!, how: steamFrom[0].steam as 'bored' | 'tired', by: [...new Set(steamFrom.filter((c) => c.steamFrom === steamFrom[0].steamFrom).map((c) => c.editor))] } : null;
  const steamWords = steam ? (steam.how === 'bored' ? 'got bored' : 'got tired') : '';

  for (const [drillId, v] of marks) {
    if (!v.flop.size || v.hit.size) continue; // a split gives no suggestion
    const at = blockFor(drillId);
    const b = i.blocks[at];
    const cur = i.byId.get(drillId);
    if (at < 0 || !cur || (b.kind !== 'drill' && b.kind !== 'stations')) continue;
    const r = v.reasons;
    const by = [...v.flop];
    const why = r.has('waiting') ? 'too much waiting' : r.has('too_hard') ? 'too hard' : r.has('too_easy') ? 'too easy' : r.has('setup') ? 'confusing setup' : '';
    const title = `Flopped${why ? `: ${why}` : ''}.`;
    const lost = steam && steam.unit.drillId === drillId ? ` The kids ${steamWords} from here.` : '';
    const marked = by.length > 2 ? 'All of you marked it.' : by.length > 1 ? 'Both of you marked it.' : `${by[0]} marked it.`;
    const base = { key: `flop:${drillId}`, blockId: b.id, by: [...new Set([...by, ...(lost ? steam!.by : [])])], title };
    const lv = b.kind === 'drill' ? blockLevels(cur, b) : [1];
    const top = Math.max(...lv);

    if (r.has('too_hard') && b.kind === 'drill' && lv.length > 1) {
      out.push({ ...base, kind: 'drop-level', level: top, detail: `${marked}${lost} Turn off Level ${top} and give Level ${top - 1} all ${b.minutes} min.`, short: `${cur.funName} · drop Level ${top}` });
    } else if (r.has('too_easy') && b.kind === 'drill' && top < levelCount(cur)) {
      out.push({ ...base, kind: 'add-level', level: top + 1, detail: `${marked}${lost} Add Level ${top + 1}: ${cur.levels[top - 1]?.name ?? 'the next level'}.`, short: `${cur.funName} · add Level ${top + 1}` });
    } else {
      const want: Want = r.has('waiting') ? { format: 'everyone' } : r.has('too_hard') ? { effort: 'easier' } : r.has('too_easy') ? { effort: 'harder' } : r.has('setup') ? { known: true } : {};
      const main = mainSkill(cur);
      const d = pickSwap(cur, b, want, i);
      const what = want.format ? `a${main ? ` ${main.toLowerCase()}` : ''} drill where everyone moves at once` : want.effort === 'easier' ? `an easier${main ? ` ${main.toLowerCase()}` : ''} drill` : want.effort === 'harder' ? `a harder${main ? ` ${main.toLowerCase()}` : ''} drill` : want.known ? 'one the kids already know' : `another${main ? ` ${main.toLowerCase()}` : ''} drill`;
      out.push({
        ...base,
        kind: 'swap',
        drillId: d?.id,
        fits: d ? fitsFor(d, cur, i, want) : undefined,
        detail: `${marked}${lost} ${d ? `Try ${what}:` : `Nothing in the library fits this spot as well. Pick ${what}.`}`,
        short: `${cur.funName} · swap`,
      });
    }
    taken.add(b.id);
  }

  // --- Lost steam at a drill that didn't flop: a break before it.
  if (steam) {
    const at = blockFor(steam.unit.drillId);
    const b = i.blocks[at];
    const prev = i.blocks[at - 1];
    const name = i.byId.get(steam.unit.drillId)?.funName ?? steam.unit.name;
    if (at >= 0 && !taken.has(b.id)) {
      const title = `The kids ${steamWords} from here.`;
      const by = steam.by;
      const said = by.length > 1 ? `${list(by)} both said so.` : `${by[0]} said so.`;
      if (steam.how === 'tired') {
        const breakBefore = prev?.kind === 'activity' && prev.activity === 'water';
        if (!breakBefore) out.push({ key: `steam:${steam.unit.drillId}`, blockId: b.id, kind: 'water-before', by, title, detail: `${said} Put a 2-minute water break before it.`, short: `${name} · water before` });
      } else {
        const prevDrill = prev && prev.kind !== 'activity' && prev.drillId ? i.byId.get(prev.drillId) : undefined;
        const gameBefore = (prevDrill && (prevDrill.part === 'game' || prevDrill.format === 'everyone')) || (prev?.kind === 'activity' && (prev.activity === 'scrimmage' || prev.activity === 'free_skate'));
        if (!gameBefore) {
          const inPlan = new Set(i.blocks.flatMap((x) => (x.kind === 'activity' ? [] : [x.drillId ?? ''])));
          const games = [...i.byId.values()].filter((d) => d.groupModel === 'basic' && d.part === 'game' && !inPlan.has(d.id) && !i.feedback[d.id]?.warn && d.minutes <= 8);
          const score = (d: Drill) => (i.feedback[d.id]?.loved ? 0 : 10) + (i.known.has(d.id) ? 0 : 5) + d.minutes / 10;
          const g = games.sort((a, c) => score(a) - score(c) || a.funName.localeCompare(c.funName))[0];
          out.push({
            key: `steam:${steam.unit.drillId}`,
            blockId: b.id,
            kind: 'game-before',
            by,
            title,
            drillId: g?.id,
            fits: g ? [...(i.feedback[g.id]?.loved ? ['A Big hit before'] : i.known.has(g.id) ? ['The kids know it'] : []), 'Everyone moves'] : undefined,
            detail: `${said} ${g ? `Put a fun game before it (it adds ${g.minutes} min):` : 'Put a fun game before it.'}`,
            short: `${name} · game before`,
          });
        }
      }
      taken.add(b.id);
    }
  }

  // --- Ready for harder: one drill they know, the one they've done most.
  const inUse = i.team ? activeGroups(i.team) : null;
  const ready = [...new Set(i.checkins.flatMap((c) => c.ready))].filter((g) => !inUse || inUse.includes(g));
  if (ready.length) {
    const lastLevels = new Map<string, number>();
    for (const b of i.last.blocks) if (b.kind === 'drill' && b.drillId) lastLevels.set(b.drillId, Math.max(lastLevels.get(b.drillId) ?? 0, ...b.levels));
    const cands = i.blocks
      .map((b) => {
        if (b.kind !== 'drill' || taken.has(b.id) || !i.known.has(b.drillId)) return null;
        const d = i.byId.get(b.drillId);
        if (!d || i.feedback[d.id]?.warn) return null;
        // The level after the one they reached last time. Already in the plan: done.
        const next = (lastLevels.get(d.id) ?? Math.max(...blockLevels(d, b))) + 1;
        if (next > levelCount(d) || blockLevels(d, b).includes(next)) return null;
        return { b, d, next };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((x, y) => (i.runs[y.d.id] ?? 0) - (i.runs[x.d.id] ?? 0));
    const pick = cands[0];
    if (pick) {
      const by = [...new Set(i.checkins.filter((c) => c.ready.length).map((c) => c.editor))];
      const all = inUse ? inUse.length : 3;
      const groups = ready.length === all && all > 1 ? 'Every group was' : `${list(ready.map((g) => groupLabel(i.team, g)))} were`;
      const lv = blockLevels(pick.d, pick.b as Extract<Block, { kind: 'drill' }>);
      const each = Math.floor(pick.b.minutes / (lv.length + 1));
      out.push({
        key: 'ready',
        blockId: pick.b.id,
        kind: 'add-level',
        level: pick.next,
        by,
        title: `${groups} ready for harder.`,
        detail: `Add Level ${pick.next}: everyone does ${lv.length > 1 ? `Levels ${lv.join(' and ')}` : `Level ${lv[0]}`}, then ${(pick.d.levels[pick.next - 2]?.name ?? 'the next level').replace(/^./, (c) => c.toLowerCase())}.${each >= 2 ? ` ${each} min each.` : ''}`,
        short: `${pick.d.funName} · add Level ${pick.next}`,
      });
    }
  }

  // Big hits stay.
  const stays = [...marks.entries()]
    .filter(([id, v]) => v.hit.size && !v.flop.size && blockFor(id) >= 0)
    .map(([id]) => i.byId.get(id)?.funName ?? '')
    .filter(Boolean);

  return { list: out.slice(0, MAX_SUGGESTIONS), stays };
}
