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

  it('hands a team to another coach on it; then the old head coach can leave', async () => {
    const t = await store.createTeam('Clippers', 'sam');
    await store.joinTeam(await store.newJoinCode(t.id), 'jo');
    await expect(store.leaveTeam(t.id, 'sam')).rejects.toThrow('head-coach-leaves');
    await store.handOverTeam(t.id, 'sam', 'jo');
    const roles = Object.fromEntries((await store.coaches(t.id)).map((c) => [c.userId, c.role]));
    expect(roles).toEqual({ sam: 'coach', jo: 'head_coach' });
    await store.leaveTeam(t.id, 'sam');
    expect((await store.coaches(t.id)).map((c) => [c.userId, c.role])).toEqual([['jo', 'head_coach']]);
    // The team and its history stay.
    expect((await store.myTeam('jo', t.id))?.name).toBe('Clippers');
  });

  it("keeps a coach's check-ins, under their name, after they leave", async () => {
    const t = (await store.myTeam('jo'))!;
    const { summarize } = await import('../plans/checkin');
    await store.joinTeam(await store.newJoinCode(t.id), 'kara');
    await store.saveCheckin({ practiceId: 'p1', teamId: t.id, userId: 'kara', editor: 'Kara', savedAt: '2026-10-20', overall: 'great', steam: 'no', steamFrom: null, ready: ['Bears'], note: '', marks: [] });
    await store.leaveTeam(t.id, 'kara');
    const checkins = await store.teamCheckins(t.id);
    expect(checkins.map((c) => c.editor)).toEqual(['Kara']);
    const s = summarize(checkins, []);
    expect(s.coaches).toEqual([{ userId: 'kara', editor: 'Kara' }]);
    expect(s.ready).toEqual(['Bears']);
  });

  it("won't hand a team to someone who isn't on it", async () => {
    const t = await store.createTeam('Hawks', 'lee');
    await expect(store.handOverTeam(t.id, 'lee', 'stranger')).rejects.toThrow('not-on-team');
    expect((await store.coaches(t.id)).find((c) => c.userId === 'lee')?.role).toBe('head_coach');
  });

  it('only the head coach can hand over', async () => {
    const t = (await store.myTeam('lee'))!;
    await store.joinTeam(await store.newJoinCode(t.id), 'max');
    await store.joinTeam(await store.newJoinCode(t.id), 'ola');
    await expect(store.handOverTeam(t.id, 'max', 'ola')).rejects.toThrow('not-head-coach');
    const heads = (await store.coaches(t.id)).filter((c) => c.role === 'head_coach').map((c) => c.userId);
    expect(heads).toEqual(['lee']);
  });

  it('a coach on no team gets none', async () => {
    const a = (await store.myTeam('brett'))!;
    await store.deleteTeam(a.id);
    expect(await activeTeam(store, 'brett', a.id)).toBeNull();
  });
});
