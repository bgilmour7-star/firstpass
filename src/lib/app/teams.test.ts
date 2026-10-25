import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Several teams per coach and the active-team cookie (decision 0026, spec D1), on the local store
// in a scratch folder. activeTeam() is what requireTeam() runs with the fp_team cookie.
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));

const dir = mkdtempSync(join(tmpdir(), 'fp-teams-'));
vi.spyOn(process, 'cwd').mockReturnValue(dir);

type Store = import('./store-local').LocalAppStore;
let store: Store;
let activeTeam: typeof import('../auth').activeTeam;

beforeAll(async () => {
  store = new (await import('./store-local')).LocalAppStore();
  ({ activeTeam } = await import('../auth'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('a coach on several teams', () => {
  it('lists teams newest membership first, with their role', async () => {
    const a = await store.createTeam('Avalanche', 'brett');
    const r = await store.createTeam('Rebels', 'brett', { ageGroup: 'U9' });
    const mine = await store.myTeams('brett');
    expect(mine.map((t) => [t.name, t.role])).toEqual([
      ['Rebels', 'head_coach'],
      ['Avalanche', 'head_coach'],
    ]);
    expect(r.ageGroup).toBe('U9');
    expect((await store.myTeam('brett'))?.id).toBe(r.id);
    expect((await store.myTeam('brett', a.id))?.id).toBe(a.id);
  });

  it('switching: the cookie picks the active team', async () => {
    const [rebels, avalanche] = await store.myTeams('brett');
    expect((await activeTeam(store, 'brett', avalanche.id))?.name).toBe('Avalanche');
    expect((await activeTeam(store, 'brett', rebels.id))?.name).toBe('Rebels');
    expect((await activeTeam(store, 'brett', undefined))?.name).toBe('Rebels');
  });

  it("never trusts a cookie for a team they aren't on", async () => {
    const other = await store.createTeam('Somebody else', 'kara');
    expect((await activeTeam(store, 'brett', other.id))?.name).toBe('Rebels');
    expect(await store.myTeam('brett', other.id)).toBeNull();
    expect(await activeTeam(store, 'nobody', other.id)).toBeNull();
  });

  it('joining a second team by link works (no more "on another team")', async () => {
    const code = await store.newJoinCode((await store.myTeam('kara'))!.id);
    const id = await store.joinTeam(code, 'brett');
    expect((await store.myTeams('brett')).map((t) => [t.name, t.role])[0]).toEqual(['Somebody else', 'coach']);
    expect(await store.joinTeam(code, 'brett')).toBe(id);
  });

  it('a cookie pointing at a team they have left falls back to their newest team', async () => {
    const left = (await store.myTeam('kara'))!;
    expect((await activeTeam(store, 'brett', left.id))?.id).toBe(left.id);
    await store.leaveTeam(left.id, 'brett');
    expect((await activeTeam(store, 'brett', left.id))?.name).toBe('Rebels');
  });

  it('the head coach deletes rather than leaves', async () => {
    const rebels = (await store.myTeam('brett'))!;
    await expect(store.leaveTeam(rebels.id, 'brett')).rejects.toThrow('head-coach-leaves');
    await store.deleteTeam(rebels.id);
    expect((await activeTeam(store, 'brett', rebels.id))?.name).toBe('Avalanche');
  });

  it('a coach on no team gets none', async () => {
    const a = (await store.myTeam('brett'))!;
    await store.deleteTeam(a.id);
    expect(await activeTeam(store, 'brett', a.id)).toBeNull();
  });
});
