'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { TeamCoach } from '@/lib/app/store';
import { clock, type Team } from '@/lib/plans/schema';
import { Rink } from '@/components/ds';
import type { RinkDiagramProps } from '../../../../design-system/index';
import { CopyLink } from './settings';
import { primary, shownGroups } from './ui';

export type NextPractice = { id: string; date: string; startTime: string; minutes: number; ice: 'half' | 'full'; rink: string | null; drills: number; diagram: { spec: unknown; name: string } | null };
type Coach = TeamCoach & { checkins: number };

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const shown = (c: TeamCoach) => c.firstName ?? c.email;

export function TeamSummary(p: {
  team: Team;
  me: string;
  isHead: boolean;
  coaches: Coach[];
  practicesRun: number;
  joinCode: string | null;
  origin: string;
  next: NextPractice | null;
  season: { run: number; total: number; checkins: number; known: number };
}) {
  const { team, isHead } = p;
  // Emails sent before decision 0031 link to /team#emails and /team#coaches; those moved.
  useEffect(() => {
    const to = { '#emails': '/account#emails', '#coaches': '/team/settings#coaches' }[location.hash];
    if (to) location.replace(to);
  }, []);
  const groups = shownGroups(team.groups);
  const skaters = groups.reduce((n, g) => n + g.skaters, 0);
  const link = p.joinCode ? `${p.origin}/join/${p.joinCode}` : null;

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-3.5rem)] flex-col lg:-mx-8 lg:min-h-dvh lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-10 pt-5 lg:gap-8 lg:px-12 lg:pb-12 lg:pt-10 xl:pr-14">
        <header className="flex items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[28px] font-extrabold leading-8 tracking-[-0.02em] text-balance lg:text-[34px] lg:leading-[38px]">
              {team.name}
            </h1>
            <p className="text-sm text-ink-200 lg:text-[15px]">
              {team.ageGroup} · {skaters} skater{skaters === 1 ? '' : 's'} · {p.coaches.length} coach{p.coaches.length === 1 ? '' : 'es'}
            </p>
          </div>
          <Link href="/team/settings" className="inline-flex min-h-11 shrink-0 items-center gap-2 px-1 text-[15px] font-medium text-rink-100 hover:underline">
            <GearIcon />
            Settings
          </Link>
        </header>

        {/* Next practice */}
        <section aria-labelledby="h-next" className="border-y border-border-100 py-3 lg:py-5">
          {p.next ? (
            <Link href={`/plans/${p.next.id}`} className="group grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3.5 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-6">
              {p.next.diagram ? (
                <Rink spec={p.next.diagram.spec as RinkDiagramProps} title={p.next.diagram.name} detail="thumb" className="w-full" />
              ) : (
                <span aria-hidden="true" className="grid aspect-[2/1] place-items-center rounded-md bg-surface-200 font-mono text-sm text-ink-200">
                  {p.next.drills} drills
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5 lg:gap-1">
                <h2 id="h-next" className="text-xs font-medium text-ink-200 lg:text-[13px]">
                  Next practice
                </h2>
                <span className="font-display text-base font-semibold lg:text-2xl lg:font-bold lg:leading-[30px]">
                  {day(p.next.date)} · {clock(p.next.startTime)}
                </span>
                <span className="text-[13px] text-ink-200 lg:text-[15px]">
                  {[p.next.rink, p.next.ice === 'half' ? 'Half ice' : 'Full ice', `${p.next.minutes} min`].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-2 hidden text-[15px] font-medium text-rink-100 group-hover:underline lg:block">Open the plan</span>
              </span>
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="h-next" className="text-[13px] font-medium text-ink-200">
                  Next practice
                </h2>
                <p className="text-[15px]">Nothing planned yet.</p>
              </div>
              <Link href="/plans" className={primary}>
                Plan a practice
              </Link>
            </div>
          )}
        </section>

        {/* Coaches */}
        <section aria-labelledby="h-coaches" className="flex flex-col gap-3">
          <h2 id="h-coaches" className="font-display text-lg font-semibold leading-6">
            Coaches
          </h2>
          <ul className="flex flex-col gap-2.5 lg:gap-3">
            {p.coaches.map((c) => (
              <li key={c.userId} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-rink-200 text-xs font-semibold text-surface-100">
                  {shown(c).charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-[15px]">
                  <b className="font-semibold">{shown(c)}</b>{' '}
                  <span className="text-ink-200">
                    · {c.role === 'head_coach' ? 'Head coach' : 'Coach'}
                    {c.userId === p.me ? ' · you' : ''}
                  </span>
                </span>
                {p.practicesRun > 0 && <span className="hidden text-[13px] text-ink-200 sm:block">Checked in after {Math.min(c.checkins, p.practicesRun)} of {p.practicesRun}</span>}
              </li>
            ))}
          </ul>
        </section>

      </div>

      {/* Margin: join link, season so far, parents, leave or delete */}
      <aside aria-label="Team details" className="flex flex-col gap-5 border-t border-border-100 bg-surface-200 px-4 py-6 lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0 lg:px-7 lg:py-10">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-body text-sm font-semibold">Join link for coaches</h2>
          {link ? (
            <>
              <CopyLink link={link} />
              <p className="text-[13px] leading-[18px] text-ink-200">Anyone with it joins as a coach. You get an email when they do.</p>
            </>
          ) : isHead ? (
            <p className="text-[13px] leading-[18px] text-ink-200">
              Off.{' '}
              <Link href="/team/settings#coaches" className="font-medium text-rink-100 hover:underline">
                Turn it on
              </Link>{' '}
              in Settings to invite coaches.
            </p>
          ) : (
            <p className="text-[13px] leading-[18px] text-ink-200">Ask your head coach for the team&apos;s join link.</p>
          )}
        </section>
        <section className="flex flex-col gap-2.5 border-t border-border-100 pt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-body text-sm font-semibold">Season so far</h2>
            {p.season.total > 0 && (
              <span className="font-mono text-xs text-ink-200">
                {p.season.run} of {p.season.total}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {(
              [
                [p.season.run, `practice${p.season.run === 1 ? '' : 's'} run`],
                [p.season.checkins, `check-in${p.season.checkins === 1 ? '' : 's'} from coaches`],
                [p.season.known, `drill${p.season.known === 1 ? '' : 's'} the kids know`],
              ] as const
            ).map(([n, l]) => (
              <li key={l} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <b className="font-mono font-medium">{n}</b>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2.5 border-t border-border-100 pt-5">
          <h2 className="font-body text-sm font-semibold">Parents</h2>
          <p className="text-sm leading-5 text-ink-200">Each plan has its own link. No app and no sign-in.</p>
        </section>
        <div className="flex-1" />
      </aside>

    </div>
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
