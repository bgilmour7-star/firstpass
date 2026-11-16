// The team's progress as a picture (decision 0031, canvas "Progress on Team home · as a picture"): each
// skill on the 1–5 level scale, last round's dot to this round's, and for a goal skill the goal (flag),
// where the team should be by now (tick) and Ahead / Behind in words. Tokens only; a full sentence for
// screen readers. Two layouts: wide (label left, value right) and phone (name and value above the track).

import type { ProgressRow } from '@/lib/home/progress-view';

const STATUS = { ahead: 'Ahead', behind: 'Behind', 'on-pace': 'On pace', reached: 'Goal reached', short: 'Short of goal' } as const;
const statusColor = (s: string | null) => (s === 'behind' || s === 'short' ? 'var(--warn-text)' : s === 'ahead' || s === 'reached' ? 'var(--good-text)' : 'var(--ink-200)');
const byWhen = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const f1 = (n: number) => n.toFixed(1);

export function ProgressChart({ rows, label, span }: { rows: ProgressRow[]; label: string; /** "October → November" */ span: string }) {
  return (
    <figure className="m-0">
      <Legend goals={rows.some((r) => r.goal)} span={span} />
      <div className="hidden sm:block">
        <Chart rows={rows} label={label} W={736} phone={false} />
      </div>
      <div className="sm:hidden">
        <Chart rows={rows} label={label} W={358} phone />
      </div>
    </figure>
  );
}

function Chart({ rows, label, W, phone }: { rows: ProgressRow[]; label: string; W: number; phone: boolean }) {
  const lab = phone ? 0 : 130;
  const right = phone ? 8 : 215;
  const x0 = lab + 8;
  const x1 = W - right - 8;
  const X = (v: number) => x0 + ((Math.min(5, Math.max(1, v)) - 1) / 4) * (x1 - x0);
  let y = 34;
  const items = rows.map((r) => {
    const g = r.goal;
    // Only goals that are behind (or ended short) are shaded, so six goals don't shade every row (decision 0031).
    const shade = g?.status === 'behind' || g?.status === 'short';
    const rh = phone ? (g ? 76 : 56) : g ? 54 : 40;
    const top = y;
    const cy = y + (phone ? 34 : 16);
    y += rh;
    const moved = r.now != null && r.before != null && r.now !== r.before;
    const delta = moved ? r.now! - r.before! : 0;
    return { r, g, shade, rh, top, cy, moved, delta };
  });
  const H = y + 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full font-body" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((lv) => (
        <g key={lv}>
          <line x1={X(lv)} y1={22} x2={X(lv)} y2={H} stroke="var(--border-100)" strokeWidth={1} />
          <text x={X(lv)} y={14} textAnchor="middle" fontSize={11} fill="var(--ink-200)" className="font-mono">
            {lv}
          </text>
        </g>
      ))}
      {!phone && (
        <text x={x0 - 8} y={14} textAnchor="end" fontSize={11} fill="var(--ink-200)">
          Level
        </text>
      )}
      {items.map(({ r, g, shade, rh, top, cy, moved, delta }) => (
        <g key={r.attribute}>
          {shade && <rect x={phone ? 0 : x0 - 6} y={top - 6} width={phone ? W : x1 - x0 + 12} height={rh - 4} rx={8} fill="var(--surface-200)" />}
          <text x={phone ? (shade ? 8 : 0) : 0} y={phone ? top + 12 : cy + 5} fontSize={14} fontWeight={600} fill="var(--ink-100)">
            {r.attribute}
          </text>
          {r.now != null && (
            <text x={phone ? W - 8 : x1 + 24} y={phone ? top + 12 : cy + 5} textAnchor={phone ? 'end' : 'start'} fontSize={phone ? 14 : 15} fill="var(--ink-100)" className="font-mono">
              {f1(r.now)}
              {moved && (
                <tspan fill={delta > 0 ? 'var(--good-text)' : 'var(--warn-text)'} fontSize={phone ? 11 : 12}>
                  {' '}
                  {delta > 0 ? '+' : '−'}
                  {f1(Math.abs(delta))}
                </tspan>
              )}
            </text>
          )}
          {g && r.now != null && (
            <>
              <line x1={X(r.now)} y1={cy} x2={X(g.target)} y2={cy} stroke="var(--ink-200)" strokeWidth={1.5} strokeDasharray="3 4" />
              {g.expected != null && <line x1={X(g.expected)} y1={cy - 9} x2={X(g.expected)} y2={cy + 9} stroke="var(--ink-100)" strokeWidth={2} />}
              <path d={`M${X(g.target)} ${cy + 8} V${cy - 12} l9 4 -9 4`} fill="var(--surface-100)" stroke="var(--ink-100)" strokeWidth={1.4} strokeLinejoin="round" />
              <text x={phone ? 8 : x1 + 24} y={phone ? top + 60 : cy + 22} fontSize={12} fill={statusColor(g.status)}>
                {g.status ? STATUS[g.status] : 'Not scored yet'} · goal {f1(g.target)} by {byWhen(g.byDate)}
              </text>
            </>
          )}
          {moved && <line x1={X(r.before!)} y1={cy} x2={X(r.now!) + (delta > 0 ? -6 : 6)} y2={cy} stroke="var(--rink-100)" strokeWidth={3} strokeLinecap="round" />}
          {moved && <circle cx={X(r.before!)} cy={cy} r={5} fill="var(--surface-100)" stroke="var(--rink-100)" strokeWidth={2} />}
          {r.now != null && <circle cx={X(r.now)} cy={cy} r={7} fill="var(--rink-100)" />}
        </g>
      ))}
    </svg>
  );
}

function Legend({ goals, span }: { goals: boolean; span: string }) {
  return (
    <div aria-hidden="true" className="mb-3 flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-ink-200">
      <span className="inline-flex items-center gap-1.5">
        <svg width="34" height="14">
          <line x1="6" y1="7" x2="22" y2="7" stroke="var(--rink-100)" strokeWidth="3" />
          <circle cx="6" cy="7" r="4.5" fill="var(--surface-100)" stroke="var(--rink-100)" strokeWidth="2" />
          <circle cx="26" cy="7" r="6" fill="var(--rink-100)" />
        </svg>
        {span}
      </span>
      {goals && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="18">
              <line x1="6" y1="1" x2="6" y2="17" stroke="var(--ink-100)" strokeWidth="2" />
            </svg>
            Where the goal needs it now
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="18">
              <path d="M2 17 V1 l9 4 -9 4" fill="var(--surface-100)" stroke="var(--ink-100)" strokeWidth="1.4" />
            </svg>
            Season goal
          </span>
        </>
      )}
    </div>
  );
}
