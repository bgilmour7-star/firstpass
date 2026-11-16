'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Attribute } from '@/lib/progress/levels';
import { average, moveOne, total, type Counts } from '@/lib/progress/report';
import { saveProgress } from '../actions';

// "Who moved up?" (decision 0030): one attribute at a time, starting from the coach's last spread.
// Moving a skater between levels keeps the total, so there's nothing to add up. "No change" moves on.

type Props = {
  roundId: string;
  month: string;
  previousMonth: string | null;
  attributes: readonly Attribute[];
  levels: Record<Attribute, readonly string[]>;
  initial: Record<Attribute, Counts>;
  before: Partial<Record<Attribute, Counts>>;
  done: Attribute[];
  noChange: Attribute[];
  seconds: number;
  skaters: number;
  first: boolean;
};

export function Scoring(p: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState(p.initial);
  const [done, setDone] = useState<Attribute[]>(p.done);
  const [noChange, setNoChange] = useState<Attribute[]>(p.noChange);
  const [step, setStep] = useState(() => Math.max(0, p.attributes.findIndex((a) => !p.done.includes(a))));
  const [moves, setMoves] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const since = useRef(Date.now());
  const secs = useRef(p.seconds);
  useEffect(() => {
    since.current = Date.now();
  }, [step]);

  const attr = p.attributes[step] ?? p.attributes[0];
  const c = answers[attr];
  const was = p.before[attr];
  const moved = (moves[attr] ?? 0) > 0;
  const last = step === p.attributes.length - 1;
  const avg = average(c);
  const wasAvg = was ? average(was) : null;
  const up = was ? c.reduce((a, n, i) => a + n * (i + 1), 0) - was.reduce((a, n, i) => a + n * (i + 1), 0) : 0;

  const move = (level: number, dir: 1 | -1) => {
    setAnswers((s) => ({ ...s, [attr]: moveOne(s[attr], level, dir) }));
    setMoves((m) => ({ ...m, [attr]: (m[attr] ?? 0) + 1 }));
  };
  const undo = () => {
    if (was) setAnswers((s) => ({ ...s, [attr]: was }));
    setMoves((m) => ({ ...m, [attr]: 0 }));
  };

  const next = () => {
    const nowSecs = secs.current + Math.round((Date.now() - since.current) / 1000);
    secs.current = nowSecs;
    const d = done.includes(attr) ? done : [...done, attr];
    const nc = moved || p.first ? noChange.filter((a) => a !== attr) : noChange.includes(attr) ? noChange : [...noChange, attr];
    const finish = d.length >= p.attributes.length;
    setError(null);
    start(async () => {
      const r = await saveProgress({ roundId: p.roundId, answers, done: d, noChange: nc, seconds: nowSecs, finish });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(d);
      setNoChange(nc);
      if (finish) router.push('/progress?scored=1');
      else setStep(p.attributes.findIndex((a) => !d.includes(a)));
    });
  };

  const levelsTopDown = [5, 4, 3, 2, 1];
  const question = p.first ? `Where are your ${p.skaters} skaters? Move them to the level they’re at most of the time.` : `Did anyone move up a level since ${p.previousMonth ?? 'last time'}?`;
  const primary = last ? 'Finish' : moved || p.first ? `Next: ${p.attributes[step + 1]}` : 'No change · next';

  return (
    <div className="mx-auto flex max-w-md flex-col">
      <div className="flex min-h-11 items-center gap-2 text-[13px] text-ink-200">
        <Link href="/progress" aria-label="Back to progress" className="-ml-3 grid h-11 w-11 place-items-center rounded-full hover:bg-surface-300">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </Link>
        <span>
          {p.month} progress scoring · {step + 1} of {p.attributes.length}
        </span>
        {!last && <span className="ml-auto">Next: {p.attributes[step + 1]}</span>}
      </div>

      <h1 className="mt-2 font-display text-[28px] font-bold leading-tight">{attr}</h1>
      <p className="mt-1 text-[15px]">{question}</p>
      <p className="mt-1 text-[13px] text-ink-200">{p.first ? 'Tap One up or ↓ to move one skater at a time.' : `Your ${total(c)} skaters, as you placed them in ${p.previousMonth ?? 'your last scoring'}.`}</p>

      <ol className="mt-4 flex flex-col" aria-label={`${attr} levels, highest first`}>
        {levelsTopDown.map((lv, i) => (
          <li key={lv}>
            <div className="grid grid-cols-[28px_minmax(0,1fr)_56px] items-center gap-3 py-2">
              <span className="font-display text-xl font-bold text-rink-200">{lv}</span>
              <span className="text-sm leading-5">{p.levels[attr][lv - 1]}</span>
              <span className="flex flex-col items-end">
                <b className="font-mono text-[22px] font-medium leading-6">{c[lv - 1]}</b>
                {was && was[lv - 1] !== c[lv - 1] && <span className="font-mono text-[11px] text-ink-200">was {was[lv - 1]}</span>}
              </span>
            </div>
            {i < levelsTopDown.length - 1 && (
              <div className="flex items-center gap-2 pl-10">
                <span className="h-px flex-1 bg-border-100" />
                {c[lv - 2] > 0 && (
                  <button type="button" onClick={() => move(lv - 1, 1)} aria-label={`Move one skater up from level ${lv - 1} to level ${lv}`} className="flex h-11 items-center gap-1 rounded-full border border-border-200 px-3 text-[13px] hover:bg-surface-300">
                    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 11V3M3.5 6.5 7 3l3.5 3.5" />
                    </svg>
                    One up
                  </button>
                )}
                {c[lv - 1] > 0 && (
                  <button type="button" onClick={() => move(lv, -1)} aria-label={`Move one skater down from level ${lv} to level ${lv - 1}`} className="grid h-11 w-11 place-items-center rounded-full border border-border-100 text-ink-200 hover:bg-surface-300">
                    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 3v8M3.5 7.5 7 11l3.5-3.5" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-2" aria-live="polite">
        <span className={`text-sm font-medium ${!moved || p.first ? 'text-ink-200' : up >= 0 ? 'text-good-text' : 'text-warn-text'}`}>
          {p.first ? `${total(c)} skaters placed` : !moved ? `Same as ${p.previousMonth ?? 'last time'}` : up > 0 ? `${up} ${up === 1 ? 'level' : 'levels'} up` : up < 0 ? `${-up} ${up === -1 ? 'level' : 'levels'} down` : 'Moves cancel out'}
        </span>
        {moved && was && (
          <button type="button" onClick={undo} className="min-h-11 px-2 text-sm text-rink-100">
            Undo
          </button>
        )}
      </div>
      <p className="font-mono text-xs text-ink-200">
        Your average {avg == null ? '–' : avg.toFixed(1)}
        {wasAvg != null && ` · ${p.previousMonth} ${wasAvg.toFixed(1)}`}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn-text">
          {error}
        </p>
      )}
      <button type="button" onClick={next} disabled={pending} className="mt-6 min-h-12 rounded-full bg-rink-100 px-5 text-base font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
        {pending ? 'Saving…' : primary}
      </button>
      <p className="mt-2 text-center text-xs text-ink-200">Saved after each skill</p>
    </div>
  );
}
