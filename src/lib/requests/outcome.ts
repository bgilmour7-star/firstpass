import 'server-only';
import { SITE, sendEmail } from '../email/layout';
import { outcomeEmail } from '../email/request-emails';
import { getRequestStore } from './store';
import type { DrillRequest } from './schema';

/** Record an admin's decision on a request and tell the coach who sent it (decision 0018). */
export async function closeRequest(r: DrillRequest, accepted: boolean, reason: string | null, drillName: string | null) {
  const store = await getRequestStore();
  const before = await store.decide(r.id, accepted ? 'accepted' : 'declined', reason);
  if (!before || !before.requesterEmail) return;
  const url = accepted && r.drillId ? `${SITE}/drills/${r.drillId}` : `${SITE}/drills`;
  const sent = await sendEmail(
    before.requesterEmail,
    outcomeEmail({ kind: r.kind, accepted, name: r.requesterName, drillName, reason, description: r.description, url }),
    'drill-request-outcome',
    `request-outcome-${r.id}`,
  );
  if (sent) await store.markCoachEmailed(r.id);
}

/** The open request that produced or targets this drill, if any. */
export async function openRequestFor(drillId: string, kind: DrillRequest['kind']) {
  const all = await (await getRequestStore()).all().catch(() => [] as DrillRequest[]);
  return all.find((r) => r.drillId === drillId && r.kind === kind && (r.state === 'sent' || r.state === 'drafted')) ?? null;
}
