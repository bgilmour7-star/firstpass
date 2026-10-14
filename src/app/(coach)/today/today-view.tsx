'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Rink } from '@/components/ds';
import type { Drill } from '@/lib/drills/schema';
import { addMinutes, blockMinutes, clock, rotation, type Block, type Practice, type Team } from '@/lib/plans/schema';

// The practice timeline on a phone at the rink: done blocks greyed, the current block open with a
// countdown (and who is where for stations), upcoming blocks below.

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function TodayView({ practice, team, drills, isToday }: { practice: Practice; team: Team; drills: Drill[]; isToday: boolean }) {
  const byId = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  const key = `firstpass.offset.${practice.id}`;
  const [now, setNow] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0); // minutes the practice started late
  useEffect(() => {
    try {
      setOffset(Number(localStorage.getItem(key)) || 0);
    } catch {}
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [key]);
  const saveOffset = (m: number) => {
    setOffset(m);
    try {
      localStorage.setItem(key, String(m));
    } catch {}
  };

  const groups = team.groups.map((g) => g.group);
  const start = toMin(practice.startTime) + offset;
  let acc = 0;
  const spans = practice.blocks.map((b) => {
    const s = start + acc;
    acc += blockMinutes(b);
    return { b, s, e: start + acc };
  });
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : -1;
  const live = isToday && now !== null;
  const current = live ? spans.findIndex((x) => nowMin >= x.s && nowMin < x.e) : -1;
  const before = live && nowMin < start;
  const after = live && spans.length > 0 && nowMin >= spans[spans.length - 1].e;
  const fmt = (min: number) => clock(addMinutes('00:00', Math.round(min)));
  const left = (end: number) => {
    const secs = Math.max(0, Math.round((end - nowMin) * 60));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-8">{isToday ? 'Today' : new Date(practice.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
        <p className="text-sm text-ink-200">
          {fmt(start)}–{fmt(start + acc)} · {practice.ice === 'half' ? 'Half ice' : 'Full ice'}
          {offset !== 0 && ` · started ${offset} min late`}
        </p>
        {isToday && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => now && saveOffset(Math.round(now.getHours() * 60 + now.getMinutes() - toMin(practice.startTime)))}
              className="min-h-9 rounded-full border border-border-100 px-3 text-sm hover:bg-surface-200"
            >
              Start the clock now
            </button>
            {offset !== 0 && (
              <button type="button" onClick={() => saveOffset(0)} className="min-h-9 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200">
                Back to {clock(practice.startTime)}
              </button>
            )}
          </div>
        )}
        {before && <p className="pt-1 font-display text-lg font-bold">Starts in {left(start)}</p>}
        {after && (
          <p className="pt-1 text-[15px]">
            <b>That&apos;s practice.</b> How did it go? Check-in is coming soon.
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {spans.map(({ b, s, e }, i) => {
          const done = live && nowMin >= e;
          const isNow = i === current || (before && i === 0) || (!live && i === 0);
          return (
            <li
              key={b.id}
              aria-current={i === current ? 'step' : undefined}
              className={`rounded-md border p-3 ${i === current ? 'border-2 border-rink-100' : 'border-border-100'} ${done ? 'opacity-50' : ''}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="w-12 font-mono text-sm">{fmt(s)}</span>
                <span className="min-w-0 flex-1 font-display text-lg font-bold">{title(b, byId)}</span>
                {done && <span className="text-xs font-semibold text-ink-200">Done</span>}
                {i === current && (
                  <span className="rounded-full bg-rink-100 px-2 py-0.5 font-mono text-xs text-surface-100">
                    {b.kind === 'stations' && nowMin < e - b.minutes ? `Whistle in ${left(s + b.minutes * (Math.floor((nowMin - s) / b.minutes) + 1))}` : `Now · ${left(e)}`}
                  </span>
                )}
                {!done && i !== current && <span className="font-mono text-xs text-ink-200">{blockMinutes(b)} min</span>}
              </div>
              {isNow && <Detail block={b} byId={byId} groups={groups} startMin={s} nowMin={live ? nowMin : s} fmt={fmt} />}
            </li>
          );
        })}
      </ol>
      <Link href={`/plans/${practice.id}`} className="w-fit text-sm text-ink-200 hover:text-ink-100">
        Edit this plan
      </Link>
    </div>
  );
}

function title(b: Block, byId: Map<string, Drill>) {
  if (b.kind === 'activity') return b.title;
  if (b.kind === 'drill') return byId.get(b.drillId)?.funName ?? 'Drill';
  return 'Stations';
}

function Detail({ block, byId, groups, startMin, nowMin, fmt }: { block: Block; byId: Map<string, Drill>; groups: string[]; startMin: number; nowMin: number; fmt: (m: number) => string }) {
  if (block.kind === 'activity') return block.note ? <p className="pt-2 text-[15px]">{block.note}</p> : null;
  if (block.kind === 'drill') {
    const d = byId.get(block.drillId);
    if (!d) return null;
    return (
      <div className="flex flex-col gap-2 pt-3">
        <Rink spec={d.diagram} title={d.funName} />
        <p className="text-[15px]">{d.steps.join(' ')}</p>
        {d.cues.map((c) => (
          <p key={c} className="font-display text-lg font-bold">
            “{c}”
          </p>
        ))}
      </div>
    );
  }
  const rot = rotation(groups, block.stations.length);
  const r = Math.min(rot.length - 1, Math.max(0, Math.floor((nowMin - startMin) / block.minutes)));
  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-sm text-ink-200">
        Rotation {r + 1} of {rot.length}
        {r + 1 < rot.length && ` · next whistle at ${fmt(startMin + block.minutes * (r + 1))}`}
      </p>
      <ul className="flex flex-col gap-3">
        {block.stations.map((s, i) => {
          const d = s.drillId ? byId.get(s.drillId) : undefined;
          return (
            <li key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-border-100 pt-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{s.station}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <b className="font-display text-base">{rot[r]?.[i] ?? ''}</b>
                  <span className="text-sm">{d?.funName ?? 'No drill'}</span>
                  {s.coach && <span className="text-xs text-ink-200">{s.coach}</span>}
                </span>
                {d && <Rink spec={d.diagram} title={d.funName} detail="thumb" className="max-w-[260px]" />}
                {d && <span className="text-sm font-semibold">“{d.cues[0]}”</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
