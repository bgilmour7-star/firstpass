// A practice plan on an answer page (decision 0038): start times worked out from each block's minutes, so a
// change to a drill's minutes in the library (pulled into content/drills) moves the times with it.

export type PlanRow = { minutes: number; what: string; who: string; tag?: string };

const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/** Start times for each row, from 0:00. */
export function withTimes(rows: PlanRow[]) {
  let t = 0;
  return rows.map((r) => {
    const at = clock(t);
    t += r.minutes;
    return { ...r, at };
  });
}

export const totalOf = (rows: PlanRow[]) => rows.reduce((n, r) => n + r.minutes, 0);

export function PlanTable({ rows }: { rows: PlanRow[] }) {
  return (
    <ol className="mt-5 flex flex-col divide-y divide-border-100 rounded-2xl border border-border-100">
      {withTimes(rows).map((b) => (
        <li key={b.at} className="grid grid-cols-[52px_1fr] gap-x-3 px-4 py-3 sm:grid-cols-[60px_1fr_auto]">
          <span className="font-mono text-[15px] text-ink-200">{b.at}</span>
          <span className="text-[16px] leading-snug">
            {b.what}
            {b.tag && <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-whistle-100/15 px-2 py-0.5 align-middle text-[12px] font-semibold uppercase tracking-wide text-ink-100">{b.tag}</span>}
          </span>
          <span className="col-start-2 text-[13px] text-ink-200 sm:col-start-3 sm:text-right">{b.who}</span>
        </li>
      ))}
    </ol>
  );
}
