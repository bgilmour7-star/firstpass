import 'server-only';
import { createHash } from 'node:crypto';
import { broadcastEmail } from '../email/broadcast-email';
import { FROM_BRETT, SITE } from '../email/layout';
import type { Broadcast } from './schema';
import type { BroadcastStore, Queued } from './store';

// Sending an email to coaches (decision 0035). Up to 100 people per Resend batch call, each with their own greeting
// and opt-out link. Rows are marked as they go, so if the function stops halfway, "Carry on sending" picks up the
// queued ones; the batch's idempotency key (the people in it) keeps a retried batch from sending twice.

const BATCH = 100;
/** Stop starting new batches after this long, so a big send can't run past the function's time limit. */
const BUDGET_MS = 45_000;

export const updatesUrl = (token: string) => `${SITE}/unsubscribe/${token}/updates`;

export type DeliverResult = { sent: number; failed: number; left: number; error?: string };

export async function deliver(store: BroadcastStore, b: Broadcast, now = Date.now): Promise<DeliverResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: 0, left: (await store.counts(b.id)).queued, error: 'RESEND_API_KEY isn’t set in Vercel.' };
  const started = now();
  let sent = 0;
  let failed = 0;
  let error: string | undefined;
  while (now() - started < BUDGET_MS) {
    const batch = await store.queued(b.id, BATCH);
    if (!batch.length) break;
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
  return { sent, failed, left: (await store.counts(b.id)).queued, error };
}

async function sendBatch(key: string, b: Broadcast, batch: Queued[]): Promise<{ ok: true } | { ok: false; retry: boolean; error: string }> {
  const emails = batch.map((q) => {
    const unsubscribeUrl = updatesUrl(q.unsubscribeToken);
    const e = broadcastEmail({ draft: b, firstName: q.firstName, unsubscribeUrl });
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
  console.error('[broadcast] batch failed: %s', detail);
  return { ok: false, retry: !res || res.status === 429 || res.status >= 500, error: res?.status === 429 ? 'Resend is rate limiting. Try Carry on sending in a minute.' : `Resend said: ${detail}` };
}
