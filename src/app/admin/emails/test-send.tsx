'use client';

import { useState, useTransition } from 'react';
import { sendTest } from './actions';

export function TestSend({ id, to }: { id: string; to: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTest(id);
            setMsg(r.ok ? { ok: true, text: `Sent to ${to}.` } : { ok: false, text: r.error });
          })
        }
        className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-border-200 bg-surface-100 px-5 text-sm font-medium hover:bg-surface-300 disabled:opacity-[var(--opacity-disabled)]"
      >
        {pending ? 'Sending…' : 'Send me a test'}
      </button>
      {msg && (
        <span role={msg.ok ? 'status' : 'alert'} className={`text-[13px] ${msg.ok ? 'text-good-100' : 'text-flag-100'}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
