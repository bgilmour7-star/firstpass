import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// A fake Supabase query: records whether .eq('automated', false) was applied, then answers.
type Answer = { data: unknown[] | null; error: { code?: string; message: string } | null };
let answers: ((filtered: boolean) => Answer)[] = [];
const calls: boolean[] = [];
function query() {
  let filtered = false;
  const q = {
    select: () => q,
    gte: () => q,
    order: () => q,
    eq: (col: string) => {
      if (col === 'automated') filtered = true;
      return q;
    },
    range: async () => {
      calls.push(filtered);
      return (answers.shift() ?? (() => ({ data: [], error: null })))(filtered);
    },
  };
  return q;
}
vi.mock('../supabase/server', () => ({ supabaseServer: async () => ({ from: () => query() }) }));

const row = { occurred_at: '2026-10-26T20:00:00Z', name: 'view', visitor: 'a', source: null, device: 'phone', region: 'Nanaimo, BC' };

describe('SupabaseSiteStore.events', () => {
  beforeEach(() => {
    answers = [];
    calls.length = 0;
  });

  it('leaves out automated visits once the column exists', async () => {
    const { SupabaseSiteStore } = await import('./store-supabase');
    answers = [() => ({ data: [row], error: null })];
    const out = await new SupabaseSiteStore().events('2026-10-20T00:00:00Z');
    expect(calls).toEqual([true]);
    expect(out).toHaveLength(1);
  });

  it('reads everything, without failing, before the automated column exists', async () => {
    const { SupabaseSiteStore } = await import('./store-supabase');
    answers = [() => ({ data: null, error: { code: '42703', message: 'column page_events.automated does not exist' } }), () => ({ data: [row], error: null })];
    const out = await new SupabaseSiteStore().events('2026-10-20T00:00:00Z');
    expect(calls).toEqual([true, false]);
    expect(out).toHaveLength(1);
  });

  it('still reports a missing table as the migration not being run', async () => {
    const { SupabaseSiteStore } = await import('./store-supabase');
    answers = [() => ({ data: null, error: { code: '42P01', message: 'relation "public.page_events" does not exist' } })];
    await expect(new SupabaseSiteStore().events('2026-10-20T00:00:00Z')).rejects.toThrow('waitlist-migration-missing');
  });
});
