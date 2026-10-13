import Link from 'next/link';
import { getDrillStore } from '@/lib/drills/store';
import { STATUSES, STATUS_LABEL, type Status } from '@/lib/drills/schema';
import { DiagramFlag, GROUP_MODEL_LABEL, StatusPill } from '@/components/status';
import { Rink } from '@/components/ds';

export const dynamic = 'force-dynamic';

// The review queue: drills that need a person first, then the rest by status.
export default async function DrillQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as Status) ? (status as Status) : null;
  const all = await (await getDrillStore()).list();
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((d) => d.status === s).length])) as Record<Status, number>;
  const waitingOnClaude = all.filter((d) => d.openRequests > 0).length;

  const order: Record<Status, number> = { in_review: 0, draft: 1, approved: 2, live: 3 };
  const shown = all
    .filter((d) => !filter || d.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || a.openRequests - b.openRequests || a.funName.localeCompare(b.funName));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-8">Drill review</h1>
          <p className="text-sm text-ink-200">
            One drill at a time. Approved drills go live to coaches when you say so.
            {waitingOnClaude > 0 && ` ${waitingOnClaude} waiting on a diagram change.`}
          </p>
        </div>
      </div>

      <nav aria-label="Filter by status" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        <FilterTab href="/admin/drills" on={!filter} label="All" count={all.length} />
        {STATUSES.map((s) => (
          <FilterTab key={s} href={`/admin/drills?status=${s}`} on={filter === s} label={STATUS_LABEL[s]} count={counts[s]} />
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-100 p-8 text-center text-sm text-ink-200">
          No drills here. {filter ? 'Try another status.' : 'Add drill files to content/drills and run the seed script.'}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((d) => (
            <li key={d.id}>
              <Link
                href={`/admin/drills/${d.id}`}
                className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 rounded-md border border-border-100 p-3 hover:border-ink-200 sm:grid-cols-[160px_minmax(0,1fr)_auto]"
              >
                <Rink spec={d.diagram} title={d.funName} detail="thumb" className="rounded-sm" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-display text-lg font-bold leading-6">{d.funName}</span>
                  <span className="text-sm text-ink-200">
                    {d.plainName} · <span className="font-mono">{d.minutes} min</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5 pt-1 sm:hidden">
                    <StatusPill status={d.status} />
                    <DiagramFlag count={d.openRequests} />
                  </span>
                  <span className={`text-xs ${d.groupModel === 'versions' ? 'font-semibold text-whistle-100' : 'text-ink-200'}`}>{GROUP_MODEL_LABEL[d.groupModel]}</span>
                </div>
                <div className="hidden flex-col items-end gap-1.5 sm:flex">
                  <StatusPill status={d.status} />
                  <DiagramFlag count={d.openRequests} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterTab({ href, on, label, count }: { href: string; on: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm ${on ? 'bg-ink-100 text-surface-100' : 'text-ink-100 hover:bg-surface-200'}`}
    >
      {label}
      <span className="font-mono text-xs opacity-75">{count}</span>
    </Link>
  );
}
