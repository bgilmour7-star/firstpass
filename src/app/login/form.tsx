'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setState('sending');
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (error) {
      // Supabase's built-in email sender allows only a few emails an hour.
      const limited = error.status === 429 || /rate limit/i.test(error.message);
      setErrorText(limited ? 'Too many sign-in emails in the last hour. Use the most recent link in your inbox, or try again in an hour.' : `Couldn't send the link: ${error.message}`);
      setState('error');
    } else setState('sent');
  }

  if (!configured) return <p className="text-sm text-ink-200">Sign-in needs Supabase. In local mode, go straight to /admin/drills.</p>;
  if (state === 'sent') return <p className="text-sm">Check {email} for the sign-in link. It works once, on this device.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-xs font-semibold text-ink-200">
        Email
      </label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-md border border-border-100 bg-surface-100 px-3 py-2.5" />
      <button type="submit" disabled={state === 'sending'} className="min-h-11 rounded-full bg-rink-100 text-sm font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state === 'error' && <p role="alert" className="text-sm text-flag-100">{errorText}</p>}
    </form>
  );
}
