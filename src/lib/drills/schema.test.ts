import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canMove, drillSchema, groupModelProblem, levelCount, levelOf, type Drill } from './schema';

const dir = join(__dirname, '../../../content/drills');
const drills: Drill[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

describe('content/drills', () => {
  it.each(drills.map((d) => [d.id, d]))('%s matches the schema', (_id, d) => {
    const r = drillSchema.safeParse(d);
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  it('file names match ids', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    expect(files.sort()).toEqual(drills.map((d) => d.id).sort());
  });
});

describe('status moves', () => {
  it('follows Draft → In review → Approved → Live', () => {
    expect(canMove('draft', 'in_review', 0).ok).toBe(true);
    expect(canMove('in_review', 'approved', 0).ok).toBe(true);
    expect(canMove('approved', 'live', 0).ok).toBe(true);
  });
  it('cannot skip review', () => {
    expect(canMove('draft', 'approved', 0).ok).toBe(false);
    expect(canMove('draft', 'live', 0).ok).toBe(false);
    expect(canMove('in_review', 'live', 0).ok).toBe(false);
  });
  it('blocks approval while a diagram change is open', () => {
    expect(canMove('in_review', 'approved', 1)).toEqual({ ok: false, reason: 'Finish the open diagram change first.' });
  });
  it('can always step back', () => {
    expect(canMove('live', 'approved', 3).ok).toBe(true);
    expect(canMove('approved', 'in_review', 0).ok).toBe(true);
  });
});

describe('group model', () => {
  const base = drills.find((d) => d.id === 'snake-in-the-forest')!;
  it('added levels need a name and what they add', () => {
    expect(groupModelProblem(base)).toBeNull();
    expect(groupModelProblem({ ...base, levelName: '' })).toMatch(/Level 1/);
    expect(groupModelProblem({ ...base, levels: [{ ...base.levels[0], adds: '' }] })).toMatch(/Level 2/);
  });
  it('a basic drill with nothing added needs nothing more', () => {
    expect(groupModelProblem({ ...base, levels: [], levelName: '' })).toBeNull();
  });
  it('reads drills saved before levels were an add-on', () => {
    const old = { ...base, groupModel: 'levels', levelName: undefined, levels: [
      { level: '1.0', name: 'Skate it', adds: 'No puck.', groups: ['Sharks'], diagram: base.diagram },
      { level: '1.1', name: 'Puck', adds: 'Carry the puck.', groups: ['Bears'], diagram: base.diagram },
    ] };
    const d = drillSchema.parse(old);
    expect(d).toMatchObject({ groupModel: 'basic', levelName: 'Skate it', levels: [{ name: 'Puck', adds: 'Carry the puck.' }] });
    expect(levelCount(d)).toBe(2);
    expect(levelOf(d, 1).name).toBe('Skate it');
    expect(drillSchema.parse({ ...base, groupModel: 'together', levels: undefined })).toMatchObject({ groupModel: 'basic', levels: [] });
    const v = drillSchema.parse({ ...base, groupModel: 'versions', levels: undefined, versions: [
      { group: 'Eagles', version: 'Full speed. Backhands too.' },
      { group: 'Sharks', version: 'Stand and pass.' },
      { group: 'Bears', version: 'Skate slowly.' },
    ] });
    expect(v).toMatchObject({ levelName: 'Stand and pass', levels: [{ name: 'Skate slowly' }, { name: 'Full speed' }] });
  });
  it('allows at most two Main focus attributes', () => {
    const r = drillSchema.safeParse({
      ...base,
      focus: [
        { attribute: 'Skating', level: 2, why: '' },
        { attribute: 'Passing', level: 2, why: '' },
        { attribute: 'Shooting', level: 2, why: '' },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe('rotation drills take steps, cues and captions from their zones', () => {
  it('derives them on read, so they cannot drift', async () => {
    const { drillSchema } = await import('./schema');
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'content/drills/rotation-backwards-day.json'), 'utf8'));
    raw.steps = ['stale step'];
    raw.cues = ['stale cue'];
    const d = drillSchema.parse(raw);
    expect(d.steps).toEqual(d.zones!.map((z) => `${z.name}: ${z.how.split(/(?<=[.!?])\s/)[0]}`));
    expect(d.cues).toEqual(d.zones!.map((z) => z.cue));
    const captions = (d.diagram.paths ?? []).filter((p) => typeof p.step === 'number').map((p) => p.caption);
    expect(captions).toEqual(d.steps);
  });
});

describe('rotation diagram badges', () => {
  it('show zone letters', async () => {
    const { drillSchema } = await import('./schema');
    const d = drillSchema.parse(JSON.parse(readFileSync(join(process.cwd(), 'content/drills/rotation-backwards-day.json'), 'utf8')));
    const labels = (d.diagram.paths ?? []).filter((p) => typeof p.step === 'number').map((p) => (p as { stepLabel?: string }).stepLabel);
    expect(labels).toEqual(['A', 'B', 'C']);
  });
});
