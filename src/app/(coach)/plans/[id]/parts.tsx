'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Rink } from '@/components/ds';
import { FOCUS_ATTRIBUTES, GROUPS, type Drill, type Group } from '@/lib/drills/schema';
import { usualCounts, type Attendance, type Team } from '@/lib/plans/schema';
import { shareWithParents, stopSharing } from '../actions';

// Small pieces of the plan builder: icons, menus, steppers, the drill drawer, sharing and
// the "Who's here today" dialog.

export const input = 'rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';

const svg = (d: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {d}
  </svg>
);
export const Icon = {
  drill: (s?: number) => svg(<><rect x="3" y="6" width="18" height="12" rx="5" /><path d="M12 6v12" /></>, s),
  stations: (s?: number) => svg(<><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /></>, s),
  rotation: (s?: number) => svg(<><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></>, s),
  activity: (s?: number) => svg(<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />, s),
  print: (s?: number) => svg(<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>, s),
  share: (s?: number) => svg(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>, s),
  rinkside: (s?: number) => svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>, s),
  plus: (s?: number) => svg(<path d="M12 5v14M5 12h14" />, s),
  grip: (s?: number) => svg(<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>, s),
};

export const BLOCK_TYPES = [
  { kind: 'drill', label: 'Drill', help: 'One basic drill for the whole group. If it has levels, switch on the ones to run, in order.', icon: Icon.drill },
  { kind: 'stations', label: 'Stations', help: 'One stations drill: each group plays its own version at its own spot.', icon: Icon.stations },
  { kind: 'rotation', label: 'Rotation', help: 'One rotation drill: every group does every zone, moving on the whistle.', icon: Icon.rotation },
  { kind: 'activity', label: 'Activity', help: 'Water, huddle, free skate, small games. No drill.', icon: Icon.activity },
] as const;

export function Badge({ zone, dim }: { zone: string; dim?: boolean }) {
  return <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs text-surface-100 ${dim ? 'bg-ink-200/50' : 'bg-ink-100'}`}>{zone}</span>;
}

export function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border-100" role="group" aria-label={`Minutes (${label})`}>
      <button type="button" aria-label="One minute less" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        −
      </button>
      <span className="min-w-14 text-center font-mono text-sm">
        {value} <span className="text-ink-200">{label}</span>
      </span>
      <button type="button" aria-label="One minute more" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200 disabled:opacity-30">
        +
      </button>
    </div>
  );
}

/** Close a popover on Escape or a click outside it. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const click = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', click);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', click);
    };
  }, [open, close]);
  return ref;
}

export type MenuItem = { label: string; run?: () => void; disabled?: boolean; danger?: boolean; sub?: { label: string; run: () => void; current?: boolean }[]; note?: string };

export function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const ref = useDismiss(open, () => {
    setOpen(false);
    setSub(null);
  });
  const close = () => {
    setOpen(false);
    setSub(null);
  };
  const subItem = items.find((i) => i.label === sub);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-surface-200">
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-border-100 bg-surface-100 py-1 shadow-lg">
          {subItem ? (
            <>
              <button type="button" onClick={() => setSub(null)} className="w-full px-3 py-2 text-left text-sm text-ink-200 hover:bg-surface-200">
                ‹ {subItem.label}
              </button>
              {subItem.note && <p className="px-3 pb-1 text-xs text-ink-200">{subItem.note}</p>}
              {subItem.sub!.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={s.current}
                  onClick={() => {
                    s.run();
                    close();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-200 disabled:text-ink-200"
                >
                  <span className="w-3.5 text-good-100">{s.current ? '✓' : ''}</span>
                  {s.label}
                </button>
              ))}
            </>
          ) : (
            items.map((it) => (
              <button
                key={it.label}
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  if (it.sub) setSub(it.label);
                  else {
                    it.run?.();
                    close();
                  }
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-200 disabled:opacity-40 ${it.danger ? 'text-flag-100' : ''}`}
              >
                {it.label}
                {it.sub && <span aria-hidden="true">›</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PanelSec({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t-2 border-ink-100 pt-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {right && <span className="font-mono text-xs text-ink-200">{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** Each block kind lists only its own kind of drill (decision 0006). */
export type DrawerFilter = 'basic' | 'stations' | 'rotation';

export function LibraryDrawer({
  drills,
  known,
  inPlan,
  title,
  filter,
  onPick,
  onClose,
}: {
  drills: Drill[];
  known: Set<string>;
  inPlan: Set<string>;
  title: string;
  filter: DrawerFilter;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const list = drills
    .filter((d) => d.groupModel === filter)
    .filter((d) => !focus || d.focus.some((f) => f.attribute === focus && f.level === 2))
    .filter((d) => !q || `${d.funName} ${d.plainName}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(inPlan.has(a.id)) - Number(inPlan.has(b.id)) || Number(!known.has(a.id)) - Number(!known.has(b.id)) || a.funName.localeCompare(b.funName));
  const hint =
    filter === 'stations'
      ? 'Each group plays its own version at its own spot, all at once.'
      : filter === 'rotation'
        ? 'Zones and activities ready to go. Everyone does every zone.'
        : 'Drills the whole group does together. Some have levels you can run one after another.';
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto bg-surface-100 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-9 rounded-full px-3 text-sm hover:bg-surface-200">
            Close
          </button>
        </div>
        <input autoFocus placeholder="Search drills" className={input} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {[null, ...FOCUS_ATTRIBUTES].map((a) => (
            <button key={a ?? 'all'} type="button" aria-pressed={focus === a} onClick={() => setFocus(a)} className={`min-h-8 whitespace-nowrap rounded-full px-3 text-xs ${focus === a ? 'bg-ink-100 text-surface-100' : 'border border-border-100'}`}>
              {a ?? 'All'}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-200">Known to the kids first. {hint}</p>
        <ul className="flex flex-col gap-2">
          {list.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => onPick(d.id)} className={`grid w-full grid-cols-[110px_minmax(0,1fr)] items-start gap-3 rounded-md border border-border-100 p-2 text-left hover:border-ink-200 ${inPlan.has(d.id) ? 'opacity-50' : ''}`}>
                <Rink spec={d.diagram} title={d.funName} detail="thumb" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-display">{d.funName}</b>
                    {!known.has(d.id) && <span className="rounded-full border border-whistle-100 px-1.5 text-[11px] font-semibold text-whistle-100">New</span>}
                  </span>
                  <span className="text-xs text-ink-200">
                    {d.plainName} · {d.minutes} min{d.groupModel === 'rotation' ? ' a zone' : ''}{d.groupModel === 'basic' && d.levels.length ? ` · ${d.levels.length + 1} levels` : d.groupModel === 'rotation' ? ` · ${d.zones?.length ?? 0} zones` : ''}
                  </span>
                  <span className="text-xs">{d.focus.filter((f) => f.level === 2).map((f) => f.attribute).join(' · ')}</span>
                  {inPlan.has(d.id) && <span className="text-xs text-ink-200">Already in this plan</span>}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="text-sm text-ink-200">{filter === 'rotation' ? 'No rotations in the library yet. Admins add them in drill review.' : 'No drills match.'}</li>}
        </ul>
      </div>
    </div>
  );
}

export function ShareControl({ practiceId, initial, compact }: { practiceId: string; initial: { token: string; expiresAt: string } | null; compact?: boolean }) {
  const [share, setShare] = useState(initial);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const ref = useDismiss(open, () => setOpen(false));
  const url = share ? `${typeof window === 'undefined' ? '' : window.location.origin}/p/${share.token}` : '';
  const toggle = () => {
    setOpen((o) => !o);
    if (!share)
      start(async () => {
        const r = await shareWithParents(practiceId);
        if (r.ok) setShare({ token: r.token, expiresAt: r.expiresAt });
      });
  };
  return (
    <div ref={ref} className="relative">
      {compact ? (
        <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full flex-col items-center gap-0.5 text-[11px]">
          {Icon.share(20)}
          Share
        </button>
      ) : (
        <button type="button" aria-expanded={open} aria-label="Share" title="Share with parents" onClick={toggle} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border-100 px-3.5 text-sm font-medium hover:bg-surface-200">
          {Icon.share(16)} <span className="hidden lg:inline">Share</span>
        </button>
      )}
      {open && (
        <div className={`absolute z-40 flex w-[min(92vw,380px)] flex-col gap-2 rounded-md border border-border-100 bg-surface-100 p-3 text-left shadow-lg ${compact ? 'bottom-full right-[-60px] mb-3' : 'right-0 mt-2'}`}>
          <b className="text-sm">Share with parents</b>
          {pending || !share ? (
            <p className="text-sm text-ink-200">Making a link…</p>
          ) : (
            <>
              <p className="text-sm">Anyone with this link sees the plan: no sign-in, no names. It stops working on {new Date(share.expiresAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}.</p>
              <input readOnly aria-label="Parent link" value={url} onFocus={(e) => e.currentTarget.select()} className={`${input} w-full font-mono text-xs`} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="min-h-9 rounded-full bg-rink-100 px-3 text-sm font-medium text-surface-100"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await stopSharing(practiceId);
                      setShare(null);
                      setOpen(false);
                    })
                  }
                  className="min-h-9 rounded-full px-3 text-sm text-flag-100 hover:bg-surface-200"
                >
                  Turn off link
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "Who's here today": counts per group and merges, for this practice only. */
export function AttendanceDialog({
  team,
  value,
  preview,
  onApply,
  onClose,
}: {
  team: Team;
  value: Attendance | null;
  preview: (a: Attendance) => string[];
  onApply: (a: Attendance | null) => void;
  onClose: () => void;
}) {
  const usual = usualCounts(team);
  const [a, setA] = useState<Attendance>(value ?? { counts: usual, merges: [] });
  const merged = (x: Group, y: Group) => a.merges.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  const toggle = (x: Group, y: Group) => setA((s) => ({ ...s, merges: merged(x, y) ? s.merges.filter(([p, q]) => !((p === x && q === y) || (p === y && q === x))) : [...s.merges, [x, y]] }));
  const changes = preview(a);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="att-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <div className="relative flex w-full max-w-[440px] flex-col gap-4 rounded-t-[18px] bg-surface-100 p-4 shadow-xl sm:rounded-[14px]">
        <div className="flex flex-col gap-0.5">
          <h2 id="att-title" className="text-[17px] font-extrabold">
            Who&apos;s here today
          </h2>
          <p className="text-sm text-ink-200">Only this practice. Your team&apos;s usual groups don&apos;t change.</p>
        </div>
        <div className="flex flex-col gap-2">
          {GROUPS.map((g) => (
            <div key={g} className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <b>{g}</b>
              <span className="text-xs text-ink-200">usually {usual[g]}</span>
              <Stepper value={a.counts[g]} min={0} max={20} label="" onChange={(n) => setA((s) => ({ ...s, counts: { ...s.counts, [g]: n } }))} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {(
            [
              ['Sharks', 'Bears'],
              ['Bears', 'Eagles'],
            ] as const
          ).map(([x, y]) => (
            <label key={x + y} className="flex cursor-pointer items-center gap-3 rounded-md bg-surface-200 px-3 py-2.5 text-sm">
              <input type="checkbox" role="switch" checked={merged(x, y)} onChange={() => toggle(x, y)} className="h-5 w-5 accent-[var(--rink-100)]" />
              <span>
                <b>
                  Merge {x} and {y} today
                </b>
                <br />
                <span className="text-xs text-ink-200">One group of {a.counts[x] + a.counts[y]}, at the easier group&apos;s level.</span>
              </span>
            </label>
          ))}
        </div>
        {changes.length > 0 && (
          <div className="text-[13px] leading-5">
            <b>What changes: </b>
            {changes.join(' ')}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {value && (
            <button type="button" onClick={() => onApply(null)} className="mr-auto min-h-10 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200">
              Back to usual
            </button>
          )}
          <button type="button" onClick={onClose} className="min-h-10 rounded-full border border-border-100 px-4 text-sm hover:bg-surface-200">
            Cancel
          </button>
          <button type="button" onClick={() => onApply(a)} className="min-h-10 rounded-full bg-rink-100 px-4 text-sm font-medium text-surface-100">
            Apply to today
          </button>
        </div>
      </div>
    </div>
  );
}
