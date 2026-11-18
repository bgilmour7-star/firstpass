import type { Activity, Stats } from '@/lib/broadcasts/schema';

// What happened after an email (decision 0036): who came back from each firstpass.coach link, and what coaches who
// clicked and didn't click did in the 7 days after. Counts of coaches only.

const ROWS: { key: keyof Omit<Activity, 'coaches'>; label: string }[] = [
  { key: 'any', label: 'Did anything in Firstpass' },
  { key: 'viewed', label: 'Opened a practice' },
  { key: 'edited', label: 'Planned or edited a practice' },
  { key: 'checkedIn', label: 'Checked in after a practice' },
  { key: 'scored', label: 'Scored progress' },
];
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '–');

export function After({ stats, links }: { stats: Stats | null; links: { n: number; label: string }[] }) {
  if (!stats)
    return (
      <p role="status" className="rounded-xl border border-border-100 bg-surface-200 p-4 text-sm">
        To see who came back from this email, run <code className="font-mono">supabase/migrations/20261124000000_email_attribution.sql</code> in the Supabase SQL editor.
      </p>
    );
  const clicked = stats.groups.clicked;
  const not = stats.groups.notClicked;
  const by = new Map(stats.links.map((l) => [l.link, l.coaches]));
  const th = 'pb-2 text-left text-[13px] font-medium text-ink-200';
  const td = 'border-t border-border-100 py-2 text-[15px]';
  return (
    <section aria-labelledby="after-title" className="flex max-w-[720px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="after-title" className="text-lg font-semibold">
          After this email
        </h2>
        <p className="text-sm text-ink-200">
          <b className="font-mono font-semibold text-ink-100">{stats.clicked}</b> of {stats.sent} coaches opened Firstpass from a link in it ({pct(stats.clicked, stats.sent)}). Counted when they’re signed in, on any device they open the link on.
        </p>
      </div>
      {links.length > 0 ? (
        <table className="w-full">
          <caption className="sr-only">Coaches who came back from each link</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Link
              </th>
              <th scope="col" className={`${th} text-right`}>
                Coaches
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.n}>
                <td className={td}>{l.label}</td>
                <td className={`${td} text-right font-mono`}>{by.get(l.n) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-200">This email had no firstpass.coach links, so there’s nothing to count.</p>
      )}
      <table className="w-full">
        <caption className="pb-2 text-left text-sm text-ink-200">In the 7 days after they clicked, or after it was sent for coaches who didn’t click</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              &nbsp;
            </th>
            <th scope="col" className={`${th} text-right`}>
              Clicked ({clicked?.coaches ?? 0})
            </th>
            <th scope="col" className={`${th} text-right`}>
              Didn’t click ({not?.coaches ?? 0})
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key}>
              <th scope="row" className={`${td} text-left font-normal`}>
                {r.label}
              </th>
              <td className={`${td} text-right font-mono`}>{clicked ? `${clicked[r.key]} · ${pct(clicked[r.key], clicked.coaches)}` : '–'}</td>
              <td className={`${td} text-right font-mono`}>{not ? `${not[r.key]} · ${pct(not[r.key], not.coaches)}` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
