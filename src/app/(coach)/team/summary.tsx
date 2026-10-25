'use client';

import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamCoach } from '@/lib/app/store';
import { clock, type Team } from '@/lib/plans/schema';
import type { WeeklySlot } from '@/lib/plans/team-summary';
import { Rink } from '@/components/ds';
import type { RinkDiagramProps } from '../../../../design-system/index';
import { deleteTeam, leaveTeam, saveTeam } from './actions';
import { CalendarSettings } from './calendar';
import { Coaches } from './coaches';
import { EmailSettings } from './emails';
import { Count, Drawer, FocusPicker, GearEditor, GroupsEditor, ICE_OPTIONS, Segmented, field, gearLine, primary, quiet, shownGroups, tiers } from './ui';

export type NextPractice = { id: string; date: string; startTime: string; minutes: number; ice: 'half' | 'full'; rink: string | null; drills: number; diagram: { spec: unknown; name: string } | null };
type Coach = TeamCoach & { checkins: number };
type Section = 'name' | 'ice' | 'groups' | 'coaches' | 'gear' | 'planning';

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const ICE_WORD = { half: 'Half ice', full: 'Full ice', varies: 'Ice changes' } as const;
const shown = (c: TeamCoach) => c.firstName ?? c.email;

export function TeamSummary(p: {
  team: Team;
  me: string;
  local: boolean;
  email: string;
  isHead: boolean;
  coaches: Coach[];
  practicesRun: number;
  joinCode: string | null;
  origin: string;
  calendar: { url: string; syncedAt: string | null } | null;
  slots: WeeklySlot[];
  icePractices: number;
  emails: boolean;
  next: NextPractice | null;
  season: { run: number; total: number; checkins: number; known: number };
  initialEdit: string | null;
}) {
  const { team, isHead } = p;
  const router = useRouter();
  const [edit, setEdit] = useState<Section | null>((['name', 'ice', 'groups', 'coaches', 'gear', 'planning'] as const).find((s) => s === p.initialEdit) ?? null);
  const close = useCallback(() => {
    setEdit(null);
    router.refresh();
  }, [router]);
  const groups = shownGroups(team.groups);
  const skaters = groups.reduce((n, g) => n + g.skaters, 0);
  const tier = tiers(groups.length);
  const link = p.joinCode ? `${p.origin}/join/${p.joinCode}` : null;
  const gear = gearLine(team.gear);

  const EditBtn = ({ s, label }: { s: Section; label: string }) =>
    isHead || s === 'coaches' ? (
      <button type="button" onClick={() => setEdit(s)} aria-label={`Edit ${label.toLowerCase()}`} className="min-h-11 px-1 text-sm font-medium text-rink-100 hover:underline">
        Edit
      </button>
    ) : null;
  const Head = ({ s, title, id }: { s: Section; title: string; id: string }) => (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="font-display text-lg font-semibold leading-6">
        {title}
      </h2>
      <EditBtn s={s} label={title} />
    </div>
  );

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-3.5rem)] flex-col lg:-mx-8 lg:min-h-dvh lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-10 pt-5 lg:gap-8 lg:px-12 lg:pb-12 lg:pt-10 xl:pr-14">
        <header className="flex items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[28px] font-extrabold leading-8 tracking-[-0.02em] text-balance lg:text-[34px] lg:leading-[38px]">
              {team.name}
              {isHead && (
                <button type="button" onClick={() => setEdit('name')} className="ml-3 align-middle font-body text-sm font-medium tracking-normal text-rink-100 hover:underline">
                  Rename
                </button>
              )}
            </h1>
            <p className="text-sm text-ink-200 lg:text-[15px]">
              {team.ageGroup} · {skaters} skater{skaters === 1 ? '' : 's'} · {p.coaches.length} coach{p.coaches.length === 1 ? '' : 'es'}
            </p>
          </div>
          {isHead && (
            <button type="button" onClick={() => setEdit('coaches')} className="hidden h-11 shrink-0 items-center gap-2 rounded-full border border-border-200 px-[18px] text-[15px] font-medium hover:bg-surface-200 sm:inline-flex">
              <InviteIcon />
              Invite a coach
            </button>
          )}
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

        {/* Practices and ice */}
        <section aria-labelledby="h-ice" className="flex flex-col gap-3">
          <Head s="ice" title="Practices and ice" id="h-ice" />
          {p.slots.length ? (
            <ul className="flex flex-col">
              {p.slots.map((s) => (
                <li key={s.label + s.startTime} className="flex flex-col border-t border-border-100 py-2.5 text-[15px] first:border-t-0 lg:grid lg:grid-cols-[120px_120px_minmax(0,1fr)] lg:gap-4 lg:first:border-t">
                  <span>
                    <b className="font-semibold">{s.label}</b>{' '}
                    <span className="font-mono text-sm lg:hidden">
                      {clock(s.startTime)} · {s.minutes} min
                    </span>
                  </span>
                  <span className="hidden font-mono text-sm lg:block">
                    {clock(s.startTime)} · {s.minutes} min
                  </span>
                  <span className="text-ink-200">{[s.sharedWith ? 'Half ice' : ICE_WORD[team.ice], s.rink, s.sharedWith ? `Shared with ${s.sharedWith}` : null].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px]">
              {ICE_WORD[team.ice]} · {team.practiceMinutes} min practices
            </p>
          )}
          <p className="flex items-center gap-2 text-[13px] text-ink-200 lg:text-sm">
            {p.calendar ? (
              <>
                <CheckIcon />
                Ice times come from your calendar{p.calendar.syncedAt ? ` · checked ${ago(p.calendar.syncedAt)}` : ''} · {p.icePractices} practice{p.icePractices === 1 ? '' : 's'} coming
              </>
            ) : isHead ? (
              <>
                No calendar link yet.
                <button type="button" onClick={() => setEdit('ice')} className="font-medium text-rink-100 hover:underline">
                  Add one
                </button>
              </>
            ) : (
              'No calendar link yet.'
            )}
          </p>
        </section>

        {/* Skill groups */}
        <section aria-labelledby="h-groups" className="flex flex-col gap-3 border-t border-border-100 pt-5 lg:pt-6">
          <Head s="groups" title="Skill groups" id="h-groups" />
          <ul className={`grid gap-2 lg:gap-4 ${groups.length === 1 ? 'grid-cols-1' : groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {groups.map((g, i) => (
              <li key={g.group} className="flex min-w-0 flex-col gap-0.5">
                <b className="font-mono text-2xl font-medium leading-7 lg:text-[28px] lg:leading-8">{g.skaters}</b>
                <span className="truncate text-sm font-semibold lg:text-[15px]">{g.name || g.group}</span>
                <span className="hidden text-[13px] text-ink-200 lg:block">{tier[i]?.long}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Coaches */}
        <section id="coaches" aria-labelledby="h-coaches" className="flex scroll-mt-24 flex-col gap-3 border-t border-border-100 pt-5 lg:pt-6">
          <Head s="coaches" title="Coaches" id="h-coaches" />
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

        {/* Gear and planning */}
        <div className="grid gap-6 border-t border-border-100 pt-5 lg:grid-cols-2 lg:gap-12 lg:pt-6">
          <section aria-labelledby="h-gear" className="flex flex-col gap-2.5">
            <Head s="gear" title="Gear" id="h-gear" />
            <p className="text-[15px] leading-6">{gear ?? 'Not set yet. Drills that need gear say so.'}</p>
          </section>
          <section aria-labelledby="h-planning" className="flex flex-col gap-2.5">
            <Head s="planning" title="Planning" id="h-planning" />
            <p className="text-[15px] leading-6">
              {team.practiceMinutes} min practices · Up to {team.newDrillsPerWeek} new drill{team.newDrillsPerWeek === 1 ? '' : 's'} a week
              {team.focus.length ? ` · Focus: ${team.focus.join(', ')}` : ''}
            </p>
          </section>
        </div>
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
              <button type="button" onClick={() => setEdit('coaches')} className="font-medium text-rink-100 hover:underline">
                Turn it on
              </button>{' '}
              to invite coaches.
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
        {!p.local && (
          <div className="border-t border-border-100 pt-5">
            <EmailSettings initial={p.emails} email={p.email} />
          </div>
        )}
        <div className="flex-1" />
        <LeaveOrDelete team={team} isHead={isHead} />
      </aside>

      {edit === 'name' && <NameDrawer team={team} onClose={close} />}
      {edit === 'ice' && (
        <SectionDrawer title="Practices and ice" team={team} onClose={close} note="Plans already made keep their times." extra={<CalendarSettings initial={p.calendar?.url ?? null} syncedAt={p.calendar?.syncedAt ?? null} embedded />}>
          {(t, set) => (
            <div className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Usual ice</legend>
                <Segmented label="Usual ice" value={t.ice} options={ICE_OPTIONS} onChange={(ice) => set({ ...t, ice })} />
                <span className="text-[13px] text-ink-200">Sets how drills are drawn. You can change it for one practice in its plan.</span>
              </fieldset>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Usual length</span>
                <span className="flex items-center gap-2">
                  <Count value={t.practiceMinutes} min={20} max={120} label="minutes" onChange={(n) => set({ ...t, practiceMinutes: n })} />
                  <span className="text-sm text-ink-200">min</span>
                </span>
              </div>
            </div>
          )}
        </SectionDrawer>
      )}
      {edit === 'groups' && (
        <SectionDrawer title="Skill groups" team={team} onClose={close} note="Each practice can still set who’s there that day.">
          {(t, set) => <GroupsEditor groups={t.groups} onChange={(g) => set({ ...t, groups: g })} />}
        </SectionDrawer>
      )}
      {edit === 'gear' && (
        <SectionDrawer title="Gear" team={team} onClose={close}>
          {(t, set) => <GearEditor gear={t.gear} onChange={(g) => set({ ...t, gear: g })} />}
        </SectionDrawer>
      )}
      {edit === 'planning' && (
        <SectionDrawer title="Planning" team={team} onClose={close}>
          {(t, set) => (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">New drills a week</span>
                  <span className="text-[13px] text-ink-200">A default, not a rule.</span>
                </span>
                <Count value={t.newDrillsPerWeek} max={10} label="new drills a week" onChange={(n) => set({ ...t, newDrillsPerWeek: n })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Coaches on the ice</span>
                <Count value={t.coachesOnIce} min={1} max={10} label="coaches on the ice" onChange={(n) => set({ ...t, coachesOnIce: n })} />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Focus this month (up to 2)</legend>
                <FocusPicker focus={t.focus} onChange={(f) => set({ ...t, focus: f })} />
              </fieldset>
            </div>
          )}
        </SectionDrawer>
      )}
      {edit === 'coaches' && (
        <Drawer title="Coaches" kicker={team.name} onClose={close}>
          <Coaches coaches={p.coaches} me={p.me} isHead={isHead} initialCode={p.joinCode} origin={p.origin} embedded />
        </Drawer>
      )}
    </div>
  );
}

/** One section's drawer: edits a copy of the team and saves it with the team form's action (saveTeam). */
function SectionDrawer({ title, team, onClose, note, extra, children }: { title: string; team: Team; onClose: () => void; note?: string; extra?: React.ReactNode; children: (t: Team, set: (t: Team) => void) => React.ReactNode }) {
  const [t, setT] = useState(team);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveTeam(t);
      if (r.ok) onClose();
      else setError(r.error);
    });
  return (
    <Drawer
      title={title}
      kicker={team.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={save} disabled={pending} className={primary}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className={quiet}>
            Cancel
          </button>
          {error ? (
            <span role="alert" className="text-sm text-flag-100">
              {error}
            </span>
          ) : (
            note && <span className="ml-auto max-w-[180px] text-right text-xs leading-4 text-ink-200">{note}</span>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-8">
        {children(t, setT)}
        {extra && <div className="border-t border-border-100 pt-6">{extra}</div>}
      </div>
    </Drawer>
  );
}

function NameDrawer({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <SectionDrawer title="Team name" team={team} onClose={onClose}>
      {(t, set) => (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="team-name" className="text-sm font-semibold">
            Team name
          </label>
          <input id="team-name" className={field} value={t.name} maxLength={80} onChange={(e) => set({ ...t, name: e.target.value })} />
          <span className="text-[13px] text-ink-200">Team details only. Never kids&apos; names.</span>
        </div>
      )}
    </SectionDrawer>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const short = link.replace(/^https?:\/\//, '');
  return (
    <div className="flex h-11 items-center justify-between gap-2 rounded-[10px] border border-border-100 bg-surface-100 pl-3.5 pr-1">
      <span className="truncate font-mono text-[13px]" title={link}>
        {short}
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            if (navigator.share && matchMedia('(max-width: 1023px)').matches) await navigator.share({ url: link });
            else await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            /* the coach can select the link instead */
          }
        }}
        className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-rink-100 hover:bg-surface-200"
      >
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}

function LeaveOrDelete({ team, isHead }: { team: Team; isHead: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 border-t border-border-100 pt-5">
      <p className="text-[13px] leading-[18px] text-ink-200">
        Firstpass keeps team details only, never kids&apos; names.{' '}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-medium text-rink-100 hover:underline">
          {isHead ? 'Delete this team' : 'Leave this team'}
        </button>
      </p>
      {open && (
        <form
          className="flex flex-col gap-2.5 rounded-[10px] border border-border-100 bg-surface-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = isHead ? await deleteTeam(typed) : await leaveTeam();
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          {isHead ? (
            <>
              <p className="text-sm">Deleting removes the team&apos;s plans, check-ins and join link for every coach. It can&apos;t be undone.</p>
              <label htmlFor="confirm-name" className="text-[13px] font-semibold">
                Type {team.name} to confirm
              </label>
              <input id="confirm-name" className={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </>
          ) : (
            <p className="text-sm">You&apos;ll stop seeing {team.name}&apos;s plans. The head coach can send you the join link again.</p>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-flag-100 px-5 text-sm font-semibold text-surface-100 disabled:opacity-50">
              {pending ? 'One moment…' : isHead ? 'Delete the team' : 'Leave the team'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full px-4 text-sm font-medium hover:bg-surface-200">
              Keep it
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-flag-100">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-good-100">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.6-3.6 3.2-5.6 6.5-5.6 1.5 0 2.8.4 3.9 1.1M18 14v6M15 17h6" />
    </svg>
  );
}

