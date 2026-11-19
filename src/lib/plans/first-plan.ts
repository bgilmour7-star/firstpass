import { startLevelFor, type Drill } from '../drills/schema';
import { blockForDrill as blockFor, newActivity, starterBlocks, totalMinutes, type Block } from './schema';
import { mainSkill } from './variety';

// A team's first plan (decision 0023): a practice that could run tomorrow, built from the live
// library, instead of headings to fill in. The Hockey Canada shape: free skate, a warm-up, an easy
// skill drill, a rotation (stations), water, a fun game, a huddle. Drills from the earliest lessons
// come first, easier before harder, so a new team starts with the basics. Any time left over
// becomes small games; if the ice is short, the optional parts drop out first.
//
// It leans toward the team's focus from Create a team (decision 0039): the rotation, the skill drill
// and the game prefer drills whose main focus is one of the picked skills. The plan's Focus panel marks
// the team's picks (builder), so the coach sees their answer was used.
// The warm-up, water and huddle don't change, and with nothing in the library for a pick, the plan is
// the same as without a focus. A tilt, not a rebuild: two picks never fill the whole practice.

const effort = (d: Drill) => (d.effort === 'easy' ? 0 : d.effort === 'medium' ? 1 : d.effort === 'hard' ? 2 : 1);
const lesson = (d: Drill) => (d.lessons?.length ? Math.min(...d.lessons) : 99);
const first = (ds: Drill[], score: (d: Drill) => number) => [...ds].sort((a, b) => score(a) - score(b) || a.minutes - b.minutes || a.funName.localeCompare(b.funName))[0];
/** The team focus this drill works as a main focus, if any. */
const fitOf = (d: Drill, focus: readonly string[]) => focus.find((a) => d.focus.some((f) => f.attribute === a && f.level === 2));

/** `library` is the team's drills (drillsForAge); `ageGroup` sets where each Drill block starts (decision 0025);
 *  `focus` is the team's focus from Create a team (decision 0039). */
export function firstPlan(minutes: number, library: Drill[], groupCount = 3, ageGroup?: string, focus: readonly string[] = []): Block[] {
  const fit = (d: Drill, want: readonly string[] = focus) => (fitOf(d, want) ? 0 : 1);
  const blockForDrill = (d: Drill) => blockFor(d, d.minutes, startLevelFor(d, ageGroup));
  const basic = library.filter((d) => d.groupModel === 'basic' && d.minutes <= 10);
  const warmup = first(basic.filter((d) => d.part === 'warmup' && d.effort !== 'hard'), (d) => effort(d) * 10 + lesson(d));
  const rotation = first(library.filter((d) => d.groupModel === 'rotation' && (d.zones?.length ?? 0) >= 2), (d) => fit(d) * 10000 + effort(d) * 100 + lesson(d));
  // The skill drill works a different skill from the warm-up and the rotation, so the plan passes its own variety check.
  // Everyone moving or small groups, never a line (decision 0040: passing drills are pairs and small groups).
  // With two picks, it prefers the one the rotation didn't cover.
  const taken = new Set([warmup && mainSkill(warmup), rotation && mainSkill(rotation)]);
  const covered = rotation ? fitOf(rotation, focus) : undefined;
  const rest = focus.filter((a) => a !== covered);
  const skill = first(basic.filter((d) => d.part === 'skill' && d.format !== 'line' && d.effort !== 'hard'), (d) => (taken.has(mainSkill(d)) ? 100000 : 0) + fit(d, rest) * 10000 + fit(d) * 1000 + lesson(d) * 10 + effort(d));
  // The game leans toward the focus only when it doesn't make a third drill in a row on one skill.
  const before = new Set([skill && mainSkill(skill), rotation && mainSkill(rotation)]);
  const game = first(basic.filter((d) => d.part === 'game' && d.format === 'everyone'), (d) => (focus.length && before.has(mainSkill(d)) ? 100000 : 0) + fit(d) * 1000 + lesson(d) * 10 + effort(d));
  // Without a rotation and a game it isn't a practice yet: fall back to the plain template.
  if (!rotation || !game) return starterBlocks(minutes);

  const free = { ...newActivity('free_skate', 4), note: 'Greet every kid by name.' } as Block;
  const water = newActivity('water', 2);
  const huddle = { ...newActivity('huddle', 3), title: 'Huddle & shout-outs' } as Block;
  const parts: { block: Block; optional: number }[] = [
    { block: free, optional: 0 },
    ...(warmup ? [{ block: blockForDrill(warmup), optional: 2 }] : []),
    ...(skill ? [{ block: blockForDrill(skill), optional: 1 }] : []),
    { block: blockForDrill(rotation), optional: 0 },
    { block: water, optional: 3 },
    { block: blockForDrill(game), optional: 0 },
    { block: huddle, optional: 0 },
  ];
  // Short ice: drop the skill drill, then the warm-up drill, then water.
  let blocks = parts.map((p) => p.block);
  for (const level of [1, 2, 3]) {
    if (totalMinutes(blocks, groupCount) <= minutes) break;
    blocks = blocks.filter((b) => parts.find((p) => p.block === b)!.optional !== level);
  }
  const used = totalMinutes(blocks, groupCount);
  const left = minutes - used;
  const gameAt = blocks.findIndex((b) => b.kind === 'drill' && b.drillId === game.id);
  if (left >= 4) blocks.splice(blocks.length - 1, 0, newActivity('scrimmage', left));
  else if (left !== 0) blocks[gameAt] = { ...blocks[gameAt], minutes: Math.max(3, blocks[gameAt].minutes + left) } as Block;
  return totalMinutes(blocks, groupCount) === minutes ? blocks : starterBlocks(minutes);
}
