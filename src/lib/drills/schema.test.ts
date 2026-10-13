import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canMove, drillSchema, groupModelProblem, type Drill } from './schema';

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
  const base = drills.find((d) => d.groupModel === 'levels')!;
  it('needs every group placed on a level', () => {
    expect(groupModelProblem(base)).toBeNull();
    const missing = { ...base, levels: base.levels!.slice(0, 2) };
    expect(groupModelProblem(missing)).toMatch(/Eagles/);
  });
  it('legacy versions must be converted before approval', () => {
    expect(groupModelProblem({ ...base, groupModel: 'versions' })).toMatch(/levels or stations/);
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
