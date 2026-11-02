import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { getDiscoveryStore } from '@/lib/discovery/store';
import { REGISTRY, SECTIONS, entry as findEntry, type Entry } from '@/lib/email/journeys';
import type { SendStats } from '@/lib/discovery/schema';
import { TestSend } from './test-send';
import { EmailDrawer } from './email-drawer';

export const dynamic = 'force-dynamic';

// Admin → Emails (decision 0027; canvas A3): every email Firstpass sends, drawn from the registry
// (src/lib/email/journeys.ts). Picking one opens it at reading size in a drawer from the right, so
// the journeys keep the full width and their scroll position.

const DAY = 86_400_000;

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const admin = await requireAnalytics('/admin/emails');
  const { email: picked } = await searchParams;
  const selected = picked ? findEntry(picked) : undefined;
  let stats: SendStats = [];
  try {
    stats = await (await getDiscoveryStore()).sendStats(new Date(Date.now() - 30 * DAY).toISOString());
  } catch {
    stats = [];
  }
  const stat = (e: Entry) => stats.find((s) => s.journey === e.journey && s.step === e.step);
  const started = (section: string) => stats.filter((s) => s.journey === section && (s.step === 'welcome' || s.step === 'first-practice')).reduce((n, s) => n + s.sent + s.queued + s.skipped, 0);

  return (
    <div className="pb-16">
      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold leading-[1.1]">Emails</h1>
          <p className="max-w-[60ch] text-sm text-ink-200">Every email Firstpass sends, in the order people get them. Read from the email templates in the code, so it’s always current.</p>
        </div>

        {SECTIONS.map((sec) => {
          const list = REGISTRY.filter((e) => e.section === sec.id);
          const n = started(sec.id);
          return (
            <section key={sec.id} aria-labelledby={`j-${sec.id}`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`j-${sec.id}`} className="font-body text-base font-semibold">
                  {sec.title}
                </h2>
                {(sec.id === 'waitlist' || sec.id === 'coach') && <span className="font-mono text-xs text-ink-200">{n} started · 30 days</span>}
              </div>
              <ol className="flex flex-wrap items-stretch gap-2">
                {list.map((e, i) => {
                  const on = e.id === selected?.id;
                  const conditional = e.sentBy === 'outbox' && e.condition !== 'Not unsubscribed' && e.step !== 'welcome';
                  const s = stat(e);
                  return (
                    <li key={e.id} className="flex items-center gap-2">
                      <Link
                        href={`/admin/emails?email=${encodeURIComponent(e.id)}`}
                        scroll={false}
                        aria-current={on ? 'true' : undefined}
                        className={`flex min-h-[84px] w-[176px] flex-col justify-center gap-0.5 rounded-xl px-3.5 py-2.5 text-left ${on ? 'border-2 border-rink-100 bg-surface-100' : conditional ? 'border-[1.5px] border-dashed border-border-200 hover:bg-surface-200' : e.audience === 'other' ? 'border border-border-100 bg-surface-200 hover:bg-surface-300' : 'border border-border-200 hover:bg-surface-200'}`}
                      >
                        <span className="text-xs text-ink-200">{e.when}</span>
                        <b className="text-sm font-semibold leading-5">{e.name}</b>
                        <span className="text-xs text-ink-200">{s ? `${s.sent} sent` : e.audience === 'other' ? e.to : e.from.startsWith('Brett') ? 'From Brett' : e.to}</span>
                      </Link>
                      {i < list.length - 1 && sec.id !== 'sign-in' && (
                        <span aria-hidden="true" className="h-0 w-3 border-t-[1.5px] border-dashed border-border-200" />
                      )}
                    </li>
                  );
                })}
              </ol>
              {sec.note && <p className="text-[13px] text-ink-200">{sec.note}</p>}
            </section>
          );
        })}
      </div>

      {selected && <Preview e={selected} stat={stat(selected)} to={admin.email} />}
    </div>
  );
}

function Preview({ e, stat, to }: { e: Entry; stat?: SendStats[number]; to: string }) {
  const email = e.preview();
  const sec = SECTIONS.find((s) => s.id === e.section)!;
  const siblings = REGISTRY.filter((x) => x.section === e.section);
  const sentBy = { outbox: 'The 10-minute timer, from the outbox', app: 'The app, when it happens', cron: 'The 10-minute timer', supabase: 'Supabase, from supabase/templates' }[e.sentBy];
  const at = siblings.indexOf(e);
  const step = (x: Entry | undefined, label: string) =>
    x && (
      <Link href={`/admin/emails?email=${encodeURIComponent(x.id)}`} scroll={false} replace className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium hover:bg-surface-200">
        {label}
      </Link>
    );
  return (
    <EmailDrawer
      id={e.id}
      title={e.name}
      kicker={`${sec.title} · ${at + 1} of ${siblings.length}`}
      footer={
        <>
          <TestSend key={e.id} id={e.id} to={to} />
          <span className="ml-auto flex items-center gap-1">
            {step(siblings[at - 1], '← Previous')}
            {step(siblings[at + 1], 'Next →')}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <a href={`/admin/emails/preview/${encodeURIComponent(e.id)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center self-start text-sm text-rink-100 hover:underline">
          Open full size
        </a>
      <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-ink-200">Sent</dt>
        <dd className="m-0">
          {e.trigger}
          {e.delay ? ` · ${e.delay}` : ''}
        </dd>
        <dt className="text-ink-200">To</dt>
        <dd className="m-0">{e.to}</dd>
        <dt className="text-ink-200">From</dt>
        <dd className="m-0">{e.from}</dd>
        <dt className="text-ink-200">Goes if</dt>
        <dd className="m-0">{e.condition}</dd>
        <dt className="text-ink-200">Sent by</dt>
        <dd className="m-0">{sentBy}</dd>
        {stat && (
          <>
            <dt className="text-ink-200">30 days</dt>
            <dd className="m-0">
              <span className="font-mono">{stat.sent}</span> sent · <span className="font-mono">{stat.skipped}</span> skipped · <span className="font-mono">{stat.queued}</span> waiting
            </dd>
          </>
        )}
        <dt className="text-ink-200">Template</dt>
        <dd className="m-0 break-all font-mono">
          {e.file.replace('src/lib/email/', '')} · {e.fn}
        </dd>
      </dl>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border-100 bg-surface-100">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border-100 px-4 py-3 text-[13px]">
          <span className="text-ink-200">Subject</span>
          <span className="font-semibold">{email.subject}</span>
        </div>
        {/* The email itself, sandboxed: no scripts, no navigation from inside it. Emails are always light. */}
        <iframe title={`${e.name}: the email`} srcDoc={email.html} sandbox="" className="h-[720px] w-full border-0 bg-[#F3F6F7]" />
      </div>
      </div>
    </EmailDrawer>
  );
}
