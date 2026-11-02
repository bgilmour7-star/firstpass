'use client';

import { useState, useTransition } from 'react';
import { unsubscribe } from './actions';

export function Confirm({ token, label, coach }: { token: string; label: string; coach: boolean }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [pending, start] = useTransition();
  if (state === 'done')
    return (
      <p role="status" className="rounded-xl bg-surface-200 p-4 text-base font-semibold">
        {coach ? 'Done. Survey emails stopped. You’ll still get practice emails.' : 'Done. You won’t get another email from us.'}
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState((await unsubscribe(token)) ? 'done' : 'error'))}
        className="inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 px-6 font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]"
      >
        {pending ? 'One moment…' : label}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-sm text-flag-100">
          That didn’t work. Try again, or reply to the email and we’ll do it for you.
        </p>
      )}
    </div>
  );
}
