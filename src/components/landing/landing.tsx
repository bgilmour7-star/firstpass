import Link from 'next/link';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../design-system/index';
import puckParty from '../../../content/drills/rotation-puck-party.json';
import skiRacer from '../../../content/drills/ski-racer.json';
import { VisitTracker } from './visit-tracker';
import { WaitlistForm } from './waitlist-form';
import { Mark } from './mark';
import { HeroRink } from './hero-rink';

// The public landing page (decision 0019; canvas "Firstpass Landing Page"). One promise, "Show up
// ready", proved with the product: real drills from the library drawn by RinkDiagram, and crops of
// real screens. A dashed pass line runs down the left from a puck (the hero) to a teammate ring
// (the waitlist form), so the page reads like the logo: puck, pass, teammate. Tablet and up only: on a
// phone the two ends are screens apart, so the line is just a stripe that costs margin.

const RD = firstpass.RinkDiagram as RinkDiagramApi;

/** Drawn on the server (a static page needs no client-side rink, and its ids then never mismatch). */
function Rink({ spec, title, detail = 'full', className = '' }: { spec: RinkDiagramProps; title: string; detail?: 'full' | 'thumb'; className?: string }) {
  return <div className={`rink-frame ${className}`} dangerouslySetInnerHTML={{ __html: RD.render({ ...spec, title, detail }) }} />;
}

type Level = { name: string; diagram: RinkDiagramProps };

// Drills from the library, read at build time: the page is public and the database isn't.
const heroDiagram = puckParty.diagram as unknown as RinkDiagramProps;
// Zone C is the narrow neutral strip: its full name runs off the half rink at hero size.
const hero: RinkDiagramProps = { ...heroDiagram, stations: { ...heroDiagram.stations!, labels: ['Finger count', 'Push and chase', 'Glides'] } };
const levels: { n: number; name: string; spec: RinkDiagramProps }[] = [
  { n: 1, name: skiRacer.plainName, spec: skiRacer.diagram as unknown as RinkDiagramProps },
  ...(skiRacer.levels as unknown as Level[]).map((l, i) => ({ n: i + 2, name: l.name, spec: l.diagram })),
];
const zones = puckParty.zones as { station: string; name: string }[];
const heroTitle = `${puckParty.funName}: three zones on half ice. ${zones.map((z) => `${z.station}, ${z.name}`).join('. ')}.`;

const h2 = 'font-display text-[clamp(34px,4.4vw,56px)] font-bold leading-[1.02] tracking-[-0.025em]';
const section = 'relative border-t border-border-100 py-[clamp(64px,9vw,112px)]';
const mono = 'font-mono';

/** A piece of the dashed pass line, in the left gutter of a section. */
function Rail({ top = '0px', height, onTeal = false }: { top?: string; height?: string; onTeal?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`rail-draw absolute hidden sm:block left-[calc(var(--railx)-var(--railpad))] w-[3px] rounded-sm ${onTeal ? 'bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.72)_0_9px,transparent_9px_17px)]' : 'bg-[repeating-linear-gradient(to_bottom,var(--ink-200)_0_9px,transparent_9px_17px)]'}`}
      style={height ? { top, height } : { top, bottom: 0 }}
    />
  );
}

/** The orange cone that marks each step down the pass line. */
function Cone({ top }: { top: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="absolute hidden left-[calc(var(--railx)-var(--railpad)-6.5px)] sm:block" style={{ top }}>
      <path d="M8 1 15 15H1z" fill="var(--whistle-100)" />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-rink-200 text-[11px] font-semibold text-surface-100">{children}</span>;
}

/** The rink-side view on a phone, floating over the hero rink. */
function PhoneCard() {
  return (
    <figure aria-label="Rink-side view on a phone: the Puck Party rotation is on now, 7:20 left" className="absolute bottom-0 right-[-4px] m-0 box-border hidden sm:block w-[clamp(156px,36%,236px)] rounded-[28px] border border-border-100 bg-surface-100 px-4 pb-4 pt-[18px] shadow-[0_12px_32px_rgba(14,27,30,0.18)]">
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        <div className={`${mono} text-[11px] text-ink-200`}>Today · 9:45</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-rink-100">Now · 9:58</span>
          <span className="font-display text-[20px] font-bold leading-[1.1]">{puckParty.funName}</span>
          <span className={`${mono} text-[26px] font-medium leading-[1.2]`}>
            7:20 <span className="text-xs text-ink-200">left</span>
          </span>
        </div>
        <div className="flex flex-col gap-[7px] border-t border-border-100 pt-2.5">
          {zones.map((z) => (
            <div key={z.station} className="flex items-center gap-2 text-xs leading-[1.25]">
              <Badge>{z.station}</Badge>
              <span>{z.name}</span>
            </div>
          ))}
          <span className="text-[11px] text-ink-200">Whistle every 4 min</span>
        </div>
        <div className="border-t border-border-100 pt-2 text-[11px] text-ink-200">Next · Water · 10:10</div>
      </div>
    </figure>
  );
}

const PLAN: { at: string; name: string; strong?: boolean; sub?: string }[] = [
  { at: '9:45', name: 'Free Skate Challenges' },
  { at: '9:50', name: 'Ski Racer', strong: true },
  { at: '9:58', name: 'Puck Party', strong: true, sub: '3 zones · 4 min' },
  { at: '10:10', name: 'Water' },
  { at: '10:12', name: 'Snake in the Forest', strong: true },
  { at: '10:22', name: 'Toilet Bowl Tag', strong: true },
  { at: '10:32', name: 'Huddle' },
];

function Crop({ label, children, pad = 'p-3 sm:p-6', fit = false }: { label: string; children: React.ReactNode; pad?: string; fit?: boolean }) {
  return (
    <figure aria-label={label} className={`m-0 overflow-hidden rounded-2xl bg-surface-200 ${fit ? 'sm:h-[300px]' : 'h-[260px] sm:h-[300px]'} ${pad}`}>
      <div aria-hidden="true" className="sm:h-full">
        {children}
      </div>
    </figure>
  );
}

function Stepper({ n }: { n: number }) {
  const dot = 'inline-flex size-[26px] items-center justify-center rounded-full border border-border-200 text-ink-200';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={dot}>−</span>
      <span className={`${mono} min-w-3.5 text-center`}>{n}</span>
      <span className={dot}>+</span>
    </span>
  );
}

function Pill({ on, children, className = '' }: { on?: boolean; children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full py-[9px] text-center ${on ? 'border-[1.5px] border-ink-100 bg-surface-300 font-semibold' : 'border border-border-200'} ${className}`}>{children}</span>;
}

// Saturday's 50 minutes, block by block (the plan in How it works), and the 14 skaters in their groups.
const BLOCKS: { name: string; min: number; tone: 'a' | 'b' | 'gap' }[] = [
  { name: 'Warm-up', min: 5, tone: 'b' },
  { name: 'Ski Racer', min: 8, tone: 'a' },
  { name: 'Puck Party', min: 12, tone: 'b' },
  { name: 'Water', min: 2, tone: 'gap' },
  { name: 'Snake in the Forest', min: 10, tone: 'a' },
  { name: 'Toilet Bowl Tag', min: 10, tone: 'b' },
  { name: 'Huddle', min: 3, tone: 'gap' },
];
const GROUPS: { name: string; n: number; dot: string }[] = [
  { name: 'Sharks', n: 5, dot: 'bg-ink-200' },
  { name: 'Bears', n: 5, dot: 'bg-rink-200' },
  { name: 'Eagles', n: 4, dot: 'bg-rink-100' },
];

function Saturday() {
  const tone = { a: 'bg-rink-100', b: 'bg-rink-200', gap: 'bg-surface-300' };
  return (
    <figure aria-label="A Saturday practice: 50 minutes of ice split into warm-up, drills, a rotation, water, a game and a huddle, for 14 kids in three skill groups, with one volunteer coach" className="m-0 flex min-w-0 flex-[1_1_440px] flex-col gap-7 rounded-2xl bg-surface-200 p-[clamp(20px,3vw,32px)]">
      <span className={`${mono} text-[13px] text-ink-200`}>Saturday · 9:45</span>
      <div className="flex flex-col gap-3">
        <span className="flex items-baseline gap-2.5">
          <b className={`${mono} text-[44px] font-medium leading-none tracking-[-0.03em]`}>50</b>
          <span className="text-[17px]">minutes of ice</span>
        </span>
        <div aria-hidden="true" className="flex h-7 gap-[3px] overflow-hidden rounded-md">
          {BLOCKS.map((b) => (
            <span key={b.name} title={`${b.name} · ${b.min} min`} className={tone[b.tone]} style={{ flex: b.min }} />
          ))}
        </div>
        <span className="text-[13px] text-ink-200">Warm-up, a drill, stations, water, two games and a huddle, timed to fit.</span>
      </div>
      <div className="flex flex-col gap-3">
        <span className="flex items-baseline gap-2.5">
          <b className={`${mono} text-[44px] font-medium leading-none tracking-[-0.03em]`}>14</b>
          <span className="text-[17px]">kids at three skill levels</span>
        </span>
        <div aria-hidden="true" className="flex flex-wrap gap-x-6 gap-y-3">
          {GROUPS.map((g) => (
            <span key={g.name} className="flex flex-col gap-1.5">
              <span className="flex gap-1">
                {Array.from({ length: g.n }, (_, i) => (
                  <span key={i} className={`size-3.5 rounded-full ${g.dot}`} />
                ))}
              </span>
              <span className="text-xs text-ink-200">{g.name}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="m-0 border-t border-border-100 pt-5 font-display text-[22px] font-bold leading-[1.2]">One of you, with a whistle. Firstpass plans the rest.</p>
    </figure>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-surface-100 text-ink-100">
      <VisitTracker />
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 sm:px-[clamp(16px,4vw,48px)] py-5">
        <Link href="/" aria-label="Firstpass home" className="inline-flex items-center gap-2.5">
          <Mark className="size-[30px]" />
          <span className="font-display text-2xl font-extrabold leading-none tracking-[-0.01em]">Firstpass</span>
        </Link>
        <nav aria-label="Account">
          <Link href="/login" className="inline-flex min-h-11 items-center px-3.5 text-[15px] font-medium hover:underline">
            Sign in
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 sm:px-[clamp(16px,4vw,48px)]">
        <div className="relative pl-[var(--railpad)] [--railpad:0px] [--railx:clamp(4px,1.4vw,20px)] sm:[--railpad:clamp(28px,5vw,76px)]">
          {/* Hero */}
          <section aria-labelledby="hero-title" className="relative flex flex-wrap items-center gap-[clamp(40px,5vw,72px)] pb-[clamp(72px,9vw,120px)] pt-10">
            <Rail top="64px" />
            <div aria-hidden="true" className="absolute hidden left-[calc(var(--railx)-var(--railpad)-6.5px)] top-[52px] size-4 rounded-full bg-ink-100 sm:block" />
            <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
              <p className="font-display text-lg font-bold tracking-[-0.01em] text-rink-100">Show up ready.</p>
              <h1 id="hero-title" className="-mt-2 max-w-[17ch] font-display text-[clamp(42px,4.6vw,66px)] font-extrabold leading-[1] tracking-[-0.03em]">
                Hockey practice plans for parents who said yes to coaching.
              </h1>
              <p className="max-w-[36ch] text-[clamp(18px,1.6vw,21px)] leading-normal">
                No drill hunting the night before. Firstpass builds each U5–U9 practice for your ice time and your kids, and you run it from your phone.
              </p>
              <div className="flex flex-col items-start gap-3 pt-2">
                <a href="#join" className="inline-flex min-h-[52px] items-center rounded-full bg-rink-100 px-[30px] text-[17px] font-medium text-surface-100 hover:bg-rink-200">
                  Get early access
                </a>
                <p className="text-[15px] text-ink-200">Free during the pilot. Brett will set you up this week.</p>
              </div>
            </div>
            <div className="relative min-w-0 flex-[1_1_440px] sm:pb-[max(200px,14vw)]">
              <HeroRink svg={RD.render({ ...hero, title: heroTitle })} spec={hero} title={heroTitle} />
              <PhoneCard />
            </div>
          </section>

          {/* The problem: a real Saturday, the numbers drawn as what they mean, beside the coach's question. */}
          <section aria-labelledby="problem-title" className="relative flex flex-wrap items-center gap-x-[clamp(40px,6vw,96px)] gap-y-10 border-t border-border-100 py-[clamp(56px,8vw,104px)]">
            <Rail />
            <Cone top="clamp(60px, 8vw, 108px)" />
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
              <h2 id="problem-title" className="font-display text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.08] tracking-[-0.02em]">
                Not sure how to plan practices that keep kids engaged while they build skills?
              </h2>
              <p className="max-w-[44ch] text-lg text-ink-200">
                Most volunteer coaches piece drills together from YouTube and PDFs the night before. Firstpass builds the whole practice for you: every group busy, every drill at the right level, and each one shows you how to run it.
              </p>
            </div>
            <Saturday />
          </section>

          {/* How it works */}
          <section aria-labelledby="how-title" className={`${section} flex flex-col gap-12`}>
            <Rail />
            <Cone top="clamp(70px, 9vw, 118px)" />
            <h2 id="how-title" className={`${h2} max-w-[22ch]`}>
              Set up once. Show up ready every week.
            </h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-8 gap-y-10 p-0">
              <li className="flex flex-col gap-5">
                <Crop fit label="Setup, step 2 of 4: how many skaters are in each group">
                  <div className="flex flex-col gap-3.5 rounded-xl border border-border-100 bg-surface-100 p-[18px]">
                    <svg viewBox="0 0 320 30" width="100%" height="24">
                      <path d="M16 18H112" stroke="var(--ink-100)" strokeWidth="2.4" strokeLinecap="round" />
                      <path d="M112 18H208" stroke="var(--ink-100)" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" />
                      <path d="M208 18H304" stroke="var(--border-100)" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" />
                      <path d="M16 6 25 23H7z" fill="var(--whistle-100)" />
                      <path d="M112 6 121 23H103z" fill="none" stroke="var(--whistle-100)" strokeWidth="2" />
                      <path d="M208 6 217 23H199z" fill="none" stroke="var(--border-200)" strokeWidth="2" />
                      <path d="M304 6 313 23H295z" fill="none" stroke="var(--border-200)" strokeWidth="2" />
                    </svg>
                    <span className="font-display text-[17px] font-bold leading-[1.2]">How many skaters in each group?</span>
                    <div className="flex flex-col text-sm">
                      {(
                        [
                          ['Eagles', 4],
                          ['Bears', 5],
                          ['Sharks', 5],
                        ] as const
                      ).map(([g, n], i) => (
                        <div key={g} className={`flex items-center justify-between py-2 ${i < 2 ? 'border-b border-border-100' : ''}`}>
                          <span>{g}</span>
                          <Stepper n={n} />
                        </div>
                      ))}
                    </div>
                  </div>
                </Crop>
                <Step n={1} title="Tell us about your team.">
                  Age group, ice times, and how many skaters at each level. Paste a TeamSnap or Google Calendar link and your practices fill in.
                </Step>
              </li>
              <li className="flex flex-col gap-5">
                <Crop fit label="Saturday's plan, ready: warm-up, drills, a rotation, water, a game and a huddle, 50 minutes">
                  <div className="flex flex-col gap-2.5 rounded-xl border border-border-100 bg-surface-100 px-[18px] py-4 text-[13px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-base font-bold">Sat, Oct 24</span>
                      <span className="whitespace-nowrap text-xs text-ink-200">
                        <span className="mr-[5px] inline-block size-[7px] rounded-full bg-good-100" />
                        Fits 50 min
                      </span>
                    </div>
                    <div className="grid grid-cols-[40px_1fr] items-start gap-x-2.5 gap-y-[7px]">
                      {PLAN.map((p) => (
                        <PlanRow key={p.at} {...p} />
                      ))}
                    </div>
                  </div>
                </Crop>
                <Step n={2} title="Get a plan that’s ready.">
                  Your first practice is built for you: warm-up, stations, a game to finish. Swap any drill or change any minutes.
                </Step>
              </li>
              <li className="flex flex-col gap-5">
                <Crop label="The rink-side view: what's on now, the zones, and what's next" pad="px-3 pt-3 sm:px-6 sm:pt-6">
                  <div className="mx-auto flex h-[248px] w-[220px] sm:h-full flex-col gap-2.5 rounded-t-[26px] border border-b-0 border-border-100 bg-surface-100 px-4 py-[18px]">
                    <div className={`${mono} text-[11px] text-ink-200`}>Today · 9:45</div>
                    <div className="flex items-center gap-2 text-xs text-ink-200">
                      <span className="line-through">Ski Racer</span>
                      <span>Done</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-[10px] border-2 border-rink-100 p-2.5">
                      <span className="text-[11px] font-semibold text-rink-100">Now · 9:58</span>
                      <span className="font-display text-lg font-bold">Puck Party</span>
                      <span className={`${mono} text-[22px] font-medium`}>
                        7:20 <span className="text-[11px] text-ink-200">left</span>
                      </span>
                      <span className="text-[11px] leading-normal text-ink-200">3 zones · whistle every 4 min</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span>
                        <span className={`${mono} mr-2 text-ink-200`}>10:10</span>Water
                      </span>
                      <span>
                        <span className={`${mono} mr-2 text-ink-200`}>10:12</span>Snake in the Forest
                      </span>
                    </div>
                  </div>
                </Crop>
                <Step n={3} title="Run it from the boards.">
                  See what’s on now and what’s next on your phone, or print it for the glass. Every coach on your team sees the same plan, so nobody’s guessing what happens next.
                </Step>
              </li>
            </ol>
          </section>

          {/* Levels */}
          <section aria-labelledby="levels-title" className={`${section} flex flex-col gap-12`}>
            <Rail />
            <Cone top="clamp(70px, 9vw, 118px)" />
            <div className="flex flex-wrap items-end gap-x-16 gap-y-6">
              <h2 id="levels-title" className={`${h2} flex-[1_1_520px]`}>
                One drill. Three levels.
              </h2>
              <p className="max-w-[44ch] flex-[1_1_340px] text-lg text-ink-200">
                Drills that grow with your kids. Start at level 1, and when they’ve got it, take the same drill a step further: add a pass and a shot, then carry the puck all the way. It feels familiar, so they keep getting better instead of learning
                something new every week.
              </p>
            </div>
            <div role="region" aria-label="The three levels" tabIndex={0} className="-mr-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-5 sm:mr-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] sm:gap-8 sm:overflow-visible sm:pb-0 sm:pr-0">
              {levels.map((l) => (
                <figure key={l.n} className="m-0 flex w-[84%] flex-none snap-start flex-col gap-3.5 sm:w-auto">
                  <Rink spec={l.spec} title={`${skiRacer.funName}, level ${l.n}: ${l.name}`} />
                  <figcaption className="flex flex-col gap-0.5">
                    <span className="font-display text-[22px] font-bold">Level {l.n}</span>
                    <span className="text-ink-200">{l.name}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* The loop */}
          <section aria-labelledby="loop-title" className={`${section} flex flex-col gap-12`}>
            <Rail />
            <Cone top="clamp(70px, 9vw, 118px)" />
            <h2 id="loop-title" className={`${h2} max-w-[22ch]`}>
              Every practice shapes the next one.
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] gap-x-10 gap-y-12">
              <div className="flex flex-col gap-5">
                <figure aria-label="The after-practice check-in: how it went, whether they lost steam, standouts, and which groups are ready for harder" className="m-0 rounded-2xl bg-surface-200 p-3 sm:p-7">
                  <div aria-hidden="true" className="flex flex-col gap-4 rounded-xl border border-border-100 bg-surface-100 p-5 text-[13px]">
                    <span className="font-display text-lg font-bold">How was Saturday?</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Pill>Rough</Pill>
                      <Pill>OK</Pill>
                      <Pill on>Great</Pill>
                    </div>
                    <span className="font-semibold">Did they lose steam?</span>
                    <div className="-mt-2 grid grid-cols-3 gap-1.5">
                      <Pill on>No</Pill>
                      <Pill>Got bored</Pill>
                      <Pill>Got tired</Pill>
                    </div>
                    <span className="font-semibold">Any standouts?</span>
                    <div className="-mt-2 flex items-center justify-between rounded-lg bg-surface-200 px-3 py-2.5">
                      <span>Ski Racer</span>
                      <span className="font-semibold text-good-100">Big hit</span>
                    </div>
                    <span className="font-semibold">Ready for harder?</span>
                    <div className="-mt-2 flex gap-1.5">
                      <Pill className="px-3.5 py-[7px]">Sharks</Pill>
                      <Pill on className="px-3.5 py-[7px]">
                        Bears
                      </Pill>
                      <Pill className="px-3.5 py-[7px]">Eagles</Pill>
                    </div>
                  </div>
                </figure>
                <p className="max-w-[46ch] text-[17px]">
                  <strong className="font-semibold">After the ice, a 20-second check-in:</strong> <span className="text-ink-200">how it went, where they lost steam, what was a big hit. Thursday’s plan starts from there.</span>
                </p>
              </div>
              <div className="flex flex-col gap-5">
                <figure aria-label="The plan shared with parents as a link, with a preview card of this week's rotation" className="m-0 flex flex-col gap-3.5 rounded-2xl bg-surface-200 p-3 sm:p-7">
                  <div aria-hidden="true" className="flex flex-col gap-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-100 bg-surface-100 px-4 py-3 text-[13px]">
                      <span className="flex flex-col">
                        <span className="font-semibold">Shared with parents</span>
                        <span className={`${mono} text-xs text-ink-200`}>firstpass.coach/p/u7-blue-oct24</span>
                      </span>
                      <span className="text-ink-200">One link, no sign-in</span>
                    </div>
                    {/* The share card is always in the light palette, like the real one (BrandDevices). */}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] overflow-hidden rounded-xl bg-[#084F68] text-white">
                      <div className="flex flex-col justify-between gap-2.5 px-[18px] py-5">
                        <span className={`${mono} text-[11px] opacity-85`}>U7 BLUE · SAT OCT 24</span>
                        <span className="font-display text-[22px] font-extrabold leading-[1.05]">This week on the ice</span>
                        <span className="flex flex-col gap-[3px] text-xs">
                          {zones.map((z) => (
                            <span key={z.station}>
                              {z.station} · {z.name}
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="share-light flex items-center bg-[#F4F8FA] p-3">
                        <Rink spec={hero} title="" detail="thumb" className="w-full" />
                      </div>
                    </div>
                  </div>
                </figure>
                <p className="max-w-[46ch] text-[17px]">
                  <strong className="font-semibold">Share the plan with parents.</strong> <span className="text-ink-200">One link, no app, no sign-in.</span>
                </p>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Join: the one teal band (brand moment 1). The page stays white until the ask. */}
      <section id="join" aria-labelledby="join-title" className="band-teal relative scroll-mt-0 text-white">
        <span id="join-association" aria-hidden="true" className="absolute top-0" />
        <div className="mx-auto max-w-[1200px] px-5 sm:px-[clamp(16px,4vw,48px)]">
          <div className="relative flex flex-wrap items-start gap-x-[clamp(40px,6vw,96px)] gap-y-12 pb-[clamp(72px,9vw,120px)] pl-[var(--railpad)] pt-[clamp(64px,9vw,112px)] [--railpad:0px] [--railx:clamp(4px,1.4vw,20px)] sm:[--railpad:clamp(28px,5vw,76px)]">
            <div aria-hidden="true" className="absolute hidden left-[var(--railx)] top-0 w-[3px] sm:block bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.72)_0_9px,transparent_9px_17px)]" style={{ height: 'clamp(66px, 9vw, 114px)' }} />
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" className="absolute hidden left-[calc(var(--railx)-11.5px)] top-[clamp(64px,9vw,112px)] sm:block">
              <circle cx="13" cy="13" r="10" fill="var(--band-teal)" stroke="#FFFFFF" strokeWidth="4" />
            </svg>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-8">
              <h2 id="join-title" className="font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[0.96] tracking-[-0.03em]">
                Show up ready this season.
              </h2>
              <blockquote className="m-0 flex max-w-[40ch] flex-col gap-3">
                <p className="font-display text-[22px] font-semibold leading-[1.35]">“I built Firstpass while coaching my son’s U7 team in Nanaimo, for every parent who said yes to coaching.”</p>
                <footer className="text-[15px] text-white/80">Brett, founder</footer>
              </blockquote>
              <p className="max-w-[46ch] text-[15px] text-white/80">Drills are adapted from the skills young players already learn, and every drill shows where it came from. No kids’ names, ever.</p>
            </div>
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-border-100">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 sm:px-[clamp(16px,4vw,48px)] py-7 text-sm text-ink-200">
          <span className="inline-flex items-center gap-2 text-ink-100">
            <Mark className="size-5" />
            <span className="font-display text-[17px] font-extrabold">Firstpass</span>
            <span className="ml-2 text-sm text-ink-200">Built in Nanaimo, BC</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/login" className="py-2.5 underline-offset-2 hover:underline">
              Sign in
            </Link>
            <a href="mailto:hello@firstpass.coach" className="py-2.5 underline-offset-2 hover:underline">
              hello@firstpass.coach
            </a>
            <Link href="/privacy" className="py-2.5 underline-offset-2 hover:underline">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-[22px] font-bold leading-[1.2]">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="mr-2.5 inline-block align-[-1px]">
          <path d="M8 1 15 15H1z" fill="var(--whistle-100)" />
        </svg>
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      <p className="max-w-[38ch] text-ink-200">{children}</p>
    </div>
  );
}

function PlanRow({ at, name, strong, sub }: { at: string; name: string; strong?: boolean; sub?: string }) {
  return (
    <>
      <span className="font-mono text-ink-200">{at}</span>
      {sub ? (
        <span className="flex items-start gap-2.5">
          <span>
            <span className="font-semibold">{name}</span>
            <br />
            <span className="text-[11px] text-ink-200">{sub}</span>
          </span>
          <span className="ml-auto w-[92px]">
            <Rink spec={hero} title="" detail="thumb" />
          </span>
        </span>
      ) : (
        <span className={strong ? 'font-semibold' : ''}>{name}</span>
      )}
    </>
  );
}
