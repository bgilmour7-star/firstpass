import { requireAnalytics } from '@/lib/auth';
import { getSiteStore } from '@/lib/site/store';
import { vanDay } from '@/lib/site/summary';
import type { WaitlistEntry } from '@/lib/site/schema';
import { StatusSelect } from './status-select';

export const dynamic = 'force-dynamic';

// Admin → Waitlist (decision 0019). Everyone who asked for early access, with Brett's status for
// each (New → Emailed → Call booked → Onboarded / Not a fit). Brett only: it holds personal emails.
// Its own tab since 2026-10-26; the numbers stay on Analytics.

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default async function WaitlistPage() {
  await requireAnalytics('/admin/waitlist');
  let list: WaitlistEntry[] = [];
  let missing = false;
  try {
    list = await (await getSiteStore()).waitlist();
  } catch (e) {
    if (e instanceof Error && e.message === 'waitlist-migration-missing') missing = true;
    else throw e;
  }
  return (
    <div className="flex flex-col gap-6 pb-16">
      {missing && (
        <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
          The waitlist tables aren’t set up yet. Run <code className="font-mono">supabase/migrations/20261026000000_waitlist_and_analytics.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}
      <Waitlist list={list} />
    </div>
  );
}

function Waitlist({ list }: { list: WaitlistEntry[] }) {
  const counts = (['new', 'emailed', 'call_booked', 'onboarded', 'not_a_fit'] as const).map((k) => [k, list.filter((w) => w.status === k).length] as const);
  const words = (k: string, n: number) => ({ new: 'new', emailed: 'emailed', call_booked: n === 1 ? 'call booked' : 'calls booked', onboarded: 'onboarded', not_a_fit: 'not a fit' })[k];
  const th = 'border-b border-border-100 pb-2 pr-3 font-medium';
  const td = 'border-b border-border-100 py-2.5 pr-3';
  return (
    <section aria-labelledby="wl-title" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="wl-title" className="text-[30px] font-bold leading-[1.1]">
          Waitlist <span className="font-mono text-lg font-normal text-ink-200">{list.length}</span>
        </h1>
        <span className="text-sm text-ink-200">
          {counts
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${words(k, n)}`)
            .join(' · ') || 'Nobody yet'}
        </span>
      </div>
      <p className="text-sm text-ink-200">Everyone who asked for early access on firstpass.coach, newest first. Onboarded lets that email create an account; everyone else is shown the invite-only message when they try to sign up.</p>
      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-ink-200">
                {['Joined', 'Email', 'Kind', 'Team or association', 'Age / teams', 'Source', 'Status'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td className={`${td} font-mono text-ink-200`}>{shortDay(vanDay(w.createdAt))}</td>
                  <td className={td}>
                    <a href={`mailto:${w.email}`} className="underline-offset-2 hover:underline">
                      {w.email}
                    </a>
                  </td>
                  <td className={`${td} ${w.kind === 'association' ? 'font-semibold' : ''}`}>{w.kind === 'association' ? 'Association' : 'Coach'}</td>
                  <td className={`${td} ${w.orgName ? '' : 'text-ink-200'}`}>{w.orgName ?? 'Not given'}</td>
                  <td className={td}>{w.kind === 'association' ? `${w.teamCount ?? '?'} teams` : (w.ageGroup ?? '–')}</td>
                  <td className={`${td} font-mono text-[13px]`}>{w.source ?? 'direct'}</td>
                  <td className="border-b border-border-100 py-1.5">
                    <StatusSelect id={w.id} email={w.email} status={w.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

