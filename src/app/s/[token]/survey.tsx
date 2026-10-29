'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PublicFrame } from '@/components/public-frame';
import { AGES, CALL_TIMES, CHANGED_PLAN, NO_KIDS, PLANNED_HOW, PLANNED_WHEN, ROLES, type Audience, type Option } from '@/lib/discovery/schema';
import { submitSurvey } from './actions';

// Seven questions, one per screen (canvas S1–S3), then thanks (S4). Coaches already using Firstpass
// get Q3 "How much of Firstpass's plan did you change…" and Q6 "What's missing, or got in your way?"
// instead of the planning-today questions. Every question can be skipped except the last.

type State = {
  role: string | null;
  ageGroups: string[];
  multiTeam: boolean;
  plannedHow: string | null;
  plannedHowApp: string;
  changedPlan: string | null;
  plannedWhen: string | null;
  hardestPart: string;
  wantsHelp: string;
  missing: string;
  wantsCall: boolean | null;
  callTimes: string[];
  phone: string;
};
const EMPTY: State = { role: null, ageGroups: [], multiTeam: false, plannedHow: null, plannedHowApp: '', changedPlan: null, plannedWhen: null, hardestPart: '', wantsHelp: '', missing: '', wantsCall: null, callTimes: [], phone: '' };
const TOTAL = 7;

const h1 = 'font-display text-[28px] font-extrabold leading-8 tracking-[-0.02em]';
const hint = 'mt-2 block text-[15px] leading-[22px] text-ink-200';

/** preview: Brett's look at the survey from Admin → Survey (/s/preview/<audience>). Same screens, nothing saved. */
export function Survey({ token, audience, email, preview = false }: { token: string; audience: Audience; email: string; preview?: boolean }) {
  const [step, setStep] = useState(1);
  const [s, setS] = useState<State>(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<State>) => setS((x) => ({ ...x, ...patch }));
  const coach = audience === 'coach';

  // Each new screen: focus its question, so screen readers and keyboards start in the right place.
  useEffect(() => {
    heading.current?.querySelector<HTMLElement>('[data-question]')?.focus();
  }, [step, done]);

  function next() {
    setError('');
    if (step < TOTAL) setStep(step + 1);
  }
  function send() {
    setError('');
    if (preview) {
      setDone(true);
      return;
    }
    start(async () => {
      const r = await submitSurvey(token, { ...s, wantsCall: s.wantsCall === true });
      if (r.ok) setDone(true);
      else setError(r.error);
    });
  }

  if (done) return <Thanks email={email} audience={audience} s={s} preview={preview} />;

  const back =
    step > 1 ? (
      <button type="button" onClick={() => setStep(step - 1)} aria-label="Back" className="grid size-11 place-items-center rounded-[10px] text-ink-100 hover:bg-surface-200">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    ) : null;

  let body: React.ReactNode;
  let canSkip = true;
  switch (step) {
    case 1:
      body = (
        <Choices legend="What’s your role on the ice?" sub="Pick the closest." options={ROLES} value={s.role} onChange={(role) => set({ role })} />
      );
      break;
    case 2:
      body = (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-[18px]">
            <span data-question tabIndex={-1} className={`block ${h1} outline-none`}>
              Which age groups do you coach this season?
            </span>
            <span className={hint}>Pick all that apply.</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {AGES.map((a) => (
              <Chip key={a.value} on={s.ageGroups.includes(a.value)} onChange={(on) => set({ ageGroups: on ? [...s.ageGroups, a.value] : s.ageGroups.filter((x) => x !== a.value) })}>
                {a.label}
              </Chip>
            ))}
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" checked={s.multiTeam} onChange={(e) => set({ multiTeam: e.target.checked })} className="size-5 accent-[var(--rink-100)]" />
            I coach more than one team
          </label>
        </fieldset>
      );
      break;
    case 3:
      body = coach ? (
        <Choices legend="How much of Firstpass’s plan did you change for your last practice?" sub="Think of the most recent one. Pick the closest." options={CHANGED_PLAN} value={s.changedPlan} onChange={(changedPlan) => set({ changedPlan })} />
      ) : (
        <Choices legend="How did you plan your last practice?" sub="Think of the most recent one. Pick the closest." options={PLANNED_HOW} value={s.plannedHow} onChange={(plannedHow) => set({ plannedHow })}>
          {s.plannedHow === 'app' && (
            <label className="flex flex-col gap-1.5 pt-1">
              <span className="text-sm font-semibold">Which one?</span>
              <input value={s.plannedHowApp} maxLength={80} onChange={(e) => set({ plannedHowApp: e.target.value })} className={input} />
            </label>
          )}
        </Choices>
      );
      break;
    case 4:
      body = <Choices legend="When did you plan it?" sub="Roughly is fine." options={PLANNED_WHEN} value={s.plannedWhen} onChange={(plannedWhen) => set({ plannedWhen })} />;
      break;
    case 5:
      body = <Open id="hard" legend="What was the hardest part of your last practice?" sub="Before it or on the ice. A sentence or two is plenty." value={s.hardestPart} onChange={(hardestPart) => set({ hardestPart })} />;
      break;
    case 6:
      body = coach ? (
        <Open id="missing" legend="What’s missing, or got in your way?" sub="In Firstpass, or anything around it. A sentence or two is plenty." value={s.missing} onChange={(missing) => set({ missing })} />
      ) : (
        <Open id="help" legend="If something could help with that, what would it do?" sub="Dream a little. A sentence or two is plenty." value={s.wantsHelp} onChange={(wantsHelp) => set({ wantsHelp })} />
      );
      break;
    default:
      canSkip = false;
      body = <Call s={s} set={set} email={email} phoneError={error && /phone/i.test(error) ? error : ''} />;
  }

  return (
    <PublicFrame back={back} progress={`${step} of ${TOTAL}`}>
      {preview && <PreviewNote audience={audience} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === TOTAL) send();
          else next();
        }}
        className="flex flex-1 flex-col"
      >
        <div ref={heading} className="flex flex-1 flex-col gap-[22px] px-6 pt-6">
          {body}
        </div>
        <div className="sticky bottom-0 flex flex-col gap-2 bg-surface-100 px-6 pb-7 pt-4">
          {error && !/phone/i.test(error) && (
            <p role="alert" className="text-sm text-flag-100">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || (step === TOTAL && s.wantsCall === null)}
            className="h-[52px] rounded-full bg-rink-100 text-base font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]"
          >
            {step === TOTAL ? (pending ? 'Sending…' : 'Send my answers') : 'Next'}
          </button>
          {canSkip && step >= 5 && step <= 6 && (
            <button type="button" onClick={next} className="h-11 text-[15px] font-medium text-rink-100 hover:underline">
              Skip this one
            </button>
          )}
        </div>
      </form>
    </PublicFrame>
  );
}

const input = 'h-[52px] rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3.5 text-base text-ink-100 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25';

function Choices({ legend, sub, options, value, onChange, children }: { legend: string; sub: string; options: Option[]; value: string | null; onChange: (v: string) => void; children?: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-[18px]">
        <span data-question tabIndex={-1} className={`block ${h1} outline-none`}>
          {legend}
        </span>
        <span className={hint}>{sub}</span>
      </legend>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <label
            key={o.value}
            className={`grid min-h-14 cursor-pointer grid-cols-[24px_1fr] items-center gap-3 rounded-xl px-4 py-2 text-[15px] ${on ? 'border-2 border-rink-100 bg-surface-200 font-semibold' : 'border-[1.5px] border-border-200 hover:bg-surface-200'}`}
          >
            <input type="radio" name={legend} checked={on} onChange={() => onChange(o.value)} className="size-5 accent-[var(--rink-100)]" />
            {o.label}
          </label>
        );
      })}
      {children}
    </fieldset>
  );
}

function Open({ id, legend, sub, value, onChange }: { id: string; legend: string; sub: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3.5">
      <label htmlFor={id} className="flex flex-col gap-2">
        <span data-question tabIndex={-1} className={`${h1} outline-none`}>
          {legend}
        </span>
        <span className="text-[15px] leading-[22px] text-ink-200">{sub}</span>
      </label>
      <textarea
        id={id}
        rows={6}
        maxLength={2000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-kids`}
        className="w-full resize-none rounded-xl border-[1.5px] border-border-200 bg-surface-100 px-4 py-3.5 text-base leading-6 text-ink-100 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25"
      />
      <p id={`${id}-kids`} className="text-[13px] text-ink-200">
        {NO_KIDS}
      </p>
    </div>
  );
}

function Chip({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm ${on ? 'bg-ink-100 text-surface-100' : 'border border-border-200 hover:bg-surface-200'}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--rink-100)]" />
      {children}
    </label>
  );
}

function Call({ s, set, email, phoneError }: { s: State; set: (p: Partial<State>) => void; email: string; phoneError: string }) {
  return (
    <>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-[18px]">
          <span data-question tabIndex={-1} className={`block ${h1} outline-none`}>
            Up for a 20-minute chat?
          </span>
          <span className={hint}>I want to learn more about how you plan practices and what gets in the way. No sales pitch. Evenings and weekends are fine. You get the $10 card either way.</span>
        </legend>
        <div className="grid grid-cols-2 gap-2.5">
          {([
            [true, 'Yes'],
            [false, 'Not right now'],
          ] as const).map(([v, label]) => {
            const on = s.wantsCall === v;
            return (
              <label key={label} className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl text-[15px] ${on ? 'border-2 border-rink-100 bg-surface-200 font-semibold' : 'border-[1.5px] border-border-200 hover:bg-surface-200'}`}>
                <input type="radio" name="call" checked={on} onChange={() => set({ wantsCall: v })} className="size-5 accent-[var(--rink-100)]" />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {s.wantsCall && (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold">Good times for you</legend>
            <div className="flex flex-wrap gap-2">
              {CALL_TIMES.map((t) => (
                <Chip key={t.value} on={s.callTimes.includes(t.value)} onChange={(on) => set({ callTimes: on ? [...s.callTimes, t.value] : s.callTimes.filter((x) => x !== t.value) })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-semibold">
              Phone <span className="font-normal text-ink-200">(optional)</span>
            </label>
            <input id="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} value={s.phone} onChange={(e) => set({ phone: e.target.value })} aria-invalid={Boolean(phoneError)} aria-describedby="phone-note" className={input} />
            {phoneError ? (
              <span id="phone-note" role="alert" className="text-[13px] text-flag-100">
                {phoneError}
              </span>
            ) : (
              <span id="phone-note" className="break-words text-[13px] text-ink-200">
                Otherwise you’ll get email at {email} to set a time.
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

const ONE_TIME: Record<string, string> = { weekday_evenings: 'a weekday evening', weekday_lunch: 'a weekday lunch', weekend_mornings: 'a weekend morning' };

/** ", on a weekday evening or a weekend morning" (canvas S4). */
function when(times: string[]) {
  const words = times.map((t) => ONE_TIME[t]).filter(Boolean);
  if (!words.length) return '';
  return `, on ${words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`}`;
}

function PreviewNote({ audience }: { audience: Audience }) {
  return (
    <p role="note" className="mx-6 mt-2 rounded-lg bg-surface-200 px-3.5 py-2.5 text-[13px] leading-[19px] text-ink-200">
      Preview of the {audience === 'coach' ? 'coach' : 'waitlist'} survey. Answers aren’t saved.
    </p>
  );
}

function Thanks({ email, audience, s, preview = false }: { email: string; audience: Audience; s: State; preview?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <PublicFrame>
      {preview && <PreviewNote audience={audience} />}
      <div className="flex flex-1 flex-col gap-[22px] px-7 pt-16">
        <svg width="160" height="60" viewBox="0 0 160 60" aria-hidden="true">
          <ellipse cx="18" cy="44" rx="11" ry="6.5" fill="var(--ink-100)" />
          <path d="M34 40 L124 18" stroke="var(--whistle-100)" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" fill="none" />
          <circle cx="140" cy="14" r="11" stroke="var(--ink-100)" strokeWidth="3" fill="none" />
        </svg>
        <h1 ref={heading} tabIndex={-1} className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.02em] outline-none">
          Thanks, that really helps.
        </h1>
        <div className="flex flex-col gap-3.5 text-base leading-6">
          <p>
            Your $10 Tim Hortons card goes to <b className="break-words font-semibold">{email}</b> within 2 days.
          </p>
          {s.wantsCall && (
            <p>
              I will {s.phone ? 'text' : 'email'} you to set up a 20-minute call{when(s.callTimes)}.
            </p>
          )}
          {audience === 'waitlist' && <p className="text-ink-200">You’re still on the waitlist. We’ll email you when Firstpass opens for your team.</p>}
        </div>
      </div>
      <p className="px-7 pb-8 text-[13px] leading-[19px] text-ink-200">Questions? Reply to any Firstpass email or write to hello@firstpass.coach.</p>
    </PublicFrame>
  );
}
