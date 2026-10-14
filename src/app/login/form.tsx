'use client';

import { useState } from 'react';
import { sendSignInLink } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setState('sending');
    const r = await sendSignInLink(email, next);
    if (r.ok) setState('sent');
    else {
      setErrorText(r.error);
      setState('error');
    }
  }

  if (!configured) return <p className="text-sm text-ink-200">Sign-in needs Supabase. In local mode, go straight to /admin/drills.</p>;
  if (state === 'sent') return <p className="text-sm">Check {email} for the sign-in link. It works once, on any device, for an hour.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-xs font-semibold text-ink-200">
        Email
      </label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-md border border-border-100 bg-surface-100 px-3 py-2.5" />
      <button type="submit" disabled={state === 'sending'} className="min-h-11 rounded-full bg-rink-100 text-sm font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-sm text-flag-100">
          {errorText}
        </p>
      )}
    </form>
  );
}
