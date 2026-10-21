'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPractice } from './actions';

// "Add a practice" (decision 0017): for a schedule built by hand, with or without a calendar feed.
// The date and start are filled in with a guess (a week after the last plan, else the coming
// Saturday) and the coach adjusts them before adding. Calendar ice times keep their own "Plan it".
const field = 'min-h-11 w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';

export function AddPractice({ date, startTime, hint, copies }: { date: string; startTime: string; hint: string; copies: boolean }) {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-medium text-surface-100 hover:bg-rink-200">
        Add a practice
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add a practice">
          <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink-100/40" onClick={() => setOpen(false)} />
          <form action={createPractice} className="relative flex w-full flex-col gap-5 rounded-t-2xl bg-surface-100 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-2xl">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-extrabold">Add a practice</h2>
              <p className="text-sm text-ink-200">{copies ? 'It starts as a copy of your last plan.' : 'It comes ready to run: a warm-up, a rotation and a game. Change anything.'}</p>
            </div>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Date</span>
                <input ref={first} type="date" name="date" required defaultValue={date} className={field} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Start</span>
                <input type="time" name="time" required defaultValue={startTime} step={300} className={field} />
              </label>
            </div>
            <p className="-mt-3 text-xs text-ink-200">{hint}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-5 text-sm font-medium text-ink-200 hover:bg-surface-200">
                Cancel
              </button>
              <Submit />
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
      {pending ? 'Adding…' : 'Add practice'}
    </button>
  );
}
