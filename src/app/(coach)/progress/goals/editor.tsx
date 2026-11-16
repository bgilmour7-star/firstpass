'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Attribute } from '@/lib/progress/levels';
import { average, moveOne, round1, type Counts } from '@/lib/progress/report';
import { goalWords } from '@/lib/progress/pace';
import { removeGoal, saveGoal } from '../actions';

// Season goals (decision 0030, P4): the head coach builds a target spread from where the team is now.
// Now and Goal side by side for each level; "One up" moves a kid in the goal column up a level, so the
// total never changes. The goal score is worked out from the spread, never typed.

type Existing = { id: string; attribute: Attribute; target: Counts; byDate: string };

export function GoalEditor({
  attributes,
  levels,
  now,
  existing,
  defaultDate,
  start,
}: {
  attributes: readonly Attribute[];
  levels: Record<Attribute, readonly string[]>;
  /** The latest report's spread per skill, in whole kids. */
  now: Record<Attribute, Counts>;
  existing: Existing[];
  defaultDate: string;
  /** Open on this skill. */
  start: Attribute | null;
}) {
  const router = useRouter();
  const first = start ?? existing[0]?.attribute ?? attributes[0];
  const [attr, setAttr] = useState<Attribute>(first);
  const ex = (a: Attribute) => existing.find((g) => g.attribute === a);
  const [goal, setGoal] = useState<Counts>(() => ex(first)?.target ?? now[first]);
  const [date, setDate] = useState(() => ex(first)?.byDate ?? defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  const pick = (a: Attribute) => {
    setAttr(a);
    setGoal(ex(a)?.target ?? now[a]);
    setDate(ex(a)?.byDate ?? defaultDate);
    setError(null);
  };
  const cur = now[attr];
  const nowScore = average(cur);
  const goalScore = average(goal);
  const changed = goal.some((n, i) => n !== cur[i]);

  const save = () =>
    startT(async () => {
      setError(null);
      const r = await saveGoal({ attribute: attr, target: goal, byDate: date });
      if (!r.ok) return setError(r.error);
      router.push('/progress#goals');
    });
  const remove = (id: string) =>
    startT(async () => {
      const r = await removeGoal(id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Skill" className="flex flex-wrap gap-1.5">
        {attributes.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={a === attr}
            onClick={() => pick(a)}
            className={`min-h-11 rounded-full px-4 text-sm ${a === attr ? 'bg-ink-100 text-surface-100' : 'border border-border-100 hover:bg-surface-300'}`}
          >
            {a}
            {ex(a) && <span className={`ml-1.5 text-xs ${a === attr ? 'text-surface-100' : 'text-rink-100'}`}>· goal</span>}
          </button>
        ))}
      </div>

        <>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_44px_88px] items-end gap-x-3 border-b border-border-100 pb-2 text-xs text-ink-200">
            <span />
            <span>Level</span>
            <span className="text-right">Now</span>
            <span className="text-right">Goal</span>
          </div>
          <ol className="-mt-3 flex flex-col" aria-label={`${attr} goal, highest level first`}>
            {[5, 4, 3, 2, 1].map((lv) => (
              <li key={lv} className="grid grid-cols-[28px_minmax(0,1fr)_44px_88px] items-center gap-x-3 border-b border-border-100 py-2">
                <span className="font-display text-xl font-bold text-rink-200">{lv}</span>
                <span className="text-sm leading-5">{levels[attr][lv - 1]}</span>
                <span className="text-right font-mono text-base text-ink-200">{cur[lv - 1]}</span>
                <span className="flex items-center justify-end gap-1.5">
                  {lv > 1 && goal[lv - 2] > 0 ? (
                    <button type="button" onClick={() => setGoal((g) => moveOne(g, lv - 1, 1))} aria-label={`Goal: one more kid at level ${lv}`} className="grid size-11 place-items-center rounded-full border border-border-200 hover:bg-surface-300">
                      <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 11V3M3.5 6.5 7 3l3.5 3.5" />
                      </svg>
                    </button>
                  ) : (
                    <span className="size-11" />
                  )}
                  <b className="w-6 text-right font-mono text-[22px] font-medium text-rink-100">{goal[lv - 1]}</b>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-1">
            <p className="text-[15px]">
              <b className="font-semibold">{changed ? goalWords(goal) : 'Tap ↑ to move kids up a level in the goal.'}</b>
            </p>
            <p className="font-mono text-xs text-ink-200">
              Now {nowScore == null ? '–' : round1(nowScore).toFixed(1)} · goal {goalScore == null ? '–' : round1(goalScore).toFixed(1)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setGoal(cur)} disabled={!changed} className="min-h-11 text-sm text-rink-100 disabled:text-ink-200">
                Start from now
              </button>
              {goal.some((n, i) => n > 0 && i > 0) && (
                <button type="button" onClick={() => setGoal((g) => moveOne(g, g.findLastIndex((n, i) => n > 0 && i > 0) + 1, -1))} className="min-h-11 text-sm text-ink-200">
                  One kid back down
                </button>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">By</span>
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="min-h-11 w-fit rounded-[10px] border border-border-200 bg-surface-100 px-3" />
          </label>

          {error && (
            <p role="alert" className="text-sm text-warn-text">
              {error}
            </p>
          )}
          <button type="button" onClick={save} disabled={pending || !changed} className="min-h-12 self-start rounded-full bg-rink-100 px-6 text-base font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-50">
            {pending ? 'Saving…' : ex(attr) ? `Change the ${attr.toLowerCase()} goal` : `Set the ${attr.toLowerCase()} goal`}
          </button>
        </>

      {existing.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border-100 pt-4">
          <h2 className="font-display text-base font-bold">Goals now ({existing.length} of {attributes.length})</h2>
          <ul className="flex flex-col">
            {existing.map((g) => (
              <li key={g.id} className="flex min-h-11 items-center gap-3 border-b border-border-100 py-1 text-sm last:border-b-0">
                <b className="font-semibold">{g.attribute}</b>
                <span className="font-mono text-xs text-ink-200">
                  {round1(average(g.target) ?? 0).toFixed(1)} by {new Date(`${g.byDate}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </span>
                <button type="button" onClick={() => remove(g.id)} disabled={pending} className="ml-auto min-h-11 px-2 text-sm text-ink-200 hover:text-ink-100">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
