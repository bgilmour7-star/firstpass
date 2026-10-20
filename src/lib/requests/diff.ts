import type { Drill } from '../drills/schema';

// What a proposed change does to a drill, field by field, in plain words for the reviewer.
export type FieldChange = { label: string; before: string; after: string };

const list = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join('\n');
const FIELDS: { label: string; get: (d: Drill) => string }[] = [
  { label: 'Fun name', get: (d) => d.funName },
  { label: 'Plain name', get: (d) => d.plainName },
  { label: 'Minutes', get: (d) => String(d.minutes) },
  { label: 'Gear', get: (d) => d.gear },
  { label: 'How it runs', get: (d) => d.description },
  { label: 'Steps', get: (d) => list(d.steps) },
  { label: 'Say this', get: (d) => list(d.cues) },
  { label: 'Works on', get: (d) => d.focus.map((f) => `${f.attribute}${f.level === 2 ? ' (main)' : ''}`).join(', ') },
  { label: 'Levels', get: (d) => d.levels.map((l, i) => `Level ${i + 2}: ${l.name}. Adds: ${l.adds}`).join('\n') },
];

export function drillChanges(before: Drill, after: Drill): FieldChange[] {
  return FIELDS.map((f) => ({ label: f.label, before: f.get(before), after: f.get(after) })).filter((c) => c.before !== c.after);
}

export const diagramChanged = (before: Drill, after: Drill) =>
  JSON.stringify(before.diagram) !== JSON.stringify(after.diagram) || JSON.stringify(before.levels.map((l) => l.diagram)) !== JSON.stringify(after.levels.map((l) => l.diagram));
