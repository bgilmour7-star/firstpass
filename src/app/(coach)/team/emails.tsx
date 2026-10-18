'use client';

import { useState, useTransition } from 'react';
import { setCheckinEmails } from './actions';

/** "Email me after practice": one email, 30 minutes after the ice time ends, linking to the check-in. */
export function EmailSettings({ initial, email }: { initial: boolean; email: string }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await setCheckinEmails(next);
      if (!r.ok) {
        setOn(!next);
        setError(r.error ?? 'Couldn’t save that.');
      } else setSaved(true);
    });
  };
  return (
    <section id="emails" className="flex scroll-mt-20 flex-col gap-3 border-t-2 border-ink-100 pt-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="emails-heading" className="text-[17px] font-extrabold">
            Email me after practice
          </h2>
          <p className="text-sm text-ink-200">
            One email to {email}, 30 minutes after the ice time ends, with a link to check in. About 20 seconds, and it shapes the next plan. Just for you: each coach on the team sets their own.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="emails-heading"
          disabled={pending}
          onClick={toggle}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-rink-100' : 'bg-ink-200'}`}
        >
          <span className={`absolute top-1 left-1 size-5 rounded-full bg-surface-100 shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      <p className="min-h-5 text-sm" aria-live="polite">
        {error ? <span className="text-flag-100">{error}</span> : saved ? <span className="text-ink-200">{on ? 'On. You’ll get one after each practice.' : 'Off. You can still check in from Today or Plans.'}</span> : null}
      </p>
    </section>
  );
}
