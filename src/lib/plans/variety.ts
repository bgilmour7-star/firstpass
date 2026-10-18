import { FOCUS_ATTRIBUTES, type Drill } from '../drills/schema';
import type { Block } from './schema';

// The variety check (decision 0008). U7s lose steam when one kind of thing runs too long, so
// the limit is two in a row: the third Hard drill, the third skill drill with no game or
// everyone-moving drill between, or the third drill on the same Main skill gets a warning on
// that third block. Rules only, no AI. It suggests; the coach decides.

export type VarietyRule = 'hard' | 'skill' | 'main';
export type VarietyWarning = { rule: VarietyRule; text: string; fix: string };

const LIMIT = 2;
/** Activities where everyone skates and plays: they break every streak. */
const MOVING = new Set(['free_skate', 'scrimmage']);

type Tags = Pick<Drill, 'effort' | 'format' | 'part' | 'focus'>;

function drillsIn(b: Block, byId: Map<string, Tags>): Tags[] {
  const ids = b.kind === 'drill' || b.kind === 'stations' ? [b.drillId] : b.kind === 'rotation' ? (b.drillId ? [b.drillId] : b.stations.map((s) => s.drillId)) : [];
  return ids.flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []));
}

/** The first Main (level 2) skill, in the library's attribute order. */
export function mainSkill(d: Pick<Drill, 'focus'>): string | null {
  const mains = d.focus.filter((f) => f.level === 2).map((f) => f.attribute);
  return FOCUS_ATTRIBUTES.find((a) => mains.includes(a)) ?? null;
}

/** Warnings by block id, in plan order. Empty blocks are skipped: they neither count nor break a streak. */
export function varietyWarnings(blocks: Block[], byId: Map<string, Tags>): Map<string, VarietyWarning[]> {
  const out = new Map<string, VarietyWarning[]>();
  let hard = 0, skill = 0, main = 0;
  let lastMain: string | null = null;
  for (const b of blocks) {
    if (b.kind === 'activity') {
      // Any break is a rest from hard work. Only skating-and-playing breaks the rest.
      hard = 0;
      if (MOVING.has(b.activity)) {
        skill = 0;
        main = 0;
        lastMain = null;
      }
      continue;
    }
    const ds = drillsIn(b, byId);
    if (!ds.length) continue;
    const isHard = ds.some((d) => d.effort === 'hard');
    const isGame = ds.some((d) => d.part === 'game') || ds.every((d) => d.format === 'everyone');
    const m = mainSkill(ds[0]);

    hard = isHard ? hard + 1 : 0;
    skill = isGame ? 0 : skill + 1;
    main = m && m === lastMain ? main + 1 : m ? 1 : 0;
    lastMain = m;

    const w: VarietyWarning[] = [];
    if (hard > LIMIT) w.push({ rule: 'hard', text: `${ordinal(hard)} Hard drill in a row. They’ll run out of legs.`, fix: 'Add a water break or an easier drill before it.' });
    if (skill > LIMIT) w.push({ rule: 'skill', text: `${ordinal(skill)} skill drill in a row with no game.`, fix: 'Add a fun game before it, or swap it for one where everyone moves.' });
    if (main > LIMIT && m) w.push({ rule: 'main', text: `${ordinal(main)} ${m} drill in a row.`, fix: 'Swap it for a different skill.' });
    if (w.length) out.set(b.id, w);
  }
  return out;
}

const ordinal = (n: number) => (['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'][n] ?? `${n}th`);
