import Link from 'next/link';
import { requireAnalytics } from '@/lib/auth';
import { displayName } from '@/lib/discovery/summary';
import { MigrationMissing, loadDiscovery, shortDay } from '../survey/load';

export const dynamic = 'force-dynamic';

// Admin → Coaches (decision 0027): everyone in discovery, waitlist and account alike, one row each.
// Brett only. Each opens their page with notes, answers and usage.

export default async function CoachesPage() {
  await requireAnalytics('/admin/coaches');
  const { people, responses, notes, usage, missing } = await loadDiscovery();
  const answered = new Set(responses.map((r) => r.personId));
  const noteCount = new Map<string, number>();
  for (const n of notes) noteCount.set(n.personId, (noteCount.get(n.personId) ?? 0) + 1);
  const use = new Map(usage.map((u) => [u.personId, u]));
  const th = 'border-b border-border-100 pb-2 pr-4 font-medium';
  const td = 'border-b border-border-100 py-3 pr-4';

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-bold leading-[1.1]">Coaches</h1>
        <p className="text-sm text-ink-200">
          Visible to Brett only · {people.length} {people.length === 1 ? 'person' : 'people'} from the waitlist and accounts
        </p>
      </div>
      {missing && <MigrationMissing />}
      {people.length === 0 ? (
        !missing && <p className="text-sm text-ink-200">Nobody yet. Waitlist sign-ups and new accounts appear here.</p>
      ) : (
        <>
          {/* Phones: one card per person. */}
          <ul className="flex flex-col md:hidden">
            {people.map((p) => {
              const u = use.get(p.id);
              return (
                <li key={p.id} className="border-t border-border-100">
                  <Link href={`/admin/coaches/${p.code}`} className="flex min-h-16 flex-col justify-center gap-0.5 py-3">
                    <span className="font-semibold text-rink-100">
                      {displayName(p)} <span className="font-mono text-xs font-normal text-ink-200">{p.code}</span>
                    </span>
                    <span className="text-[13px] text-ink-200">
                      {[p.audience === 'coach' ? (u?.teams[0]?.name ?? 'Account') : 'Waitlist', answered.has(p.id) ? 'Answered' : null, noteCount.get(p.id) ? `${noteCount.get(p.id)} notes` : null].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-200">
                  {['Name', 'Where', 'Team', 'Survey', 'Notes', 'Practices run', 'Last active', 'Since'].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const u = use.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td className={td}>
                        <Link href={`/admin/coaches/${p.code}`} className="font-medium text-rink-100 hover:underline">
                          {displayName(p)}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-ink-200">{p.code}</span>
                        {p.unsubscribedAt && <span className="ml-2 text-xs text-ink-200">unsubscribed</span>}
                      </td>
                      <td className={td}>{p.audience === 'coach' ? 'Using it' : 'Waitlist'}</td>
                      <td className={`${td} ${u?.teams.length ? '' : 'text-ink-200'}`}>{u?.teams.map((t) => t.name).join(', ') || '–'}</td>
                      <td className={td}>{answered.has(p.id) ? 'Answered' : <span className="text-ink-200">Not yet</span>}</td>
                      <td className={`${td} font-mono`}>{noteCount.get(p.id) ?? 0}</td>
                      <td className={`${td} font-mono`}>{u ? u.practicesRun : '–'}</td>
                      <td className={`${td} font-mono text-ink-200`}>{u?.lastActive ? shortDay(u.lastActive) : '–'}</td>
                      <td className={`${td} font-mono text-ink-200`}>{shortDay(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
