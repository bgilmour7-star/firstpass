'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { joinWaitlist, track } from '@/app/site-actions';
import { visitSource } from './visit-tracker';

// The association form (decision 0033; was the waitlist form of decision 0019). Sign-up is open, so
// coaches start from "Plan your first practice"; associations leave their email, name and number of
// U5–U9 teams, and Brett gets in touch. Rows still land in the waitlist table (kind 'association'),
// which alerts hello@firstpass.coach. Once sent, the card becomes the confirmation: a pass from puck
// to teammate that turns into a check mark (WaitlistDone).

type Kind = 'coach' | 'association';
type Field = 'email' | 'orgName' | 'teamCount';

const input = 'min-h-12 w-full rounded-lg border border-border-200 bg-surface-100 px-3.5 text-base text-ink-100 placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25 aria-[invalid=true]:border-2 aria-[invalid=true]:border-flag-100';
const label = 'flex flex-col gap-1.5 text-sm font-medium';
const CARD = 'box-border flex min-w-0 max-w-[520px] flex-[1_1_380px] rounded-2xl bg-surface-100 text-ink-100 shadow-[0_12px_32px_rgba(4,30,40,0.25)] p-[clamp(24px,3vw,36px)]';

export function AssociationForm() {
  const kind: Kind = 'association';
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const [done, setDone] = useState<{ email: string; height: number } | null>(null);
  const [pending, start] = useTransition();
  const started = useRef(false);

  const firstTouch = () => {
    if (started.current) return;
    started.current = true;
    void track('form_start', location.pathname, visitSource());
  };

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const get = (k: string) => (f.get(k) as string | null) ?? '';
    // Measured now, while the form is on screen: the confirmation keeps this height so the page doesn't jump.
    const height = form.offsetHeight;
    setError(null);
    start(async () => {
      const r = await joinWaitlist({ kind, email: get('email'), ageGroup: get('ageGroup'), orgName: get('orgName'), teamCount: get('teamCount'), website: get('website'), source: visitSource() ?? undefined });
      if (r.ok) setDone({ email: get('email').trim().toLowerCase(), height });
      else setError({ text: r.error, field: r.field });
    });
  }

  const err = (field: Field) => (error?.field === field ? { 'aria-invalid': true, 'aria-describedby': 'waitlist-error' } : {});

  if (done) return <WaitlistDone email={done.email} minHeight={done.height} />;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onFocus={firstTouch}
      aria-labelledby="assoc-title"
      className={`${CARD} flex-col gap-5`}
    >
      <div className="flex flex-col gap-1.5">
        <h3 id="assoc-title" className="font-display text-[24px] font-bold leading-tight tracking-[-0.01em]">
          Run an association?
        </h3>
        <p className="text-[15px] leading-[22px] text-ink-200">Every U5–U9 team planning the same way, and their season in one place. Leave your details and Brett will get in touch.</p>
      </div>
      <label className={label}>
        Email
        <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" className={input} {...err('email')} />
      </label>

      <label className={label}>
        Association name
        <input name="orgName" maxLength={120} autoComplete="organization" placeholder="Nanaimo Minor Hockey" className={input} {...err('orgName')} />
      </label>
      <label className={label}>
        How many U5–U9 teams?
        <input name="teamCount" type="number" min={1} max={500} inputMode="numeric" placeholder="12" className={`${input} max-w-[140px]`} {...err('teamCount')} />
      </label>

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

      <button type="submit" disabled={pending} className="mt-1 min-h-[52px] rounded-full bg-rink-100 text-[17px] font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
        {pending ? 'Sending…' : 'Talk to Brett'}
      </button>
    </form>
  );
}

/** The card after joining. The mark plays as a tiny drill (the puck travels the pass to the teammate
 *  ring, the ring turns into a check), then the words arrive. Its resting state is the finished
 *  check, so with reduced motion nothing moves and nothing is missing (styles in globals.css). */
function WaitlistDone({ email, minHeight }: { email: string; minHeight: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // The form, and the button that had focus, are gone: move focus to the news so a screen reader says it.
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div role="status" className={`${CARD} wl-done flex-col items-center justify-center gap-5 text-center`} style={{ minHeight: minHeight || undefined }}>
      <svg viewBox="0 0 48 48" width="120" height="120" aria-hidden="true" className="overflow-visible text-rink-100">
        <defs>
          <mask id="wl-pass-reveal" maskUnits="userSpaceOnUse">
            <path className="wl-reveal" d="M17.5 33C21.5 30 24.5 27 27 23.5" pathLength={1} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          </mask>
        </defs>
        <g className="wl-drill">
          <path d="M17.5 33C21.5 30 24.5 27 27 23.5" mask="url(#wl-pass-reveal)" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="4.4 3.8" strokeLinecap="round" />
          <path className="wl-arrow" d="M31 18.5 23.06 22.62 27.47 23.35 29.53 27.32Z" fill="currentColor" />
          <circle className="wl-puck" cx="9.5" cy="38.5" r="6.5" fill="currentColor" />
        </g>
        <g className="wl-goal">
          <circle cx="37.5" cy="10.5" r="7.2" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle className="wl-fill" cx="37.5" cy="10.5" r="9.2" fill="var(--good-100)" />
          <path className="wl-check" d="M33.4 10.8l2.9 2.9 5.4-5.6" pathLength={1} fill="none" stroke="var(--surface-100)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <div className="wl-words flex max-w-[34ch] flex-col gap-2.5">
        <h3 ref={heading} tabIndex={-1} className="font-display text-[28px] font-bold leading-tight tracking-[-0.01em] outline-none">
          Thanks. Brett will be in touch.
        </h3>
        <p className="text-[15px] leading-[23px] text-ink-200">
          He’ll email you within a day at
          <b className="block font-medium text-ink-100 [overflow-wrap:anywhere]">{email}</b>
        </p>
      </div>
    </div>
  );
}
