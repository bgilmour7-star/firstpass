'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeEmail, saveName } from './actions';

const field = 'h-12 w-full min-w-0 rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3.5 text-base focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25';
const save = 'inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]';

export function Profile({ name: initialName, email, local, emailState }: { name: string; email: string; local: boolean; emailState: 'changed' | 'half' | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(
    emailState === 'changed' ? { ok: true, text: 'Your email is changed. Sign in with it from now on.' } : emailState === 'half' ? { ok: true, text: 'One confirmed. Tap the link in the other inbox too, then your email changes.' } : null,
  );
  const [pending, start] = useTransition();

  return (
    <>
      <section className="flex flex-col gap-2">
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveName(name);
              if (!r.ok) return setNameMsg({ ok: false, text: r.error });
              setSavedName(name.trim());
              setNameMsg({ ok: true, text: 'Saved' });
              router.refresh();
            });
          }}
        >
          <label htmlFor="first" className="text-[15px] font-semibold">
            First name
          </label>
          <div className="flex gap-2">
            <input
              id="first"
              autoComplete="given-name"
              maxLength={40}
              required
              disabled={local}
              placeholder="Add your first name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameMsg(null);
              }}
              className={field}
            />
            <button type="submit" disabled={pending || local || !name.trim() || name.trim() === savedName} className={save}>
              Save
            </button>
          </div>
          {nameMsg ? (
            <p role={nameMsg.ok ? 'status' : 'alert'} className={`text-[13px] ${nameMsg.ok ? 'text-good-100' : 'text-flag-100'}`}>
              {nameMsg.text}
            </p>
          ) : (
            <p className="text-[13px] text-ink-200">Your co-coaches see it: &ldquo;{name.trim() || 'Kara'} checked in.&rdquo;</p>
          )}
        </form>
      </section>

      <section className="flex flex-col gap-2 border-t border-border-100 pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold">Email</h2>
          {!local && !editingEmail && (
            <button type="button" onClick={() => setEditingEmail(true)} className="min-h-11 text-sm font-medium text-rink-100 hover:underline">
              Change
            </button>
          )}
        </div>
        <p className="text-[15px]">{email}</p>
        <p className="text-[13px] text-ink-200">You sign in with it. Sign-in codes and after-practice emails go here.</p>
        {editingEmail && (
          <form
            className="mt-2 flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await changeEmail(newEmail);
                if (!r.ok) return setEmailMsg({ ok: false, text: r.error });
                setEmailMsg({ ok: true, text: `Check both inboxes. We sent a link to ${email} and to ${newEmail.trim()}. Your email changes once you confirm.` });
                setEditingEmail(false);
                setNewEmail('');
              });
            }}
          >
            <label htmlFor="new-email" className="text-sm font-semibold">
              New email
            </label>
            <div className="flex gap-2">
              <input id="new-email" type="email" required autoComplete="email" autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={field} />
              <button type="submit" disabled={pending} className={save}>
                Send link
              </button>
            </div>
            <button type="button" onClick={() => setEditingEmail(false)} className="min-h-11 self-start text-sm text-ink-200 hover:text-ink-100">
              Cancel
            </button>
          </form>
        )}
        {emailMsg && (
          <p role={emailMsg.ok ? 'status' : 'alert'} className={`text-[13px] ${emailMsg.ok ? 'text-good-100' : 'text-flag-100'}`}>
            {emailMsg.text}
          </p>
        )}
      </section>
    </>
  );
}
