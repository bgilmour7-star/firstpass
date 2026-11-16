// The next practice as its drills, for Home (decision 0031). Pure, so tested.
// Drills only, in order (water, huddles and free skates are left out; a rotation or station block is
// one drill), each with its start time and minutes, marked when it serves a goal that's behind or the
// kids haven't done it before.

import type { Drill } from '../drills/schema';
import { blockMinutes, startTimes, type Block } from '../plans/schema';

export type StripDrill = { id: string; name: string; time: string; minutes: number; diagram: unknown; goal: string | null; isNew: boolean };

export function practiceStrip(p: { startTime: string; blocks: Block[] }, byId: Map<string, Pick<Drill, 'id' | 'funName' | 'diagram' | 'focus'>>, groupCount: number, known: Set<string>, behind: Set<string>): StripDrill[] {
  const times = startTimes(p.startTime, p.blocks, groupCount);
  return p.blocks.flatMap((b, i) => {
    if (b.kind === 'activity' || !b.drillId) return [];
    const d = byId.get(b.drillId);
    if (!d) return [];
    const goal = d.focus.find((f) => f.level === 2 && behind.has(f.attribute))?.attribute ?? null;
    return [{ id: b.id, name: d.funName, time: times[i], minutes: blockMinutes(b, groupCount), diagram: d.diagram, goal, isNew: !known.has(d.id) }];
  });
}

/** What a computer shows: up to 6 drills share the row; 7 or more show the first 5 and "+N more". */
export function stripShown<T>(drills: T[]): { shown: T[]; more: number } {
  return drills.length > 6 ? { shown: drills.slice(0, 5), more: drills.length - 5 } : { shown: drills, more: 0 };
}
