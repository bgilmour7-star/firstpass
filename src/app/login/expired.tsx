'use client';

import { useState, useTransition } from 'react';
import { AuthFlow } from '@/components/auth-flow';
import { sendLink } from './actions';

// "That link has expired" (decision 0013): no error codes, one tap to a fresh link.
export function Expired({ email, next }: { email: string; next: string }) {
  const [mode, setMode] = useState<'expired' | 'sent' | 'other'>('expired');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const join = next.match(/^\/join\/([A-Za-z0-9]{8,64})$/)?.[1];

  if (mode !== 'expired') return <AuthFlow next={next} initialEmail={email} initialStep={mode === 'sent' ? 'code' : 'email'} join={join ? { code: join, teamName: 'the team' } : undefined} />;
  return (
    <div className="flex flex-1 flex-col">
      <svg width="180" height="96" viewBox="0 0 180 96" aria-hidden="true" className="mt-12">
        <path d="M6 90 V40 A34 34 0 0 1 40 6 H174" fill="none" className="stroke-ink-200" strokeWidth="2.5" />
        <path d="M30 90 V30" stroke="var(--rink-line-red)" strokeWidth="2" />
        <path d="M60 64 L66 52 L72 64 Z" className="fill-whistle-100" />
        <path d="M84 56 L136 38" className="stroke-ink-100" strokeWidth="2.2" strokeDasharray="6 5" fill="none" />
        <circle cx="150" cy="34" r="10" fill="none" className="stroke-rink-100" strokeWidth="2.5" />
      </svg>
      <h1 className="mt-6 font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.02em]">That link has expired</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-200">
        Sign-in links work once, for an hour.{' '}
        {email ? (
          <>
            We can send a fresh one to <b className="font-semibold text-ink-100">{email}</b>.
          </>
        ) : (
          'We can send you a fresh one.'
        )}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-flag-100">
          {error}
        </p>
      )}
      {email ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendLink({ email, next, joinCode: join });
              if (r.ok) setMode('sent');
              else setError(r.error);
            })
          }
          className="mt-7 inline-flex h-[52px] items-center justify-center rounded-full bg-rink-100 font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]"
        >
          {pending ? 'Sending…' : 'Send a new link'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setMode('other')}
        className={`${email ? 'mt-2.5' : 'mt-7'} inline-flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-border-200 text-[15px] font-medium hover:bg-surface-200`}
      >
        {email ? 'Sign in another way' : 'Sign in'}
      </button>
      <p className="mt-auto pt-8 text-[13px] leading-[19px] text-ink-200">Already signed in on another device? You&apos;re fine there. This only affects this browser.</p>
    </div>
  );
}
