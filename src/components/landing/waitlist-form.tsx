'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { joinWaitlist, track } from '@/app/site-actions';
import { visitSource } from './visit-tracker';

// The waitlist form (decision 0019; canvas "Waitlist form · other states"). One form, two paths:
// coaches give an age group and, optionally, their team; associations give their name and how many
// U5–U9 teams. The button label never changes. The confirmation replaces the button, where the
// person is looking.

type Kind = 'coach' | 'association';
type Field = 'email' | 'orgName' | 'teamCount';

const input = 'min-h-12 w-full rounded-lg border border-border-200 bg-surface-100 px-3.5 text-base text-ink-100 placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25 aria-[invalid=true]:border-2 aria-[invalid=true]:border-flag-100';
const label = 'flex flex-col gap-1.5 text-sm font-medium';

export function WaitlistForm() {
  const [kind, setKind] = useState<Kind>('coach');
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const started = useRef(false);

  // "Run an association?" in the hero links to #join-association.
  useEffect(() => {
    const pick = () => {
      if (location.hash === '#join-association') setKind('association');
    };
    pick();
    window.addEventListener('hashchange', pick);
    return () => window.removeEventListener('hashchange', pick);
  }, []);

  const firstTouch = () => {
    if (started.current) return;
    started.current = true;
    void track('form_start', location.pathname, visitSource());
  };

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const get = (k: string) => (f.get(k) as string | null) ?? '';
    setError(null);
    start(async () => {
      const r = await joinWaitlist({ kind, email: get('email'), ageGroup: get('ageGroup'), orgName: get('orgName'), teamCount: get('teamCount'), website: get('website'), source: visitSource() ?? undefined });
      if (r.ok) setDone(true);
      else setError({ text: r.error, field: r.field });
    });
  }

  const err = (field: Field) => (error?.field === field ? { 'aria-invalid': true, 'aria-describedby': 'waitlist-error' } : {});

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onFocus={firstTouch}
      className="box-border flex min-w-0 max-w-[520px] flex-[1_1_380px] flex-col gap-5 rounded-2xl bg-surface-100 text-ink-100 shadow-[0_12px_32px_rgba(4,30,40,0.25)] p-[clamp(24px,3vw,36px)]"
    >
      <fieldset className="m-0 border-0 p-0" disabled={done}>
        <legend className="mb-2.5 p-0 text-sm font-semibold">I&apos;m joining as</legend>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-300 p-1">
          {(
            [
              ['coach', 'I coach a team'],
              ['association', 'I run an association'],
            ] as const
          ).map(([k, text]) => (
            <label key={k} className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-full px-2 text-center text-sm has-[:focus-visible]:shadow-[var(--focus-ring)] ${kind === k ? 'bg-surface-100 font-semibold shadow-[0_1px_2px_rgba(14,27,30,0.12)]' : 'text-ink-200'}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="absolute size-px opacity-0" />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={label}>
        Email
        <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className={input} disabled={done} {...err('email')} />
      </label>

      {kind === 'coach' ? (
        <>
          <label className={label}>
            Age group
            <select name="ageGroup" defaultValue="U7" className={input} disabled={done}>
              <option>U7</option>
              <option>U5</option>
              <option>U9</option>
            </select>
          </label>
          <label className={label}>
            <span>
              Team or association <span className="font-normal text-ink-200">(optional)</span>
            </span>
            <input name="orgName" maxLength={120} autoComplete="organization" placeholder="U7 Blue, Nanaimo Minor Hockey" className={input} disabled={done} />
          </label>
        </>
      ) : (
        <>
          <label className={label}>
            Association name
            <input name="orgName" maxLength={120} autoComplete="organization" placeholder="Nanaimo Minor Hockey" className={input} disabled={done} {...err('orgName')} />
          </label>
          <label className={label}>
            How many U5–U9 teams?
            <input name="teamCount" type="number" min={1} max={500} inputMode="numeric" placeholder="12" className={`${input} max-w-[140px]`} disabled={done} {...err('teamCount')} />
          </label>
        </>
      )}

      {/* Bots fill this in; people never see it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p id="waitlist-error" role="alert" className="-mt-1 flex items-start gap-1.5 text-[13px] text-flag-100">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 flex-none">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {error.text}
        </p>
      )}

      {done ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-border-100 bg-surface-100 px-4 py-3.5">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="mt-px flex-none">
            <circle cx="12" cy="12" r="11" fill="var(--good-100)" />
            <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--surface-100)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="flex flex-col gap-1">
            <strong className="font-semibold">You’re on the list.</strong>
            <span className="text-sm text-ink-200">{kind === 'association' ? 'Brett will email you to book a call about a pilot for your teams.' : 'Brett will email you to book a quick call about your team.'}</span>
          </span>
        </div>
      ) : (
        <button type="submit" disabled={pending} className="mt-1 min-h-[52px] rounded-full bg-rink-100 text-[17px] font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
          {pending ? 'Joining…' : 'Join the waitlist'}
        </button>
      )}
      <p className="text-center text-sm text-ink-200">
        Already a coach?{' '}
        <Link href="/login" className="font-medium text-rink-100 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
