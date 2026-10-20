'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideChange, declineRequest } from '../../drills/actions';

// Accept or decline a coach's request. Feedback sits beside the buttons (UX patterns).
export function Decide({ requestId, kind, canAccept, requester }: { requestId: string; kind: 'new' | 'change'; canAccept: boolean; requester: string }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (accept: boolean) =>
    start(async () => {
      const r = kind === 'change' ? await decideChange(requestId, accept, why) : await declineRequest(requestId, why);
      setMsg(r.ok ? { ok: true, text: `${accept ? 'Accepted' : 'Declined'}. ${requester} gets an email.` } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <section className="flex flex-col gap-3 border-t border-border-100 pt-5">
      {declining ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Why not? {requester} sees this.</span>
            <textarea rows={2} maxLength={1000} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="We already have a drill like this: Snake in the Forest." className="w-full max-w-xl rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6" />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(false)} className="min-h-11 rounded-full bg-ink-100 px-5 text-sm font-semibold text-surface-100 hover:opacity-90 disabled:opacity-60">
              Decline and tell {requester}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="min-h-11 rounded-full px-5 text-sm text-ink-200 hover:bg-surface-200">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canAccept && (
            <button type="button" disabled={pending} onClick={() => run(true)} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
              Accept the change
            </button>
          )}
          <button type="button" onClick={() => setDeclining(true)} className="min-h-11 rounded-full border border-ink-100 px-5 text-sm font-medium hover:bg-surface-200">
            Decline
          </button>
          {kind === 'change' && !canAccept && <span className="text-sm text-ink-200">Accept appears once Claude has drafted the change.</span>}
          {kind === 'new' && <span className="text-sm text-ink-200">A drafted drill is answered from Drill review: making it live accepts it, archiving declines it.</span>}
        </div>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-good-100' : 'text-flag-100'}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
