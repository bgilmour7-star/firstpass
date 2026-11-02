'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { clock, type Team } from '@/lib/plans/schema';
import { ageFromName, DEFAULT_GEAR, guessFocus } from '@/lib/plans/team-summary';
import { FocusPicker, GearEditor, GroupsEditor, ICE_OPTIONS, NO_KIDS, Segmented, Why, field, gearLine, primary, shownGroups } from '../ui';
import { buildTeam, checkCalendar, sendOlderInterest, type CalendarGuess } from './actions';

// Create a team, one question per screen (decision 0026, W1b–W7 and W3b on the canvas). Every screen
// starts with a guess and the reason under it. Progress reads "3 of 8 · Age group".

export type WizardContext = {
  me: string;
  email: string;
  hasTeam: boolean;
  /** The coach's current team, to copy from and to say "like your Avalanche". */
  other: (Pick<Team, 'name' | 'ageGroup' | 'ice' | 'practiceMinutes' | 'newDrillsPerWeek' | 'gear' | 'groups'> & { short: string }) | null;
  mates: { name: string; email: string }[];
  fallbackDate: { date: string; startTime: string };
};

type Step = 'name' | 'copy' | 'age' | 'ice' | 'groups' | 'coaches' | 'gear' | 'focus' | 'check';
const TITLE: Record<Step, string> = { name: 'Team name', copy: 'Copy settings', age: 'Age group', ice: 'Ice times', groups: 'Skill groups', coaches: 'Coaches', gear: 'Gear', focus: 'Focus', check: 'Check' };
const AGES = [
  ['U5', 'Ages 3 and 4'],
  ['U7', 'Ages 5 and 6'],
  ['U9', 'Ages 7 and 8'],
] as const;
const OLDER = [
  ['U11', 'U11'],
  ['U13', 'U13'],
  ['U15+', 'U15 and up'],
] as const;
const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const DEFAULT_GROUPS: Team['groups'] = [
  { group: 'Sharks', skaters: 4, name: 'Sharks' },
  { group: 'Bears', skaters: 4, name: 'Bears' },
  { group: 'Eagles', skaters: 4, name: 'Eagles' },
];

export function Wizard({ ctx }: { ctx: WizardContext }) {
  const o = ctx.other;
  const [step, setStep] = useState<Step>('name');
  const [older, setOlder] = useState(false);
  const [name, setName] = useState('');
  const [copy, setCopy] = useState({ gear: Boolean(o), minutes: Boolean(o), drills: Boolean(o) });
  const [age, setAge] = useState<'U5' | 'U7' | 'U9' | null>(null);
  const [cal, setCal] = useState('');
  const [calGuess, setCalGuess] = useState<CalendarGuess | null>(null);
  const [ice, setIce] = useState<Team['ice'] | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [groups, setGroups] = useState<Team['groups']>(DEFAULT_GROUPS);
  const [invites, setInvites] = useState<string[]>([]);
  const [gear, setGear] = useState<Team['gear']>(o?.gear && Object.keys(o.gear).length ? o.gear : DEFAULT_GEAR);
  const [focus, setFocus] = useState<Team['focus'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The guesses, each with its reason.
  const nameAge = ageFromName(name);
  const ageGuess: { v: 'U5' | 'U7' | 'U9'; why: string } =
    nameAge === 'U5' || nameAge === 'U7' || nameAge === 'U9' ? { v: nameAge, why: `The name says ${nameAge}.` } : o && ['U5', 'U7', 'U9'].includes(o.ageGroup) ? { v: o.ageGroup as 'U7', why: `Like your ${o.short}.` } : { v: 'U7', why: 'Most teams on Firstpass are U7.' };
  const ageNow = age ?? ageGuess.v;
  const calOk = calGuess?.ok ? calGuess : null;
  const iceGuess: { v: Team['ice']; why: string } = calOk ? { v: calOk.ice, why: calOk.why } : o ? { v: o.ice, why: `Like your ${o.short}.` } : { v: 'half', why: 'Most young teams practise on half ice.' };
  const iceNow = ice ?? iceGuess.v;
  const minutesNow = minutes ?? (o && copy.minutes ? o.practiceMinutes : (calOk?.minutes ?? 60));
  const focusGuess = guessFocus(ageNow);
  const focusNow = focus ?? focusGuess.focus;
  const nick = shortName(name) || 'the team';
  const copyingGear = Boolean(o && copy.gear);

  const steps = useMemo<Step[]>(() => ['name', ...(o ? (['copy'] as const) : []), 'age', 'ice', 'groups', 'coaches', ...(copyingGear ? [] : (['gear'] as const)), 'focus', 'check'], [o, copyingGear]);
  const at = steps.indexOf(step);
  const go = (s: Step) => {
    setError(null);
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const next = () => go(steps[Math.min(steps.length - 1, at + 1)]);
  const back = () => (older ? setOlder(false) : at > 0 ? go(steps[at - 1]) : undefined);

  const first = calOk?.first
    ? { date: calOk.first.date, startTime: calOk.first.startTime, ice: calOk.first.half ? 'half' : iceNow === 'full' ? 'full' : 'half' }
    : { date: ctx.fallbackDate.date, startTime: ctx.fallbackDate.startTime, ice: iceNow === 'full' ? 'full' : 'half' };

  const build = () =>
    start(async () => {
      setError(null);
      const r = await buildTeam({
        name: name.trim(),
        ageGroup: ageNow,
        ice: iceNow,
        practiceMinutes: minutesNow,
        newDrillsPerWeek: o && copy.drills ? o.newDrillsPerWeek : 2,
        groups: groups.map((g) => ({ ...g, name: g.name?.trim() || g.group })),
        gear: copyingGear ? o!.gear : gear,
        focus: focusNow,
        calendarUrl: calOk ? cal.trim() : null,
        invites,
      });
      if (r && !r.ok) setError(r.error);
    });

  if (older) return <Older onBack={() => setOlder(false)} hasTeam={ctx.hasTeam} />;

  const progress = `${at + 1} of ${steps.length} · ${TITLE[step]}`;
  const canNext = step !== 'name' || name.trim().length > 0;

  return (
    <Frame progress={progress} onBack={at > 0 ? back : undefined} closeHref={ctx.hasTeam ? '/team' : undefined}>
      {step === 'name' && (
        <Screen title="What's the new team called?" lead="The name your families and other coaches know it by.">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tname" className="text-sm font-semibold">
              Team name
            </label>
            <input id="tname" className={`${field} h-[52px] text-[17px]`} value={name} maxLength={80} autoFocus placeholder={o ? 'e.g. Nanaimo U9 Rebels' : 'e.g. Nanaimo U7 Blue'} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canNext && next()} />
            <span className="text-[13px] text-ink-200">Team details only. Never kids&apos; names.</span>
          </div>
          <p className="text-sm leading-5 text-ink-200">Joining a team someone else set up? Use the invite link they sent you.</p>
        </Screen>
      )}

      {step === 'copy' && o && (
        <Screen title="Copy settings from your other team?" lead="We'll copy what's usually the same, so you only answer what's different.">
          <fieldset className="flex flex-col">
            <legend className="mb-2 text-sm font-semibold">Copy from {o.name}</legend>
            {(
              [
                ['gear', 'Gear', gearLine(o.gear) ?? 'Not set on that team'],
                ['minutes', 'Practice length', `${o.practiceMinutes} minutes`],
                ['drills', 'New drills a week', `Up to ${o.newDrillsPerWeek}`],
              ] as const
            ).map(([k, l, v]) => (
              <label key={k} className="flex min-h-14 cursor-pointer items-center gap-3 border-t border-border-100 py-2 first-of-type:border-t-0">
                <input type="checkbox" checked={copy[k]} onChange={(e) => setCopy({ ...copy, [k]: e.target.checked })} className="size-5 shrink-0 accent-[var(--rink-100)]" />
                <span className="flex flex-col">
                  <b className="text-[15px] font-semibold">{l}</b>
                  <span className="text-[13px] text-ink-200">{v}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Why>Not copied: ice times, skill groups and coaches. Those are the next few questions.</Why>
        </Screen>
      )}

      {step === 'age' && (
        <Screen kicker={name.trim()} title={`How old are the ${nick}?`} lead="Sets which drills you see and how hard they start.">
          <fieldset className="flex flex-col">
            <legend className="sr-only">Age group</legend>
            {AGES.map(([v, l]) => (
              <div key={v} className="border-t border-border-100 first-of-type:border-t-0">
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
                  <span className="flex flex-col">
                    <b className="text-[15px] font-semibold">{v}</b>
                    <span className="text-[13px] text-ink-200">
                      {l}
                      {o?.ageGroup === v ? ` · like your ${o.short}` : ''}
                    </span>
                  </span>
                  <input type="radio" name="age" checked={ageNow === v} onChange={() => setAge(v)} className="size-5 shrink-0 accent-[var(--rink-100)]" />
                </label>
                {ageNow === 'U9' && v === 'U9' && <p className="mb-3 rounded-[10px] bg-surface-200 p-3 text-[13px] leading-[18px]">U9 drills are new to Firstpass. You&apos;ll start with U7 drills at their harder levels, and U9 drills will show up in your library as we add them.</p>}
              </div>
            ))}
            <button type="button" onClick={() => setOlder(true)} className="flex min-h-14 items-center justify-between gap-3 border-t border-border-100 py-2 text-left">
              <span className="flex flex-col">
                <b className="text-[15px] font-semibold">U11 or older</b>
                <span className="text-[13px] text-ink-200">Not yet. Tell us about your team</span>
              </span>
              <Chevron />
            </button>
          </fieldset>
          {!age && <Why>{ageGuess.why}</Why>}
        </Screen>
      )}

      {step === 'ice' && (
        <Screen title={`When do the ${nick} practice?`} lead="Paste the team's calendar link and we'll find the practices. Games are left out.">
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!cal.trim()) return;
              start(async () => {
                const r = await checkCalendar(cal);
                setCalGuess(r);
                if (r.ok) {
                  setIce(null);
                  setMinutes(null);
                }
              });
            }}
          >
            <label htmlFor="cal" className="text-sm font-semibold">
              TeamSnap or Google Calendar link
            </label>
            <div className="flex gap-2">
              <input id="cal" type="url" inputMode="url" className={`${field} font-mono text-sm`} placeholder="webcal://… or https://….ics" value={cal} onChange={(e) => setCal(e.target.value)} autoComplete="off" spellCheck={false} />
              <button type="submit" disabled={pending || !cal.trim()} className="h-12 shrink-0 rounded-full border border-border-200 px-4 text-sm font-medium hover:bg-surface-200 disabled:opacity-50">
                {pending ? 'Reading…' : 'Check'}
              </button>
            </div>
            {calGuess && !calGuess.ok && (
              <span role="alert" className="text-[13px] text-flag-100">
                {calGuess.error}
              </span>
            )}
            {calOk && (
              <span className="flex items-center gap-1.5 text-[13px] text-ink-200" aria-live="polite">
                <Check />
                {calOk.practices ? `Found ${calOk.practices} practice${calOk.practices === 1 ? '' : 's'}${calOk.from && calOk.to ? `, ${day(calOk.from)} to ${day(calOk.to)}` : ''}` : 'No practices coming up in that calendar.'}
              </span>
            )}
          </form>
          {calOk && calOk.slots.length > 0 && (
            <ul className="flex flex-col">
              {calOk.slots.map((s) => (
                <li key={s.label + s.startTime} className="flex flex-col border-t border-border-100 py-2.5 text-[15px]">
                  <b className="font-semibold">
                    {s.label} · <span className="font-mono font-medium">{clock(s.startTime)} · {s.minutes} min</span>
                  </b>
                  <span className="text-[13px] text-ink-200">{[s.rink, s.sharedWith ? `shared with ${s.sharedWith}` : null].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Half or full ice?</legend>
            <Segmented label="Half or full ice" value={iceNow} options={ICE_OPTIONS} onChange={setIce} />
            {!ice && <Why>{iceGuess.why}</Why>}
          </fieldset>
          {!calOk && <Why>No calendar link? Skip it: you&apos;ll pick each practice&apos;s date when you plan it, and can add the link on the Team page later.</Why>}
        </Screen>
      )}

      {step === 'groups' && (
        <Screen title={`How do you split the ${nick}?`} lead="Strongest at the top. The names are suggestions, so type your own if you like. Counts only, never kids' names.">
          <GroupsEditor groups={groups} onChange={setGroups} />
          <Why>Each group gets its own station, so plan one coach per group.</Why>
        </Screen>
      )}

      {step === 'coaches' && <CoachesStep me={ctx.me} myEmail={ctx.email} nick={nick} invites={invites} setInvites={setInvites} mates={ctx.mates} from={o?.short ?? null} />}

      {step === 'gear' && (
        <Screen title="What's in the gear bag?" lead="Drills that need gear say so, and the plan lists what to bring.">
          <GearEditor gear={gear} onChange={setGear} />
          <Why>A usual bag for a {ageNow} team. Change what&apos;s different.</Why>
        </Screen>
      )}

      {step === 'focus' && (
        <Screen title="What do you want to work on first?" lead="Pick up to two. Plans lean that way, and you can change it any time on the Team page.">
          <FocusPicker focus={focusNow} onChange={setFocus} />
          {!focus && <Why>{focusGuess.why}</Why>}
        </Screen>
      )}

      {step === 'check' && (
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-balance">{name.trim()}</h1>
          <dl className="flex flex-col">
            {(
              [
                ['Age group', ageNow, 'age'],
                ['Ice times', calOk?.slots.length ? calOk.slots.map((s) => `${s.label.slice(0, 3)} ${clock(s.startTime)}`).join(' · ') + ` · ${ICE_OPTIONS.find(([v]) => v === iceNow)![1].toLowerCase()}` : `${ICE_OPTIONS.find(([v]) => v === iceNow)![1]} · ${minutesNow} min`, 'ice'],
                ['Skill groups', shownGroups(groups).map((g) => `${g.skaters} ${g.name || g.group}`).join(' · '), 'groups'],
                ['Coaches', invites.length ? `You and ${invites.length} invited` : 'Just you for now', 'coaches'],
                ['Focus to start', focusNow.join(', ') || 'None yet', 'focus'],
                ...(o && (copy.gear || copy.minutes || copy.drills)
                  ? [[`Copied from the ${o.short}`, [copy.gear && 'Gear', copy.minutes && `${o.practiceMinutes} min`, copy.drills && `${o.newDrillsPerWeek} new drills a week`].filter(Boolean).join(' · '), 'copy'] as const]
                  : [['Gear', gearLine(gear) ?? 'None yet', 'gear'] as const]),
              ] as const
            ).map(([dt, dd, s]) => (
              <div key={dt} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border-100 py-3 first:border-t-0">
                <dt className="text-[13px] text-ink-200">{dt}</dt>
                <button type="button" onClick={() => go(s as Step)} className="row-span-2 min-h-11 px-1 text-sm font-medium text-rink-100 hover:underline" aria-label={`Change ${dt.toLowerCase()}`}>
                  Change
                </button>
                <dd className="text-[15px] font-medium">{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <Footer>
        {step === 'check' ? (
          <>
            <p className="text-center text-sm text-ink-200">
              First practice: {day(first.date)} at {clock(first.startTime)}, {first.ice} ice
            </p>
            <button type="button" onClick={build} disabled={pending} className={`${primary} h-[52px] w-full text-base`}>
              {pending ? 'Building it…' : 'Build my first practice'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={next} disabled={!canNext || (pending && step === 'ice')} className={`${primary} h-[52px] w-full text-base`}>
              Next
            </button>
            {step === 'copy' && (
              <button
                type="button"
                onClick={() => {
                  setCopy({ gear: false, minutes: false, drills: false });
                  go('age');
                }}
                className="min-h-11 text-[15px] font-medium text-rink-100"
              >
                Start fresh instead
              </button>
            )}
            {step === 'coaches' && invites.length === 0 && (
              <button type="button" onClick={next} className="min-h-11 text-[15px] font-medium text-rink-100">
                Just me for now
              </button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-flag-100">
            {error}
          </p>
        )}
      </Footer>
    </Frame>
  );
}

function CoachesStep({ me, myEmail, nick, invites, setInvites, mates, from }: { me: string; myEmail: string; nick: string; invites: string[]; setInvites: (x: string[]) => void; mates: { name: string; email: string }[]; from: string | null }) {
  const [typed, setTyped] = useState('');
  const [bad, setBad] = useState(false);
  const add = (raw: string) => {
    const e = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e === myEmail.toLowerCase()) return setBad(true);
    setBad(false);
    if (!invites.includes(e)) setInvites([...invites, e].slice(0, 10));
    setTyped('');
  };
  const offered = mates.filter((m) => !invites.includes(m.email.toLowerCase()));
  return (
    <Screen title={`Who coaches the ${nick} with you?`} lead="More coaches on the ice means more stations. They get an invite to join.">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add(typed);
        }}
      >
        <label htmlFor="inv" className="text-sm font-semibold">
          Email
        </label>
        <div className="flex gap-2">
          <input id="inv" type="email" className={field} placeholder="name@email.com" value={typed} onChange={(e) => (setTyped(e.target.value), setBad(false))} autoComplete="off" />
          <button type="submit" className="h-12 shrink-0 rounded-full border border-border-200 px-5 text-sm font-medium hover:bg-surface-200">
            Add
          </button>
        </div>
        {bad && <span className="text-[13px] text-flag-100">Enter their email, like coach@example.com.</span>}
      </form>
      <ul className="flex flex-col gap-2.5">
        <li className="flex items-center gap-2.5 text-[15px]">
          <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-full bg-rink-200 text-xs font-semibold text-surface-100">
            {me.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1">
            <b className="font-semibold">{me}</b> <span className="text-ink-200">· you</span>
          </span>
          <span className="text-[13px] text-ink-200">Head coach</span>
        </li>
        {invites.map((e) => (
          <li key={e} className="flex items-center gap-2.5 text-[15px]">
            <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-full border-[1.5px] border-dashed border-border-200 text-xs font-semibold text-ink-200">
              {e.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{mates.find((m) => m.email.toLowerCase() === e)?.name ?? e}</span>
            <button type="button" aria-label={`Remove ${e}`} onClick={() => setInvites(invites.filter((x) => x !== e))} className="grid size-11 place-items-center rounded-full text-ink-200 hover:bg-surface-200">
              <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {offered.length > 0 && from && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-200">From the {from}</span>
          <div className="flex flex-wrap gap-2">
            {offered.map((m) => (
              <button key={m.email} type="button" onClick={() => add(m.email)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-200 px-4 text-sm font-medium hover:bg-surface-200">
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}

/** U11 or older (W3b): not a dead end. What's hardest, a call if they're happy to, and a way back. */
function Older({ onBack, hasTeam }: { onBack: () => void; hasTeam: boolean }) {
  const [age, setAge] = useState<'U11' | 'U13' | 'U15+'>('U11');
  const [hard, setHard] = useState('');
  const [call, setCall] = useState(true);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent)
    return (
      <Frame progress="U11 or older" onBack={onBack} closeHref={hasTeam ? '/team' : undefined}>
        <Screen title="Thanks. We'll let you know" lead={call ? 'Brett will email you to find a time for a 15-minute chat.' : 'We’ll email you when Firstpass plans practices for older teams.'}>
          <span />
        </Screen>
        <Footer>
          <button type="button" onClick={onBack} className={`${primary} h-[52px] w-full text-base`}>
            I coach a younger team too
          </button>
          {hasTeam && (
            <Link href="/team" className="min-h-11 content-center text-center text-[15px] font-medium text-rink-100">
              Back to my team
            </Link>
          )}
        </Footer>
      </Frame>
    );
  return (
    <Frame progress="U11 or older" onBack={onBack} closeHref={hasTeam ? '/team' : undefined}>
      <Screen title={`We don't plan ${age === 'U15+' ? 'U15' : age} practices yet`} lead="We started with the youngest teams. Help us decide what's next, and we'll tell you when it's ready.">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Age group</legend>
          <Segmented label="Age group" value={age} options={OLDER} onChange={setAge} />
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="older-hard" className="text-sm font-semibold">
            What&apos;s the hardest part of planning practice for them?
          </label>
          <textarea id="older-hard" rows={4} maxLength={1000} value={hard} onChange={(e) => setHard(e.target.value)} className="w-full rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3.5 py-3 text-[16px] leading-6 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25" />
          <span className="text-[13px] text-ink-200">{NO_KIDS}</span>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={call} onChange={(e) => setCall(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--rink-100)]" />
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">Happy to do a 15-minute chat</span>
            <span className="text-[13px] leading-[18px] text-ink-200">Brett wants to learn how you plan practices for older kids. No sales pitch.</span>
          </span>
        </label>
      </Screen>
      <Footer>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await sendOlderInterest({ ageGroup: age, hardestPart: hard, wantsCall: call });
              if (r.ok) setSent(true);
              else setError(r.error);
            })
          }
          className={`${primary} h-[52px] w-full text-base`}
        >
          {pending ? 'Sending…' : 'Send and let me know'}
        </button>
        <button type="button" onClick={onBack} className="min-h-11 text-[15px] font-medium text-rink-100">
          I coach a younger team too
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-flag-100">
            {error}
          </p>
        )}
      </Footer>
    </Frame>
  );
}

function Frame({ progress, onBack, closeHref, children }: { progress: string; onBack?: () => void; closeHref?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[520px] flex-col lg:min-h-[calc(100dvh-6rem)]">
      <header className="-mx-2 -mt-3 flex h-14 items-center justify-between gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-full hover:bg-surface-200">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="size-11" />
        )}
        <span className="text-[13px] text-ink-200" aria-live="polite">
          {progress}
        </span>
        {closeHref ? (
          <Link href={closeHref} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-surface-200">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </header>
      <div className="flex flex-1 flex-col pt-4">{children}</div>
    </div>
  );
}

function Screen({ kicker, title, lead, children }: { kicker?: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        {kicker && <span className="text-[13px] text-ink-200">{kicker}</span>}
        <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.02em] text-balance">{title}</h1>
        <p className="text-[15px] leading-[22px] text-ink-200">{lead}</p>
      </div>
      {children}
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface-100 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">{children}</div>;
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-ink-200">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-good-100">
      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "Nanaimo U9 Rebels" → "Rebels", for "How old are the Rebels?". */
function shortName(name: string): string {
  return name.replace(/\b(U\s?-?\d+|Nanaimo)\b/gi, '').trim().split(/\s+/).filter(Boolean).join(' ');
}
