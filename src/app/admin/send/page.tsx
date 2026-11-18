import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { getBroadcastStore } from '@/lib/broadcasts/store';
import { SEGMENT_LABEL, type Broadcast } from '@/lib/broadcasts/schema';
import { newEmail } from './actions';

export const dynamic = 'force-dynamic';

// Admin → Send (decision 0035): emails Brett writes to all coaches or a segment, newest first. Drafts open in the
// editor; sent ones show who got them.

const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Vancouver' });

export default async function SendPage() {
  await requireAnalytics('/admin/send');
  let list: Broadcast[] = [];
  let missing = false;
  try {
    list = await (await getBroadcastStore()).list();
  } catch (e) {
    if (e instanceof Error && e.message === 'broadcasts-migration-missing') missing = true;
    else throw e;
  }
  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold leading-[1.1]">Send</h1>
          <p className="max-w-[60ch] text-sm text-ink-200">Emails from you to all coaches or a group of them, in the Firstpass template. Coaches can stop these and keep their practice emails.</p>
        </div>
        {!missing && (
          <form action={newEmail}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
              New email
            </button>
          </form>
        )}
      </div>
      {missing && (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          The email tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261123000000_broadcasts.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}
      {!missing && list.length === 0 && <p className="text-sm text-ink-200">No emails yet. Start one with New email.</p>}
      {list.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-100 border-y border-border-100">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/send/${b.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 hover:bg-surface-200">
                <span className="flex min-w-0 flex-col">
                  <b className="truncate font-semibold">{b.subject || 'No subject yet'}</b>
                  <span className="text-[13px] text-ink-200">
                    {SEGMENT_LABEL[b.segment]}
                    {b.segment === 'age' && b.ageGroup ? ` · ${b.ageGroup}` : ''}
                  </span>
                </span>
                <span className="text-[13px] text-ink-200">
                  {b.status === 'draft' ? `Draft · edited ${day(b.updatedAt)}` : b.status === 'sending' ? `Sending stopped · ${b.recipients} coaches` : `Sent ${day(b.sentAt ?? b.updatedAt)} · ${b.recipients} ${b.recipients === 1 ? 'coach' : 'coaches'}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
