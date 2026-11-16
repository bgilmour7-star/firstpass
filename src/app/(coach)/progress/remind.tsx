'use client';

import { useState, useTransition } from 'react';
import { sendProgressReminder } from './actions';

/** Head coach: email the coaches who haven't scored yet, now. Once a month; each coach gets one reminder at most. */
export function RemindButton({ roundId, waiting, sent }: { roundId: string; waiting: number; sent: boolean }) {
  const [done, setDone] = useState(sent);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="text-[13px] text-ink-200">Reminder sent. Each coach gets one at most this month.</p>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await sendProgressReminder(roundId);
            if (r.ok) setDone(true);
            else setError(r.error);
          })
        }
        className="min-h-11 rounded-full border border-border-200 px-4 text-sm font-medium hover:bg-surface-300 disabled:opacity-60"
      >
        {pending ? 'Sending…' : waiting === 1 ? 'Remind the coach who hasn’t scored' : `Remind the ${waiting} coaches who haven’t scored`}
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-warn-text">
          {error}
        </span>
      )}
    </span>
  );
}
