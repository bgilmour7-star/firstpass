'use client';

import { useState, useTransition } from 'react';
import type { TeamCoach } from '@/lib/app/store';
import { handOverTeam, newJoinLink, removeCoach, sendInvite, turnOffJoinLink } from './actions';

const pill = 'inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium disabled:opacity-50';

const shown = (c: TeamCoach) => c.firstName ?? c.email;
/** "joined today" / "joined 3 days ago" for a week after joining, so the head coach's email lands on something that matches. */
function joinedLabel(at: string): string {
  if (!at) return '';
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (days < 0 || days > 6) return '';
  return days === 0 ? ' · joined today' : days === 1 ? ' · joined yesterday' : ` · joined ${days} days ago`;
}

/** Who coaches the team, and the join link that adds more (decisions 0011, 0013). */
export function Coaches({
  coaches,
  me,
  isHead,
  initialCode,
  origin,
  embedded = false,
  onHandedOver,
}: {
  coaches: TeamCoach[];
  me: string;
  isHead: boolean;
  initialCode: string | null;
  origin: string;
  /** Inside the Team page's drawer (decision 0026). */
  embedded?: boolean;
  /** After handing the team to another coach (decision 0026). */
  onHandedOver?: () => void;
}) {
  const [list, setList] = useState(coaches);
  // Head coach until they hand the team over in this drawer.
  const [amHead, setAmHead] = useState(isHead);
  const [handing, setHanding] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [invite, setInvite] = useState('');
  const [sent, setSent] = useState('');
  const link = code ? `${origin}/join/${code}` : '';
  const head = list.find((c) => c.role === 'head_coach');

  const run = (fn: () => Promise<{ ok: true; code?: string | null } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      if (r.code !== undefined) setCode(r.code);
      setCopied(false);
      after?.();
    });

  return (
    <section className={embedded ? 'flex flex-col gap-3' : 'flex scroll-mt-24 flex-col gap-3 border-t-2 border-ink-100 pt-3'}>
      <div className={embedded ? 'sr-only' : 'flex items-baseline justify-between gap-3'}>
        <h2 className="text-[17px] font-extrabold">Coaches</h2>
        <span className="text-sm text-ink-200">
          {list.length} coach{list.length === 1 ? '' : 'es'}
        </span>
      </div>

      <ul className="flex flex-col">
        {list.map((c) => (
          <li key={c.userId} className="flex flex-col border-t border-border-100 py-2 first:border-t-0">
            <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-300 font-display text-sm font-bold">
              {shown(c).charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">
                {shown(c)}
                {c.userId === me && <span className="font-normal text-ink-200"> (you)</span>}
                {c.userId === me && !c.firstName && (
                  <a href="/account" className="ml-2 text-[13px] font-normal text-rink-100 hover:underline">
                    Add your name
                  </a>
                )}
              </span>
              <span className="truncate text-xs text-ink-200">
                {c.role === 'head_coach' ? 'Head coach' : 'Coach'}
                {c.firstName ? ` · ${c.email}` : ''}
                {c.role === 'head_coach' ? '' : joinedLabel(c.joinedAt)}
              </span>
            </span>
            {amHead && c.userId !== me && c.role !== 'head_coach' && confirming !== c.userId && handing !== c.userId && (
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <button type="button" onClick={() => (setHanding(c.userId), setConfirming(null))} className={`${pill} text-rink-100 hover:bg-surface-200`}>
                  Make head coach
                </button>
                <button type="button" onClick={() => (setConfirming(c.userId), setHanding(null))} className={`${pill} text-ink-200 hover:bg-surface-200`}>
                  Remove
                </button>
              </span>
            )}
            {confirming === c.userId && (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeCoach(c.userId), () => setList((l) => l.filter((x) => x.userId !== c.userId)))}
                  className={`${pill} bg-flag-100 text-surface-100`}
                >
                  Remove
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={`${pill} hover:bg-surface-200`}>
                  Keep
                </button>
              </span>
            )}
            </div>
            {handing === c.userId && (
              <div role="group" aria-label={`Make ${shown(c)} head coach`} className="mt-2 flex flex-col gap-3 rounded-[10px] border border-border-100 bg-surface-200 p-3">
                <p className="text-[15px] leading-[22px]">
                  <b className="font-semibold">{shown(c)} becomes head coach.</b> You stay on the team as a coach and can leave after.
                </p>
                <p className="text-[13px] leading-[18px] text-ink-200">They can edit the team, invite and remove coaches, and turn the join link on or off. The team&apos;s plans and history stay. We&apos;ll email them.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => handOverTeam(c.userId),
                        () => {
                          setList((l) => l.map((x) => (x.userId === c.userId ? { ...x, role: 'head_coach' } : x.userId === me ? { ...x, role: 'coach' } : x)));
                          setAmHead(false);
                          setHanding(null);
                          setDone(`${shown(c)} is head coach now. You can leave the team from the bottom of the Team page.`);
                          onHandedOver?.();
                        },
                      )
                    }
                    className={`${pill} bg-rink-100 text-surface-100 hover:bg-rink-200`}
                  >
                    {pending ? 'One moment…' : `Make ${shown(c)} head coach`}
                  </button>
                  <button type="button" onClick={() => setHanding(null)} className={`${pill} hover:bg-surface-300`}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {done && (
        <p role="status" className="text-sm text-good-100">
          {done}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-md bg-surface-200 p-3">
        <h3 className="text-sm font-bold">Add a coach</h3>
        {amHead ? (
          code ? (
            <>
              <p className="text-sm text-ink-200">Send this link to your co-coaches by text or email. They sign in with their email and join as coaches.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="join-link" className="sr-only">
                  Join link
                </label>
                <input id="join-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full min-w-0 rounded-md border border-border-100 bg-surface-100 px-3 py-2 font-mono text-sm" />
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                      } catch {
                        setError('Couldn’t copy. Select the link and copy it.');
                      }
                    }}
                    className={`${pill} bg-rink-100 text-surface-100 hover:bg-rink-200`}
                  >
                    Copy link
                  </button>
                  <span aria-live="polite" className="text-sm text-ink-200">
                    {copied ? 'Copied' : ''}
                  </span>
                </span>
              </div>
              <form
                className="mt-1 flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const to = invite;
                  run(() => sendInvite(to), () => {
                    setSent(`Invite sent to ${to.trim()}.`);
                    setInvite('');
                  });
                }}
              >
                <label htmlFor="invite" className="sr-only">
                  Invite a coach by email
                </label>
                <input
                  id="invite"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="Or email it: coach@example.com"
                  value={invite}
                  onChange={(e) => {
                    setInvite(e.target.value);
                    setSent('');
                  }}
                  className="w-full min-w-0 rounded-md border border-border-200 bg-surface-100 px-3 py-2 text-sm"
                />
                <button type="submit" disabled={pending} className={`${pill} shrink-0 border border-border-200 bg-surface-100 hover:bg-surface-300`}>
                  Send invite
                </button>
              </form>
              <p aria-live="polite" className="text-sm text-good-100">
                {sent}
              </p>
              <p className="flex flex-wrap items-center gap-x-1 text-xs text-ink-200">
                Anyone with the link can join.
                <button type="button" disabled={pending} onClick={() => run(newJoinLink)} className="underline underline-offset-2 disabled:opacity-50">
                  Make a new link
                </button>
                (the old one stops working) or
                <button type="button" disabled={pending} onClick={() => run(turnOffJoinLink)} className="underline underline-offset-2 disabled:opacity-50">
                  turn it off
                </button>
                <span className="-ml-1">.</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-200">Turn on a join link and send it to your co-coaches. They sign in with their email and join as coaches.</p>
              <button type="button" disabled={pending} onClick={() => run(newJoinLink)} className={`${pill} self-start bg-rink-100 text-surface-100 hover:bg-rink-200`}>
                {pending ? 'Turning on…' : 'Turn on join link'}
              </button>
            </>
          )
        ) : (
          <p className="text-sm text-ink-200">Ask {head ? shown(head) : 'your head coach'} for the team&apos;s join link.</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-flag-100">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
