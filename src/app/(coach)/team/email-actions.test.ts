import { beforeEach, describe, expect, it, vi } from 'vitest';

// Your emails are set from Account, per team (decision 0031). A coach changes only their own setting,
// and only for a team they're on: the actions check membership before the store is touched.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }), headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));
vi.mock('@/lib/auth', () => ({
  requireUser: async () => ({ id: 'coach-a', email: 'a@example.com', local: false }),
  requireTeam: async () => ({ coach: { id: 'coach-a' }, team: { id: 'team-1' } }),
}));
const checkin = vi.fn(async () => {});
const progress = vi.fn(async () => {});
vi.mock('@/lib/app/store', () => ({
  getAppStore: async () => ({ myTeams: async () => [{ id: 'team-1' }, { id: 'team-2' }], setCheckinEmails: checkin }),
}));
vi.mock('@/lib/progress/store', () => ({ getProgressStore: async () => ({ setEmails: progress }) }));

beforeEach(() => {
  checkin.mockClear();
  progress.mockClear();
});

describe('email settings from Account', () => {
  it('changes the caller’s own setting for a team they’re on', async () => {
    const { setCheckinEmails } = await import('./actions');
    const { setProgressEmails } = await import('../progress/actions');
    expect(await setCheckinEmails('team-2', false)).toEqual({ ok: true });
    expect(checkin).toHaveBeenCalledWith('team-2', 'coach-a', false);
    expect(await setProgressEmails('team-1', true)).toEqual({ ok: true });
    expect(progress).toHaveBeenCalledWith('team-1', 'coach-a', true);
  });
  it('refuses a team they aren’t on, and bad input, without touching the store', async () => {
    const { setCheckinEmails } = await import('./actions');
    const { setProgressEmails } = await import('../progress/actions');
    expect((await setCheckinEmails('team-9', false)).ok).toBe(false);
    expect((await setProgressEmails('team-9', false)).ok).toBe(false);
    expect((await setCheckinEmails('team-1', 'no' as unknown as boolean)).ok).toBe(false);
    expect(checkin).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });
});
