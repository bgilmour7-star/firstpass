'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { askClaudeAgain, decideChange, declineRequest } from '../../drills/actions';
import { FEEDBACK_MAX } from '@/lib/requests/schema';

type Mode = 'idle' | 'declining' | 'asking';

// Accept, ask Claude again with a note (decision 0055), or decline a coach's request.
// Feedback sits beside the buttons (UX patterns).
export function Decide({ requestId, kind, canAccept, canAsk, requester }: { requestId: string; kind: 'new' | 'change'; canAccept: boolean; canAsk: boolean; requester: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [why, setWhy] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const decide = (accept: boolean) =>
    start(async () => {
      const r = kind === 'change' ? await decideChange(requestId, accept, why) : await declineRequest(requestId, why);
      setMsg(r.ok ? { ok: true, text: `${accept ? 'Accepted' : 'Declined'}. ${requester} gets an email.` } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const ask = () =>
    start(async () => {
      const r = await askClaudeAgain(requestId, note);
      setMsg(r.ok ? { ok: true, text: 'Sent back to Claude. The redraw comes with the next morning run, and you get an email when it’s ready.' } : { ok: false, text: r.error });
      if (r.ok) {
        setNote('');
        setMode('idle');
        router.refresh();
      }
    });

  return (
    <section className="flex flex-col gap-3 border-t border-border-100 pt-5">
      {mode === 'declining' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Why not? {requester} sees this.</span>
            <textarea rows={2} maxLength={1000} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="We already have a drill like this: Snake in the Forest." className="w-full max-w-xl rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6" />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => decide(false)} className="min-h-11 rounded-full bg-ink-100 px-5 text-sm font-semibold text-surface-100 hover:opacity-90 disabled:opacity-60">
              Decline and tell {requester}
            </button>
            <button type="button" onClick={() => setMode('idle')} className="min-h-11 rounded-full px-5 text-sm text-ink-200 hover:bg-surface-200">
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === 'asking' && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">What should Claude change? Only admins see this.</span>
            <textarea
              rows={3}
              maxLength={FEEDBACK_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Move the two nets out from the goal line, about level with the faceoff dots."
              className="w-full max-w-xl rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={pending || note.trim().length < 3} onClick={ask} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
              Send to Claude
            </button>
            <button type="button" onClick={() => setMode('idle')} className="min-h-11 rounded-full px-5 text-sm text-ink-200 hover:bg-surface-200">
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          {canAccept && (
            <button type="button" disabled={pending} onClick={() => decide(true)} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
              Accept the change
            </button>
          )}
          {canAsk && (
            <button type="button" onClick={() => setMode('asking')} className="min-h-11 rounded-full border border-ink-100 px-5 text-sm font-medium hover:bg-surface-200">
              Ask Claude to change it
            </button>
          )}
          <button type="button" onClick={() => setMode('declining')} className="min-h-11 rounded-full border border-ink-100 px-5 text-sm font-medium hover:bg-surface-200">
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
