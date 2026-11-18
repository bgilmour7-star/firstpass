'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { carryOn } from '../actions';

/** A send that stopped halfway (time limit, Resend rate limit): send to whoever is still queued. */
export function CarryOn({ id, left }: { id: string; left: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-200 p-4">
      <p className="text-[15px]">Sending stopped with {left} {left === 1 ? 'coach' : 'coaches'} still to go. Nobody gets it twice.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await carryOn(id);
            setMsg(r.ok ? (r.warning ?? '') : r.error);
            router.refresh();
          })
        }
        className="inline-flex min-h-11 items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]"
      >
        {pending ? 'Sending…' : 'Carry on sending'}
      </button>
      {msg && (
        <p role="alert" className="w-full text-sm text-flag-100">
          {msg}
        </p>
      )}
    </div>
  );
}
