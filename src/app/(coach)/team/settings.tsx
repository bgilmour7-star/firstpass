'use client';

import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamCoach } from '@/lib/app/store';
import { clock, type Team } from '@/lib/plans/schema';
import type { WeeklySlot } from '@/lib/plans/team-summary';
import { deleteTeam, leaveTeam, saveTeam } from './actions';
import { CalendarSettings } from './calendar';
import { Coaches } from './coaches';
import { Count, Drawer, FocusPicker, GearEditor, GroupsEditor, ICE_OPTIONS, Segmented, field, gearLine, primary, quiet, shownGroups, tiers } from './ui';

type Section = 'name' | 'ice' | 'groups' | 'gear' | 'planning';
const ICE_WORD = { half: 'Half ice', full: 'Full ice', varies: 'Ice changes' } as const;
const shown = (c: TeamCoach) => c.firstName ?? c.email;

/**
 * Team settings (decision 0031): what everyone on the team shares, one section edited at a time in a
 * drawer (0026). Head coaches edit; other coaches see it read-only. Your own emails are in Account.
 */
type RowProps = { s: Section | null; title: string; action?: string; isHead: boolean; onEdit: (s: Section) => void; children: React.ReactNode };

/** One section of Team settings, at module level so opening a drawer doesn't remount it (focus goes back to its Edit). */
function SettingsRow({ s, title, action = 'Edit', isHead, onEdit, children }: RowProps) {
  const id = `h-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 border-t border-border-100 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-[17px] font-semibold">
          {title}
        </h2>
        {isHead && s && (
          <button type="button" onClick={() => onEdit(s)} aria-label={`${action} ${title.toLowerCase()}`} className="min-h-11 px-1 text-sm font-medium text-rink-100 hover:underline">
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function TeamSettings(p: {
  team: Team;
  me: string;
  isHead: boolean;
  scoring?: Record<string, boolean>;
  coaches: TeamCoach[];
  joinCode: string | null;
  origin: string;
  calendar: { url: string; syncedAt: string | null } | null;
  slots: WeeklySlot[];
  icePractices: number;
  initialEdit: string | null;
}) {
  const { team, isHead } = p;
  const router = useRouter();
  const [edit, setEdit] = useState<Section | null>((['name', 'ice', 'groups', 'gear', 'planning'] as const).find((s) => s === p.initialEdit) ?? null);
  const close = useCallback(() => {
    setEdit(null);
    router.refresh();
  }, [router]);
  const groups = shownGroups(team.groups);
  const tier = tiers(groups.length);
  const gear = gearLine(team.gear);
  const head = p.coaches.find((c) => c.role === 'head_coach');

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col pb-10 pt-2">
      <Link href="/team" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-rink-100 hover:underline">
        <span aria-hidden="true">‹</span> {team.name}
      </Link>
      <h1 className="font-display text-[30px] font-extrabold leading-9">Team settings</h1>
      <p className="mb-3 mt-1 text-sm text-ink-200">
        Shared by everyone on {team.name}. Only head coaches can change these{!isHead && head ? `: ask ${shown(head)}` : ''}. Your own emails are in{' '}
        <Link href="/account#emails" className="text-rink-100 underline">
          Account
        </Link>
        .
      </p>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="name" title="Team name">
        <p className="text-[15px]">
          {team.name} · {team.ageGroup}
        </p>
      </SettingsRow>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="ice" title="Practices and ice">
        {p.slots.length ? (
          <ul className="flex flex-col">
            {p.slots.map((s) => (
              <li key={s.label + s.startTime} className="flex flex-col border-t border-border-100 py-2 text-[15px] first:border-t-0 sm:grid sm:grid-cols-[120px_120px_minmax(0,1fr)] sm:gap-4">
                <b className="font-semibold">{s.label}</b>
                <span className="font-mono text-sm">
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
      </SettingsRow>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="ice" title="Calendar" action={p.calendar ? 'Change' : 'Add'}>
        {p.calendar ? (
          <>
            <p className="text-[15px]">Your association&apos;s calendar</p>
            <p className="text-sm text-ink-200">
              {p.calendar.syncedAt ? `Synced ${ago(p.calendar.syncedAt)} · ` : ''}
              {p.icePractices} practice{p.icePractices === 1 ? '' : 's'} to come
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-200">No calendar link yet. With one, ice times come in by themselves.</p>
        )}
      </SettingsRow>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="groups" title="Skill groups">
        <ul className={`grid gap-2 sm:gap-4 ${groups.length === 1 ? 'grid-cols-1' : groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {groups.map((g, i) => (
            <li key={g.group} className="flex min-w-0 flex-col gap-0.5">
              <b className="font-mono text-2xl font-medium leading-7">{g.skaters}</b>
              <span className="truncate text-[15px] font-semibold">{g.name || g.group}</span>
              <span className="hidden text-[13px] text-ink-200 sm:block">{tier[i]?.long}</span>
            </li>
          ))}
        </ul>
      </SettingsRow>

      <section id="coaches" aria-labelledby="h-coaches" className="flex scroll-mt-24 flex-col gap-2.5 border-t border-border-100 py-5">
        <h2 id="h-coaches" className="text-[17px] font-semibold">
          Coaches
        </h2>
        <Coaches coaches={p.coaches} me={p.me} isHead={isHead} initialCode={p.joinCode} origin={p.origin} embedded onHandedOver={() => router.refresh()} scoring={p.scoring} />
      </section>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="gear" title="Gear">
        <p className={`text-[15px] ${gear ? '' : 'text-ink-200'}`}>{gear ?? 'Not set yet. Drills that need gear say so.'}</p>
      </SettingsRow>

      <SettingsRow isHead={isHead} onEdit={setEdit} s="planning" title="Planning">
        <p className="text-[15px]">
          Up to {team.newDrillsPerWeek} new drill{team.newDrillsPerWeek === 1 ? '' : 's'} a week · {team.coachesOnIce} coach{team.coachesOnIce === 1 ? '' : 'es'} on the ice
          {team.focus.length ? ` · Focus: ${team.focus.join(', ')}` : ''}
        </p>
        <p className="text-[13px] text-ink-200">{team.planning === 'ask' ? 'When something changes, Firstpass asks first.' : 'When something changes, Firstpass updates the plan for you.'}</p>
      </SettingsRow>

      <LeaveOrDelete team={team} isHead={isHead} others={p.coaches.length - 1} onHandOver={() => document.getElementById('coaches')?.scrollIntoView({ behavior: 'smooth' })} />

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
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1 text-sm font-semibold">When something changes</legend>
                <span className="-mt-1 text-[13px] text-ink-200">Who’s here today, and the check-in after practice. For every coach on the team.</span>
                {PLANNING.map((o) => (
                  <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ${t.planning === o.value ? 'border-2 border-rink-100 bg-surface-200' : 'border border-border-100'}`}>
                    <input type="radio" name="planning" value={o.value} checked={t.planning === o.value} onChange={() => set({ ...t, planning: o.value })} className="mt-0.5 h-5 w-5 accent-[var(--rink-100)]" />
                    <span className="flex flex-col gap-1">
                      <b className="text-[15px] font-semibold">
                        {o.title}
                        {o.value === 'auto' && <span className="ml-1.5 text-xs font-medium text-ink-200">Default</span>}
                      </b>
                      <span className="text-[13px] leading-normal text-ink-200">{o.body}</span>
                    </span>
                  </label>
                ))}
                <span className="text-[13px] text-ink-200">Suggestions from the check-in are never applied without a tap.</span>
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Focus this month (up to 2)</legend>
                <FocusPicker focus={t.focus} onChange={(f) => set({ ...t, focus: f })} />
              </fieldset>
            </div>
          )}
        </SectionDrawer>
      )}
    </div>
  );
}

// Decision 0046: one team setting for what happens when who's here changes or a coach checks in.
const PLANNING: { value: Team['planning']; title: string; body: string }[] = [
  { value: 'auto', title: 'Update the plan for us', body: 'The plan adapts to who’s here, and the next practice gets planned after the check-in. You’ll see what changed, with Undo.' },
  { value: 'ask', title: 'Ask me first', body: 'Each change asks: update the plan, save and keep the plan, or cancel. If nobody plans the next practice, Firstpass plans it the day before.' },
];

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


export function CopyLink({ link }: { link: string }) {
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


/**
 * Leave or delete, at the bottom of Team settings (decisions 0026, 0031). A coach leaves. A head coach with
 * other coaches hands the team over first (the Coaches drawer), then can leave; they can also delete
 * it. The only coach on a team can only delete it.
 */
function LeaveOrDelete({ team, isHead, others, onHandOver }: { team: Team; isHead: boolean; others: number; onHandOver: () => void }) {
  const [open, setOpen] = useState<'leave' | 'delete' | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const link = 'font-medium text-rink-100 hover:underline';
  const row = 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2';
  const btn = 'inline-flex min-h-11 shrink-0 items-center rounded-full border-[1.5px] px-5 text-[15px] font-medium';
  return (
    <section aria-labelledby="h-leave" className="flex flex-col gap-4 border-t border-border-100 py-6">
      <h2 id="h-leave" className="text-[17px] font-semibold">
        Leave or delete
      </h2>
      {!isHead && (
        <div className={row}>
          <p className="min-w-0 flex-[1_1_320px] text-sm text-ink-200">Leave {team.name}. The team and its history stay with its coaches.</p>
          <button type="button" onClick={() => setOpen(open === 'leave' ? null : 'leave')} aria-expanded={open === 'leave'} className={`${btn} border-border-200 hover:bg-surface-200`}>
            Leave this team
          </button>
        </div>
      )}
      {isHead && others > 0 && (
        <p className="text-sm text-ink-200">
          Stepping down?{' '}
          <button type="button" onClick={onHandOver} className={link}>
            Make another coach head coach first
          </button>
          , then you can leave.
        </p>
      )}
      {isHead && (
        <div className={row}>
          <p className="min-w-0 flex-[1_1_320px] text-sm text-ink-200">Delete {team.name} and every plan, check-in and score in it. This can&apos;t be undone.</p>
          <button type="button" onClick={() => setOpen(open === 'delete' ? null : 'delete')} aria-expanded={open === 'delete'} className={`${btn} border-flag-100 text-flag-100 hover:bg-surface-200`}>
            Delete this team
          </button>
        </div>
      )}
      {open && (
        <form
          className="flex flex-col gap-2.5 rounded-[10px] border border-border-100 bg-surface-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = open === 'delete' ? await deleteTeam(typed) : await leaveTeam();
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          {open === 'delete' ? (
            <>
              <p className="text-sm">
                Deleting removes the team&apos;s plans, check-ins and join link for every coach. It can&apos;t be undone.
                {others > 0 ? ' To keep the team going without you, hand it to another coach instead.' : ''}
              </p>
              <label htmlFor="confirm-name" className="text-[13px] font-semibold">
                Type {team.name} to confirm
              </label>
              <input id="confirm-name" className={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </>
          ) : (
            <p className="text-sm">You&apos;ll stop seeing {team.name}&apos;s plans. The team and its history stay with its coaches. The head coach can send you the join link again.</p>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-flag-100 px-5 text-sm font-semibold text-surface-100 disabled:opacity-50">
              {pending ? 'One moment…' : open === 'delete' ? 'Delete the team' : 'Leave the team'}
            </button>
            <button type="button" onClick={() => setOpen(null)} className="h-11 rounded-full px-4 text-sm font-medium hover:bg-surface-200">
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
      <p className="text-xs text-ink-200">Firstpass keeps team details only, never kids&apos; names.</p>
    </section>
  );
}

export function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
}
