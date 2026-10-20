import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getDrillStore } from '@/lib/drills/store';
import { getRequestStore } from '@/lib/requests/store';
import { SHAPE_LABEL } from '@/lib/requests/schema';
import { diagramChanged, drillChanges } from '@/lib/requests/diff';
import { PART_LABEL } from '@/lib/drills/schema';
import { Rink } from '@/components/ds';
import { Decide } from './decide';

export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' });

// One coach request (decision 0018). A suggested change shows the live drill beside Claude's
// proposal with Accept and Decline; a new-drill request shows what the coach asked for and, once
// drafted, links to the draft in Drill review.
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await (await getRequestStore()).get(id);
  if (!r) notFound();
  const current = r.drillId ? (await (await getDrillStore()).get(r.drillId))?.drill ?? null : null;
  const changes = r.kind === 'change' && current && r.proposed ? drillChanges(current, r.proposed) : [];
  const redrawn = r.kind === 'change' && current && r.proposed ? diagramChanged(current, r.proposed) : false;
  const open = r.state === 'sent' || r.state === 'drafted';
  const asked = [r.answers.part && PART_LABEL[r.answers.part], r.answers.shape && SHAPE_LABEL[r.answers.shape], r.answers.focus.join(', '), r.answers.minutes && `${r.answers.minutes} min`].filter(Boolean).join(' · ');

  return (
    <div className="flex max-w-5xl flex-col gap-7 pb-20">
      <Link href="/admin/drills" className="w-fit text-sm text-ink-200 hover:text-ink-100">
        ← Drill review
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-8">{r.kind === 'new' ? 'A coach asked for a drill' : `Suggested change to ${current?.funName ?? 'a drill'}`}</h1>
        <p className="text-ink-200">
          {r.requesterName ?? 'A coach'}
          {r.teamName ? `, ${r.teamName}` : ''} · {when(r.createdAt)} ·{' '}
          {r.state === 'sent' ? 'Waiting for Claude (drafts once a day, in the morning)' : r.state === 'drafted' ? 'Drafted, waiting for you' : r.state === 'accepted' ? 'Accepted' : `Declined${r.reason ? `: ${r.reason}` : ''}`}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">They wrote</h2>
        <blockquote className="whitespace-pre-wrap text-[17px] leading-7">“{r.description}”</blockquote>
        {asked && <p className="text-sm text-ink-200">{asked}</p>}
        {r.link && (
          <a href={r.link} target="_blank" rel="noreferrer noopener" className="w-fit break-all text-sm text-rink-100 underline underline-offset-2">
            {r.link}
          </a>
        )}
      </section>

      {r.claudeNote && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Claude&apos;s note</h2>
          <p className="text-sm leading-6">{r.claudeNote}</p>
        </section>
      )}

      {r.kind === 'new' && r.drillId && (
        <Link href={`/admin/drills/${r.drillId}`} className="w-fit rounded-full bg-rink-100 px-5 py-2.5 text-sm font-semibold text-surface-100 hover:bg-rink-200">
          Review the draft
        </Link>
      )}

      {r.kind === 'change' && current && r.proposed && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">What changes</h2>
          {redrawn && (
            <div className="grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col gap-2">
                <figcaption className="text-sm font-semibold text-ink-200">Live now</figcaption>
                <Rink spec={current.diagram} title={`${current.funName}, live`} className="rounded-md border border-border-100" />
              </figure>
              <figure className="flex flex-col gap-2">
                <figcaption className="text-sm font-semibold">Proposed</figcaption>
                <Rink spec={r.proposed.diagram} title={`${current.funName}, proposed`} className="rounded-md border-2 border-rink-100" />
              </figure>
            </div>
          )}
          {changes.length === 0 && !redrawn ? (
            <p className="text-sm text-ink-200">The proposal is the same as the live drill.</p>
          ) : (
            <dl className="flex flex-col">
              {changes.map((c) => (
                <div key={c.label} className="grid gap-2 border-t border-border-100 py-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm font-semibold">{c.label}</dt>
                  <dd className="whitespace-pre-wrap text-sm text-ink-200 line-through decoration-1">{c.before || '—'}</dd>
                  <dd className="whitespace-pre-wrap text-sm">{c.after || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      {!open && (
        <p role="status" className={`border-t border-border-100 pt-5 text-sm ${r.state === 'accepted' ? 'text-good-100' : 'text-ink-200'}`}>
          {r.state === 'accepted' ? 'Accepted' : 'Declined'}
          {r.decidedAt ? ` ${when(r.decidedAt)}` : ''}. {r.requesterName ?? 'The coach'} was emailed.
        </p>
      )}
      {open && <Decide requestId={r.id} kind={r.kind} canAccept={r.kind === 'change' && Boolean(r.proposed)} requester={r.requesterName ?? 'The coach'} />}
    </div>
  );
}
