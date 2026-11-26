'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TeamCoach } from '@/lib/app/store';
import { activeGroups, clock, groupLabel, type Team } from '@/lib/plans/schema';
import { Rink } from '@/components/ds';
import type { RinkDiagramProps } from '../../../../design-system/index';
import { planIceTime } from '../plans/actions';
import { stripShown, type StripDrill } from '@/lib/home/strip';
import { CopyLink } from './settings';
import { ProgressChart } from '@/components/progress-chart';
import type { HomeProgress } from '@/lib/home/progress-view';
import { primary, shownGroups } from './ui';

/** The one thing to do next (decision 0031): a link, or a form that starts a plan from ice. */
export type NextUpView = { key: string; title: string; line: string; action: string; href?: string; iceId?: string };
export type HomeNext =
  | { kind: 'plan'; id: string; date: string; startTime: string; line: string; strip: StripDrill[] }
  | { kind: 'ice'; iceId: string; date: string; startTime: string; line: string }
  | { kind: 'none' };
type Coach = TeamCoach & { checkins: number };

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const shown = (c: TeamCoach) => c.firstName ?? c.email;
const outline = 'inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-200 px-5 text-[15px] font-medium hover:bg-surface-200';

// Home (decision 0031): Next up, the next practice as its drills, then (right column on a computer) the
// season so far and the coaches. Nothing here edits the team.
export function Home(p: {
  team: Team;
  me: string;
  isHead: boolean;
  coaches: Coach[];
  practicesRun: number;
  joinCode: string | null;
  origin: string;
  nextUp: NextUpView | null;
  next: HomeNext;
  /** Null for age groups with no level set (decision 0030). */
  progress: HomeProgress | null;
  season: { run: number; total: number; checkins: number; known: number };
}) {
  const { team } = p;
  // Emails sent before decision 0031 link to /team#emails and /team#coaches; those moved.
  useEffect(() => {
    const to = { '#emails': '/account#emails', '#coaches': '/team/settings#coaches' }[location.hash];
    if (to) location.replace(to);
  }, []);
  const later = useLater(p.nextUp?.key ?? null);
  const nextUp = later.hidden ? null : p.nextUp;
  const groups = shownGroups(team.groups);
  const skaters = groups.reduce((n, g) => n + g.skaters, 0);
  const names = activeGroups(team).map((g) => groupLabel(team, g)).join(', ');
  const link = p.joinCode ? `${p.origin}/join/${p.joinCode}` : null;

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-3.5rem)] flex-col lg:-mx-8 lg:min-h-dvh lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 pb-12 pt-6 lg:gap-12 lg:px-14 lg:pb-16 lg:pt-10 xl:pr-16">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-[30px] font-extrabold leading-9 tracking-[-0.02em] text-balance lg:text-[40px] lg:leading-[1.1]">{team.name}</h1>
            <p className="text-sm text-ink-200 lg:text-base">
              {team.ageGroup} · {skaters} skater{skaters === 1 ? '' : 's'}
              <span className="hidden sm:inline"> · {names}</span>
            </p>
          </div>
          <Link href="/team/settings" aria-label="Team settings" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-2 text-[15px] font-medium text-rink-100 hover:underline max-sm:size-11 max-sm:justify-center max-sm:border-[1.5px] max-sm:border-border-200 max-sm:text-ink-100">
            <GearIcon />
            <span className="max-sm:sr-only">Settings</span>
          </Link>
        </header>

        {nextUp && (
          <section aria-label="Next up" className="flex flex-col gap-3 rounded-2xl bg-surface-200 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-[18px]">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="font-display text-[19px] font-bold leading-6 sm:text-xl">{nextUp.title}</b>
              <span className="text-sm text-ink-200">{nextUp.line}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 sm:flex-row-reverse">
              <NextUpAction v={nextUp} />
              <button type="button" onClick={later.hide} className="min-h-11 rounded-full px-3 text-sm text-ink-200 hover:text-ink-100">
                Later
              </button>
            </span>
          </section>
        )}

        <NextPractice next={p.next} quiet={Boolean(nextUp)} />

        {p.progress && <Progress v={p.progress} isHead={p.isHead} />}
      </div>

      <aside aria-label="Team" className="flex flex-col gap-8 border-t border-border-100 bg-surface-200 px-4 py-7 lg:w-[360px] lg:shrink-0 lg:border-l lg:border-t-0 lg:px-7 lg:py-10">
        <section aria-labelledby="h-season" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 id="h-season" className="font-body text-sm font-semibold">
              Season so far
            </h2>
            {p.season.total > 0 && (
              <span className="font-mono text-xs text-ink-200">
                {p.season.run} of {p.season.total}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2 text-[15px]">
            {(
              [
                [p.season.run, `practice${p.season.run === 1 ? '' : 's'} run`],
                [p.season.checkins, `check-in${p.season.checkins === 1 ? '' : 's'} from coaches`],
                [p.season.known, `drill${p.season.known === 1 ? '' : 's'} the kids know`],
              ] as const
            ).map(([n, l]) => (
              <li key={l} className="grid grid-cols-[36px_minmax(0,1fr)] items-baseline gap-3">
                <b className="font-mono text-xl font-medium">{n}</b>
                <span className="text-sm">{l}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-coaches" className="flex flex-col">
          <h2 id="h-coaches" className="mb-2 font-body text-sm font-semibold">
            Coaches
          </h2>
          <ul className="flex flex-col">
            {p.coaches.map((c) => (
              <li key={c.userId} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 border-t border-border-100 py-2.5">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-rink-200 text-xs font-semibold text-surface-100">
                  {shown(c).charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px]">
                    <b className="font-semibold">{shown(c)}</b>{' '}
                    <span className="text-ink-200">
                      · {c.role === 'head_coach' ? 'Head coach' : 'Coach'}
                      {c.userId === p.me ? ' · you' : ''}
                    </span>
                  </span>
                  {p.practicesRun > 0 && <span className="text-xs text-ink-200">Checked in after {Math.min(c.checkins, p.practicesRun)} of {p.practicesRun}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2">
            {link ? (
              <>
                <CopyLink link={link} />
                <p className="text-xs text-ink-200">Anyone with the link joins as a coach. Turn it off in Settings once everyone&apos;s in.</p>
              </>
            ) : p.isHead ? (
              <Link href="/team/settings#coaches" className={`${outline} self-start`}>
                Turn on invite link
              </Link>
            ) : (
              <p className="text-xs text-ink-200">Ask your head coach for the team&apos;s join link.</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

const monthName = (m: string) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString('en-CA', { month: 'long' });

/** Progress on Home (decision 0031): one sentence, the chart, then where the round stands. */
function Progress({ v, isHead }: { v: HomeProgress; isHead: boolean }) {
  const heading = (
    <h2 id="h-progress" className="font-display text-2xl font-extrabold leading-8 lg:text-[32px] lg:leading-[1.15]">
      Progress
    </h2>
  );
  if (v.kind === 'first')
    return (
      <section aria-labelledby="h-progress" className="flex flex-col gap-3 border-t border-border-100 pt-8 lg:pt-10">
        {heading}
        <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-dashed border-border-200 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="flex flex-1 flex-col gap-1">
            <b className="text-[17px] font-semibold">Score your first round to see where the team starts.</b>
            <span className="text-sm text-ink-200">Each coach places the team on the six skills, levels 1 to 5. About 5 minutes. After that, the change shows here every month.</span>
          </span>
          {v.canScore ? (
            <Link href="/progress/score" className={`${primary} self-start sm:self-auto`}>
              Score this round
            </Link>
          ) : (
            <span className="text-sm text-ink-200">It opens after the first practice of the month.</span>
          )}
        </div>
      </section>
    );
  const span = v.prevMonth ? `${monthName(v.prevMonth)} → ${monthName(v.month)}` : monthName(v.month);
  const moved = v.rows.filter((r) => r.now != null).map((r) => `${r.attribute} ${r.now!.toFixed(1)}${r.before != null && r.before !== r.now ? `, from ${r.before.toFixed(1)}` : ''}${r.goal ? `, goal ${r.goal.target.toFixed(1)}` : ''}`);
  const label = `Team average level, 1 to 5, ${span}. ${moved.join('. ')}.`;
  return (
    <section aria-labelledby="h-progress" className="flex flex-col gap-4 border-t border-border-100 pt-8 lg:pt-10">
      <div className="flex items-baseline justify-between gap-3">
        {heading}
        <Link href="/progress" className="min-h-11 content-center text-sm font-medium text-rink-100 hover:underline">
          <span className="sm:hidden">Report ›</span>
          <span className="max-sm:hidden">See the {monthName(v.month)} report ›</span>
        </Link>
      </div>
      <p className="text-base lg:text-lg">
        <b className="font-semibold">{v.lead}</b>
        {v.detail && <span className="text-ink-200"> {v.detail}</span>}
      </p>
      <ProgressChart rows={v.rows} label={label} span={span} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface-200 px-4 py-3">
        <span className="min-w-0 flex-[1_1_240px] text-sm">{v.round}</span>
        {isHead ? (
          <Link href="/progress/goals" className="min-h-11 content-center text-sm font-medium text-rink-100 hover:underline">
            {v.hasGoals ? 'Change goals' : 'Set goals'}
          </Link>
        ) : (
          v.hasGoals && (
            <Link href="/progress#goals" className="min-h-11 content-center text-sm font-medium text-rink-100 hover:underline">
              See goals
            </Link>
          )
        )}
      </div>
      {!v.hasGoals && isHead && <p className="-mt-2 text-[13px] text-ink-200">No season goals yet. Set one for each skill you want to grow, and plans lean toward the ones that fall behind.</p>}
    </section>
  );
}

function NextUpAction({ v }: { v: NextUpView }) {
  if (v.iceId)
    return (
      <form action={planIceTime.bind(null, v.iceId)}>
        <button type="submit" className={primary}>
          {v.action}
        </button>
      </form>
    );
  return (
    <Link href={v.href ?? '/plans'} className={primary}>
      {v.action}
    </Link>
  );
}

/** "Later" hides Next up on this device until tomorrow, for that one item. */
function useLater(key: string | null) {
  const [hidden, setHidden] = useState(false);
  const today = () => new Date().toLocaleDateString('en-CA');
  useEffect(() => {
    if (!key) return;
    try {
      setHidden(localStorage.getItem(`fp-later:${key}`) === today());
    } catch {
      /* private mode: Later just doesn't stick */
    }
  }, [key]);
  return {
    hidden,
    hide: () => {
      setHidden(true);
      try {
        if (key) localStorage.setItem(`fp-later:${key}`, today());
      } catch {
        /* as above */
      }
    },
  };
}

function NextPractice({ next, quiet }: { next: HomeNext; quiet: boolean }) {
  const btn = quiet ? outline : primary;
  if (next.kind === 'none')
    return (
      <section aria-labelledby="h-next" className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="h-next" className="text-sm font-medium text-ink-200 lg:text-base">
            Next practice
          </h2>
          <p className="text-[15px]">Nothing planned yet.</p>
        </div>
        <Link href="/plans" className={btn}>
          Plan a practice
        </Link>
      </section>
    );
  const head = (
    <div className="flex flex-col gap-0.5">
      <h2 id="h-next" className="text-sm font-medium text-ink-200 lg:text-base">
        Next practice
      </h2>
      <span className="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] lg:text-[44px]">
        {day(next.date)} · {clock(next.startTime)}
      </span>
      <span className="mt-1 text-[15px] text-ink-200 lg:text-lg">{emphasiseNew(next.line)}</span>
    </div>
  );
  if (next.kind === 'ice')
    return (
      <section aria-labelledby="h-next" className="flex flex-wrap items-end justify-between gap-3">
        {head}
        <form action={planIceTime.bind(null, next.iceId)}>
          <button type="submit" className={btn}>
            Make a plan
          </button>
        </form>
      </section>
    );
  // Drills only, in order (decision 0031): equal widths up to 6 on a computer; 7+ shows 5 and "+N more".
  const { shown: shownDrills, more } = stripShown(next.strip);
  const many = more > 0;
  const cols = shownDrills.length + (many ? 1 : 0);
  return (
    <section aria-labelledby="h-next" className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {head}
        <Link href={`/plans/${next.id}`} className={`${btn} max-sm:hidden`}>
          Open the plan
        </Link>
      </div>
      {shownDrills.length > 0 && (
        <ol aria-label="Drills, in order" className="-mr-4 flex gap-3 lg:gap-4 overflow-x-auto pb-1 pr-4 lg:mr-0 lg:grid lg:overflow-visible lg:pr-0" style={{ gridTemplateColumns: `repeat(${Math.max(cols, 4)}, minmax(0, 1fr))` }}>
          {shownDrills.map((d) => (
            <li key={d.id} className="flex w-[150px] shrink-0 flex-col gap-1 lg:w-auto">
              {/* One box size for every drill, so a full-rink drill lines up with half-rink ones. */}
              <Link href={`/plans/${next.id}`} className={`grid aspect-[102/87] place-items-center overflow-hidden rounded-lg border border-border-100 bg-surface-100`} tabIndex={-1} aria-hidden="true">
                <Rink spec={d.diagram as RinkDiagramProps} title={d.name} detail="thumb" className="w-full" />
              </Link>
              <span className="font-mono text-xs text-ink-200">
                {clock(d.time)} · {d.minutes} min
              </span>
              <b className="text-[15px] font-semibold leading-5">{d.name}</b>
              {d.isNew ? <span className="text-[13px] font-medium text-warn-text">New today</span> : null}
            </li>
          ))}
          {many && (
            <li className="flex w-[150px] shrink-0 lg:w-auto">
              <Link href={`/plans/${next.id}`} className="flex aspect-[102/87] w-full flex-col items-center justify-center gap-0.5 rounded-lg border-[1.5px] border-dashed border-border-200 hover:bg-surface-200">
                <b className="font-mono text-xl font-medium">+{more}</b>
                <span className="text-[13px]">more drills</span>
              </Link>
            </li>
          )}
        </ol>
      )}
      <Link href={`/plans/${next.id}`} className={`${btn} self-start sm:hidden`}>
        Open the plan
      </Link>
    </section>
  );
}

/** "3 new" is the one thing in the line that changes what a coach does, so it is the only orange in it. */
function emphasiseNew(line: string) {
  return line.split(/(\d+ new)/).map((part, i) =>
    /^\d+ new$/.test(part) ? (
      <b key={i} className="font-semibold text-warn-text">
        {part}
      </b>
    ) : (
      part
    ),
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
