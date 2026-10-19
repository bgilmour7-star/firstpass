'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePassword, skipPassword } from './actions';

const COPY = {
  offer: { title: 'You’re in. Sign in faster next time?', lead: 'Add a password and you won’t need an email to sign in on a new phone or the rink’s laptop.' },
  set: { title: 'Set a password', lead: 'Then you can sign in without waiting for an email.' },
  change: { title: 'Change your password', lead: 'You’ll stay signed in here.' },
} as const;

export function PasswordForm({ mode, email, next }: { mode: keyof typeof COPY; email: string; next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const go = (to: string) => {
    router.replace(to);
    router.refresh();
  };

  return (
    <div className="flex flex-col">
      <h1 className="mt-14 font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-balance">{COPY[mode].title}</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-200">{COPY[mode].lead}</p>
      <form
        className="mt-6 flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          start(async () => {
            const r = await savePassword(password, next);
            if (!r.ok) return setError(r.error);
            setSaved(true);
            go(r.to);
          });
        }}
      >
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label htmlFor="pw" className="text-sm font-semibold">
          New password
        </label>
        <div className="relative">
          <input
            id="pw"
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            placeholder="8 or more characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[52px] w-full rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-4 pr-20 text-[17px] placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25"
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 h-11 px-3 text-sm font-medium text-rink-100">
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-flag-100">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="mt-3 inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
          {saved ? 'Saved' : pending ? 'Saving…' : 'Save password'}
        </button>
        {mode === 'offer' ? (
          <button type="button" disabled={pending} onClick={() => start(async () => go((await skipPassword(next)).to))} className="h-12 text-[15px] font-medium">
            Not now
          </button>
        ) : (
          <button type="button" onClick={() => go(next)} className="h-12 text-[15px] font-medium">
            Cancel
          </button>
        )}
      </form>
      {mode === 'offer' && <p className="mt-2 text-center text-xs text-ink-200">We ask once. You can add one later from your account menu.</p>}
    </div>
  );
}
