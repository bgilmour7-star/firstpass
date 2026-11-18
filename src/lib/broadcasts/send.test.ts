import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { deliver } from './send';
import type { BroadcastStore, Queued } from './store';
import type { Broadcast } from './schema';

const b: Broadcast = { id: 'b1', ref: 'ab12cd34', subject: 'Hi', preheader: '', greeting: true, blocks: [{ type: 'text', text: 'Hello' }], segment: 'all', ageGroup: null, status: 'sending', recipients: 0, createdAt: '', updatedAt: '', sentAt: null };

function fakeStore(n: number) {
  const rows = Array.from({ length: n }, (_, i): Queued & { status: string } => ({ sendId: `s${i}`, personId: `p${i}`, email: `c${i}@x.ca`, firstName: i % 2 ? `Coach${i}` : null, unsubscribeToken: `tok${i}`, optedOut: false, status: 'queued' }));
  let finished = false;
  const store: Partial<BroadcastStore> = {
    queued: async (_id, limit) => rows.filter((r) => r.status === 'queued').slice(0, limit),
    mark: async (ids, o) => rows.filter((r) => ids.includes(r.sendId)).forEach((r) => (r.status = o.sent ? 'sent' : 'failed')),
    finish: async () => void (finished = !rows.some((r) => r.status === 'queued')),
    counts: async () => ({ queued: rows.filter((r) => r.status === 'queued').length, sent: rows.filter((r) => r.status === 'sent').length, failed: rows.filter((r) => r.status === 'failed').length, skipped: 0 }),
  };
  return { store: store as BroadcastStore, rows, done: () => finished };
}

describe('deliver', () => {
  beforeEach(() => vi.stubEnv('RESEND_API_KEY', 'k'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends in batches of 100, each person with their own greeting and opt-out, and finishes', async () => {
    const calls: { body: { to: string[]; html: string; headers: Record<string, string> }[]; key: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)), key: (init.headers as Record<string, string>)['idempotency-key'] });
      return new Response('{}', { status: 200 });
    }));
    const { store, done } = fakeStore(230);
    const r = await deliver(store, b);
    expect(r).toEqual({ sent: 230, failed: 0, skipped: 0, left: 0, error: undefined });
    expect(calls.map((c) => c.body.length)).toEqual([100, 100, 30]);
    expect(new Set(calls.map((c) => c.key)).size).toBe(3);
    const first = calls[0].body[1];
    expect(first.to).toEqual(['c1@x.ca']);
    expect(first.html).toContain('Hi Coach1,');
    expect(first.headers['List-Unsubscribe']).toBe('<https://firstpass.coach/unsubscribe/tok1/updates>');
    expect(done()).toBe(true);
  });

  it('leaves people queued when Resend rate limits, so Carry on sending can finish', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));
    const { store, rows, done } = fakeStore(5);
    const r = await deliver(store, b);
    expect(r.sent).toBe(0);
    expect(r.left).toBe(5);
    expect(rows.every((x) => x.status === 'queued')).toBe(true);
    expect(done()).toBe(false);
  });

  it('marks a refused batch failed and moves on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 422 })));
    const { store, rows } = fakeStore(3);
    const r = await deliver(store, b);
    expect(r.failed).toBe(3);
    expect(rows.every((x) => x.status === 'failed')).toBe(true);
  });
});

describe('deliver, people who opted out after Send', () => {
  beforeEach(() => vi.stubEnv('RESEND_API_KEY', 'k'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips them, marks them, and sends to everyone else', async () => {
    const sentTo: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      for (const e of JSON.parse(String(init.body)) as { to: string[] }[]) sentTo.push(e.to[0]);
      return new Response('{}', { status: 200 });
    }));
    const { store, rows, done } = fakeStore(4);
    rows[1].optedOut = true;
    const r = await deliver(store, b);
    expect(sentTo).toEqual(['c0@x.ca', 'c2@x.ca', 'c3@x.ca']);
    expect(r).toMatchObject({ sent: 3, skipped: 1, left: 0 });
    expect(rows[1].status).toBe('failed');
    expect(done()).toBe(true);
  });

  it('leaves a batch Resend says is already in progress (409) queued, not failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"name":"concurrent_idempotent_requests"}', { status: 409 })));
    const { store, rows } = fakeStore(2);
    const r = await deliver(store, b);
    expect(r.left).toBe(2);
    expect(rows.every((x) => x.status === 'queued')).toBe(true);
  });
});

describe('deliver, a 409 for a changed body', () => {
  beforeEach(() => vi.stubEnv('RESEND_API_KEY', 'k'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('is a real failure, not in progress', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"name":"invalid_idempotent_request"}', { status: 409 })));
    const { store, rows } = fakeStore(2);
    const r = await deliver(store, b);
    expect(r.failed).toBe(2);
    expect(rows.every((x) => x.status === 'failed')).toBe(true);
  });
});
