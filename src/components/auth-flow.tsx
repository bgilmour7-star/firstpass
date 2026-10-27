'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { checkEmail, createAccount, sendLink, sendPasswordLink, signInWithPassword, verifyCode, type Status } from '@/app/login/actions';

// Email first, then the screen reacts (decision 0013, canvas "Firstpass Sign-in & Join"):
//   new       → Create your account: first name + password. "Email me a sign-in link instead" second.
//   password  → Welcome back: password. "Email me a sign-in link" second.
//   link      → Welcome back: "Email me a sign-in link". Setting a password offered underneath.
// Then a 6-digit code screen (the email's button works too), or straight in with a password.

type Step = 'email' | Status | 'code' | 'reset-sent';
type Join = { code: string; teamName: string };
const CODE_LENGTH = 6;

const input = 'h-[52px] w-full rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-4 text-[17px] text-ink-100 placeholder:text-ink-200/70 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25';
const primary = 'inline-flex h-[52px] w-full items-center justify-center rounded-full bg-rink-100 text-base font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]';
const secondary = 'inline-flex h-[52px] w-full items-center justify-center rounded-full border-[1.5px] border-border-200 bg-surface-100 text-[15px] font-medium hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)]';
const h1 = 'font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-balance';

export function AuthFlow({ next, join, initialEmail = '', intro, initialStep = 'email', initialName = null }: { next: string; join?: Join; initialEmail?: string; intro?: React.ReactNode; initialStep?: Step; initialName?: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState('');
  const [knownName, setKnownName] = useState<string | null>(initialName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const ctx = { next, joinCode: join?.code, teamName: join?.teamName };

  function run<T>(work: () => Promise<{ ok: true } & T | { ok: false; error: string }>, then: (r: { ok: true } & T) => void) {
    setError('');
    start(async () => {
      const r = await work();
      if (r.ok) then(r);
      else setError(r.error);
    });
  }

  const goTo = (to: string) => {
    router.replace(to);
    router.refresh();
  };
  const emailMe = () => run(() => sendLink({ email, firstName: step === 'new' ? firstName : undefined, ...ctx }), () => setStep('code'));
  const passwordLink = () => run(() => sendPasswordLink(email), () => setStep('reset-sent'));
  const back = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  if (step === 'email')
    return (
      <div className="flex flex-col">
        {intro}
        <form
          className="mt-7 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => checkEmail(email, join?.code), (r) => {
              setEmail(r.email);
              setKnownName(r.firstName);
              setStep(r.status);
            });
          }}
        >
          <label htmlFor="email" className="text-sm font-semibold">
            {join ? 'Your email' : 'Email'}
          </label>
          <input id="email" type="email" required autoComplete="email" inputMode="email" autoFocus={!initialEmail} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <ErrorLine text={error} />
          <button type="submit" disabled={pending} className={`${primary} mt-2`}>
            {pending ? 'Checking…' : 'Continue'}
          </button>
          <p className="mt-1 text-center text-[13px] leading-[18px] text-ink-200">New to Firstpass or already on it, start with your email.</p>
        </form>
      </div>
    );

  if (step === 'new')
    return (
      <div className="flex flex-col">
        <EmailChip email={email} onChange={back} />
        <h1 className={`${h1} mt-6`}>Create your account</h1>
        <p className="mt-1.5 text-[15px] leading-[22px] text-ink-200">{join ? `Then you're on ${join.teamName}.` : 'Then set up your team. It takes about 3 minutes.'}</p>
        <form
          className="mt-6 flex flex-col gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createAccount({ email, firstName, password, ...ctx }), () => setStep('code'));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="first" className="text-sm font-semibold">
              First name
            </label>
            <input id="first" required autoComplete="given-name" maxLength={40} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
            <span className="text-xs text-ink-200">Your co-coaches see it: &ldquo;{firstName.trim() || 'Kara'} checked in.&rdquo;</span>
          </div>
          <PasswordField id="pw" label="Password" value={password} onChange={setPassword} autoComplete="new-password" hint />
          <ErrorLine text={error} />
          <button type="submit" disabled={pending} className={primary}>
            {pending ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <Or />
        <button type="button" disabled={pending} onClick={() => (firstName.trim() ? emailMe() : setError('Add your first name first. Your co-coaches see it.'))} className={secondary}>
          Email me a sign-in link instead
        </button>
        <p className="mt-2 text-center text-xs text-ink-200">No password. You sign in from your email each time.</p>
      </div>
    );

  if (step === 'waitlist')
    return (
      <div className="flex flex-col">
        <EmailChip email={email} onChange={back} />
        <h1 className={`${h1} mt-6`}>{join ? 'This join link isn’t working' : 'Firstpass is invite-only for now'}</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-200">
          {join
            ? `There’s no account for ${email} yet, and the link to ${join.teamName} has been turned off. Ask your head coach for a new one.`
            : `There’s no account for ${email}. While we pilot Firstpass, new coaches get early access from firstpass.coach, and Brett sets them up.`}
        </p>
        {!join && (
          <Link href="/#join" className={`${primary} mt-7`}>
            Get early access
          </Link>
        )}
        <button type="button" onClick={back} className={`${secondary} ${join ? 'mt-7' : 'mt-3'}`}>
          Use a different email
        </button>
      </div>
    );

  if (step === 'password')
    return (
      <div className="flex flex-col">
        <EmailChip email={email} onChange={back} />
        <h1 className={`${h1} mt-6`}>Welcome back{knownName ? `, ${knownName}` : ''}</h1>
        <form
          className="mt-6 flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => signInWithPassword({ email, password, ...ctx }), (r) => goTo(r.to));
          }}
        >
          <PasswordField id="pw" label="Password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} forgot={passwordLink} autoFocus />
          <ErrorLine text={error} />
          <button type="submit" disabled={pending} className={`${primary} mt-3`}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <Or />
        <button type="button" disabled={pending} onClick={emailMe} className={secondary}>
          Email me a sign-in link
        </button>
      </div>
    );

  if (step === 'link')
    return (
      <div className="flex flex-col">
        <EmailChip email={email} onChange={back} />
        <h1 className={`${h1} mt-6`}>Welcome back{knownName ? `, ${knownName}` : ''}</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-200">You sign in with a link and code from your email.</p>
        <ErrorLine text={error} />
        <button type="button" disabled={pending} onClick={emailMe} className={`${primary} mt-7`}>
          {pending ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        <div className="mt-7 flex flex-col gap-1.5 border-t border-border-100 pt-5">
          <h2 className="text-[15px] font-semibold">Rather use a password?</h2>
          <p className="text-sm leading-5 text-ink-200">Sign in with the link this time, and we&apos;ll offer to add one. Or we can email you a link to set it now.</p>
          <button type="button" disabled={pending} onClick={passwordLink} className="min-h-11 self-start text-sm font-medium text-rink-100 hover:underline">
            Email me a link to set a password
          </button>
        </div>
      </div>
    );

  if (step === 'reset-sent')
    return (
      <div className="flex flex-col">
        <h1 className={`${h1} mt-10`}>Check your email</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-200">
          We sent a link to set your password to <b className="font-semibold text-ink-100">{email}</b>. It works once, for an hour.
        </p>
        <MailButton email={email} />
        <button type="button" onClick={back} className="mt-auto min-h-11 self-start text-sm text-rink-100 underline">
          Back to sign in
        </button>
      </div>
    );

  return (
    <CodeStep
      email={email}
      pending={pending}
      error={error}
      joining={!!join}
      onCode={(code) => run(() => verifyCode({ email, code, ...ctx }), (r) => goTo(r.to))}
      onResend={emailMe}
      onBack={back}
    />
  );
}

function CodeStep({ email, pending, error, joining, onCode, onResend, onBack }: { email: string; pending: boolean; error: string; joining: boolean; onCode: (code: string) => void; onResend: () => void; onBack: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [wait, setWait] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => refs.current[0]?.focus(), []);

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH - from);
    if (!clean) return;
    const next = [...digits];
    clean.split('').forEach((d, i) => (next[from + i] = d));
    setDigits(next);
    const at = Math.min(from + clean.length, CODE_LENGTH - 1);
    refs.current[at]?.focus();
    if (next.every((d) => d)) onCode(next.join(''));
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className={`${h1} mt-10`}>Check your email</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-200">
        We sent a 6-digit code to <b className="font-semibold text-ink-100">{email}</b>. Enter it here to confirm it&apos;s you.
      </p>
      <form
        className="mt-7 flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (digits.every((d) => d)) onCode(digits.join(''));
        }}
      >
        <label htmlFor="d0" className="text-sm font-semibold">
          Code
        </label>
        <div className="grid grid-cols-6 gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`d${i}`}
              ref={(el) => {
                refs.current[i] = el;
              }}
              aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? CODE_LENGTH : 1}
              value={d}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  const n = [...digits];
                  n[i] = '';
                  setDigits(n);
                } else fill(i, v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              }}
              onPaste={(e) => {
                e.preventDefault();
                fill(0, e.clipboardData.getData('text'));
              }}
              className="h-[60px] min-w-0 rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 text-center font-mono text-[26px] font-medium focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25"
            />
          ))}
        </div>
        <span className="text-xs text-ink-200">{pending ? 'Checking…' : 'It goes through on the sixth digit. Pasting works too.'}</span>
        <ErrorLine text={error} />
      </form>
      <MailButton email={email} />
      <div className="mt-6 flex flex-col gap-2.5 border-t border-border-100 pt-[18px] text-sm leading-5 text-ink-200">
        <p>
          Or tap <b className="font-semibold text-ink-100">{joining ? 'Confirm and join' : 'the button'}</b> in the email. Either one works, on any device.
        </p>
        <p>
          Nothing yet? Check spam, or{' '}
          {wait > 0 ? (
            <span className="tabular-nums">send a new code in 0:{String(wait).padStart(2, '0')}</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setWait(60);
                onResend();
              }}
              className="font-medium text-rink-100 underline"
            >
              send a new code
            </button>
          )}
          .
        </p>
      </div>
      <button type="button" onClick={onBack} className="mt-auto min-h-11 self-start pt-6 text-sm text-rink-100 underline">
        Use a different email
      </button>
    </div>
  );
}

/** Opens the inbox for the big webmail providers; nothing for everyone else. */
function MailButton({ email }: { email: string }) {
  const domain = email.split('@')[1] ?? '';
  const inbox = /^(gmail|googlemail)\.com$/.test(domain)
    ? { label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3Ahello%40firstpass.coach' }
    : /^(outlook|hotmail|live|msn)\.(com|ca)$/.test(domain)
      ? { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' }
      : /^(yahoo|ymail)\.(com|ca)$/.test(domain)
        ? { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' }
        : null;
  if (!inbox) return null;
  return (
    <a href={inbox.url} target="_blank" rel="noreferrer" className={`${secondary} mt-6`}>
      {inbox.label}
    </a>
  );
}

function EmailChip({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="mt-6 flex h-11 items-center justify-between gap-3 rounded-full bg-surface-200 pl-3.5 pr-1">
      <span className="truncate text-sm">{email}</span>
      <button type="button" onClick={onChange} className="h-11 px-3 text-sm font-medium text-rink-100">
        Change
      </button>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, hint, invalid, forgot, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: boolean; invalid?: boolean; forgot?: () => void; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  const long = value.length >= 8;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {forgot && (
          <button type="button" onClick={forgot} className="py-1.5 text-[13px] text-rink-100 hover:underline">
            Forgot it?
          </button>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={hint ? 8 : undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} pr-20 ${invalid ? 'border-flag-100' : ''}`}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 h-11 px-3 text-sm font-medium text-rink-100">
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span className={`text-xs ${long ? 'text-good-100' : 'text-ink-200'}`}>{long ? '✓ ' : ''}8 or more characters</span>}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-1 text-[13px] leading-[18px] text-flag-100">
      {text}
    </p>
  );
}

function Or() {
  return (
    <div className="my-[18px] flex items-center gap-3 text-[13px] text-ink-200" aria-hidden="true">
      <span className="h-px flex-1 bg-border-100" />
      or
      <span className="h-px flex-1 bg-border-100" />
    </div>
  );
}
