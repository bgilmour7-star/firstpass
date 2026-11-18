import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAnalytics } from '@/lib/auth';
import { getBroadcastStore } from '@/lib/broadcasts/store';
import { SEGMENT_LABEL } from '@/lib/broadcasts/schema';
import { updatesUrl } from '@/lib/broadcasts/send';
import { broadcastEmail, emailLinks } from '@/lib/email/broadcast-email';
import { After } from './after';
import { Compose } from './compose';
import { CarryOn } from './carry-on';

export const dynamic = 'force-dynamic';

// One email from Admin → Send (decision 0035): the editor while it's a draft; once sent, what went out and to how
// many, with Carry on sending if it stopped halfway.

const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' });

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAnalytics('/admin/send');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const store = await getBroadcastStore();
  const b = await store.get(id);
  if (!b) notFound();
  const back = (
    <Link href="/admin/send" className="inline-flex min-h-11 items-center self-start text-sm text-rink-100 hover:underline">
      ← All emails
    </Link>
  );
  if (b.status === 'draft')
    return (
      <div className="flex flex-col gap-4 pb-16">
        {back}
        <h1 className="text-[30px] font-bold leading-[1.1]">{b.subject || 'New email'}</h1>
        <Compose id={b.id} initial={{ subject: b.subject, preheader: b.preheader, greeting: b.greeting, blocks: b.blocks, segment: b.segment, ageGroup: b.ageGroup }} to={admin.email} />
      </div>
    );
  const [c, stats] = await Promise.all([store.counts(b.id), store.stats(b.id)]);
  const html = broadcastEmail({ draft: b, firstName: 'Brett', unsubscribeUrl: updatesUrl('preview') }).html;
  return (
    <div className="flex flex-col gap-5 pb-16">
      {back}
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-bold leading-[1.1]">{b.subject}</h1>
        <p className="text-sm text-ink-200">
          {SEGMENT_LABEL[b.segment]}
          {b.segment === 'age' && b.ageGroup ? ` · ${b.ageGroup}` : ''} · {b.sentAt ? `sent ${when(b.sentAt)}` : ''}
        </p>
      </div>
      <p className="text-[15px]">
        <span className="font-mono">{c.sent}</span> sent{c.failed ? <> · <span className="font-mono text-flag-100">{c.failed}</span> failed</> : null}
        {c.skipped ? <> · <span className="font-mono">{c.skipped}</span> opted out before it went out</> : null}
        {c.queued ? <> · <span className="font-mono">{c.queued}</span> still to send</> : null}
      </p>
      {b.status === 'sending' && c.queued > 0 && <CarryOn id={b.id} left={c.queued} />}
      <After stats={stats} links={emailLinks(b.blocks)} />
      <iframe title="The email that went out" srcDoc={html} sandbox="" className="h-[720px] w-full max-w-[560px] rounded-xl border border-border-100 bg-surface-200" />
    </div>
  );
}
