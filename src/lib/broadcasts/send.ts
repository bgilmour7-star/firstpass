import 'server-only';
import { createHash } from 'node:crypto';
import { broadcastEmail } from '../email/broadcast-email';
import { FROM_BRETT, SITE } from '../email/layout';
import { OPTED_OUT, type Broadcast } from './schema';
import type { BroadcastStore, Queued } from './store';
import { logError } from '@/lib/errors';

// Sending an email to coaches (decision 0035). Up to 100 people per Resend batch call, each with their own greeting
// and opt-out link. Rows are marked as they go, so if the function stops halfway, "Carry on sending" picks up the
// queued ones; the batch's idempotency key (the people in it) keeps a retried batch from sending twice.

const BATCH = 100;
/** Stop starting new batches after this long, so a big send can't run past the function's time limit. */
const BUDGET_MS = 45_000;

export const updatesUrl = (token: string) => `${SITE}/unsubscribe/${token}/updates`;

export type DeliverResult = { sent: number; failed: number; skipped: number; left: number; error?: string };

export async function deliver(store: BroadcastStore, b: Broadcast, now = Date.now): Promise<DeliverResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: 0, skipped: 0, left: (await store.counts(b.id)).queued, error: 'RESEND_API_KEY isn’t set in Vercel.' };
  const started = now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let error: string | undefined;
  while (now() - started < BUDGET_MS) {
    const rows = await store.queued(b.id, BATCH);
    if (!rows.length) break;
    // Someone who stopped update emails (or survey emails) after Send was pressed never gets it.
    const out = rows.filter((q) => q.optedOut);
    if (out.length) {
      await store.mark(out.map((q) => q.sendId), { sent: false, error: OPTED_OUT });
      skipped += out.length;
    }
    const batch = rows.filter((q) => !q.optedOut);
    if (!batch.length) continue;
    const r = await sendBatch(key, b, batch);
    if (r.ok) {
      await store.mark(batch.map((q) => q.sendId), { sent: true });
      sent += batch.length;
    } else if (r.retry) {
      // Rate limit or Resend down: leave them queued for "Carry on sending".
      error = r.error;
      break;
    } else {
      await store.mark(batch.map((q) => q.sendId), { sent: false, error: r.error });
      failed += batch.length;
      error = r.error;
    }
  }
  await store.finish(b.id);
  return { sent, failed, skipped, left: (await store.counts(b.id)).queued, error };
}

async function sendBatch(key: string, b: Broadcast, batch: Queued[]): Promise<{ ok: true } | { ok: false; retry: boolean; error: string }> {
  const emails = batch.map((q) => {
    const unsubscribeUrl = updatesUrl(q.unsubscribeToken);
    const e = broadcastEmail({ draft: b, firstName: q.firstName, unsubscribeUrl, ref: b.ref });
    return { from: FROM_BRETT, to: [q.email], subject: e.subject, html: e.html, text: e.text, tags: [{ name: 'kind', value: 'broadcast' }], headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } };
  });
  const idempotencyKey = `broadcast-${b.id}-${createHash('sha256').update(batch.map((q) => q.personId).join(',')).digest('hex').slice(0, 32)}`;
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(emails),
  }).catch(() => null);
  if (res?.ok) return { ok: true };
  const detail = res ? `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` : 'network';
  logError('[broadcast] batch failed: %s', detail);
  // 409 concurrent_idempotent_requests: the same batch is already in progress (a double Carry on). Leave it queued
  // rather than call it failed. Other 409s (the same key with a different body) are real failures.
  const busy = res?.status === 409 && /concurrent_idempotent_requests/.test(detail);
  const retry = !res || busy || res.status === 429 || res.status >= 500;
  return { ok: false, retry, error: res?.status === 429 ? 'Resend is rate limiting. Try Carry on sending in a minute.' : busy ? 'That batch is already being sent. Wait a minute, then Carry on sending.' : `Resend said: ${detail}` };
}
